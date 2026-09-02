// POST /api/ingest/audio — transcribe a lecture recording with Groq Whisper
// and turn the transcript into searchable, timestamped chunks.
//
// Body: { documentId: string } — must reference a lecture_audio document.
//
// After a successful transcription the raw audio file is DELETED from storage
// (deliberate: the free storage tier can't hold hours of audio; the transcript
// chunks are what the tutor actually needs) and storage_path is nulled out.
//
// Response: { done: true, chunks: n }
//
// BYOK: the Groq key (x-groq-key) and Voyage key (x-voyage-key) arrive as
// request headers — never logged, never stored.

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedDocuments, VoyageError } from "@/lib/ai/voyage";
import { resolveVoyageKey } from "@/lib/ai/voyage";
import { chunkSegments, type Segment } from "@/lib/chunking";

export const maxDuration = 300;

const GROQ_TRANSCRIPTION_URL =
  "https://api.groq.com/openai/v1/audio/transcriptions";
const WHISPER_MODEL = "whisper-large-v3-turbo";

// Shape of Groq's response_format=verbose_json (OpenAI-compatible).
interface GroqVerboseTranscription {
  text: string;
  duration?: number;
  segments?: { start: number; end: number; text: string }[];
}

export async function POST(request: Request) {
  // ── Auth: signed-in admin only ─────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can ingest documents." },
      { status: 403 },
    );
  }

  // ── Input ──────────────────────────────────────────────────────────────
  let documentId: string;
  try {
    const body = (await request.json()) as { documentId?: string };
    if (!body.documentId) throw new Error("missing documentId");
    documentId = body.documentId;
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON with a documentId." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("documents")
    .select("id, course_id, category, storage_path, source_filename, review_status")
    .eq("id", documentId)
    .single();
  if (!doc) {
    return NextResponse.json({ error: "Document not found." }, { status: 404 });
  }
  if (doc.review_status !== "approved") {
    return NextResponse.json(
      { error: "This document hasn't been approved yet — approve it first." },
      { status: 409 },
    );
  }

  // Any failure from here on aborts processing → mark the row 'error' first.
  const fail = async (message: string, status: number) => {
    await admin.from("documents").update({ status: "error" }).eq("id", documentId);
    return NextResponse.json({ error: message }, { status });
  };

  if (doc.category !== "lecture_audio") {
    return fail("This route only processes lecture_audio documents.", 400);
  }
  if (!doc.storage_path) {
    return fail(
      "No audio file found for this document (it may already have been transcribed and cleaned up). Re-upload the audio to process it again.",
      400,
    );
  }

  const groqKey = request.headers.get("x-groq-key");
  if (!groqKey) {
    return fail(
      "Missing Groq API key — add it in Settings → API keys, then retry.",
      400,
    );
  }
  const voyageKey = resolveVoyageKey(request.headers);
  if (!voyageKey) {
    return fail(
      "Missing Voyage API key — add it in Settings → API keys or ask the admin to enable the shared key.",
      400,
    );
  }

  try {
    await admin.from("documents").update({ status: "processing" }).eq("id", documentId);
    await admin.from("chunks").delete().eq("document_id", documentId);

    // ── Download the audio from storage ──────────────────────────────────
    const { data: file, error: downloadError } = await admin.storage
      .from("course-files")
      .download(doc.storage_path);
    if (downloadError || !file) {
      return fail(
        `Could not download the audio from storage: ${downloadError?.message ?? "unknown error"}`,
        500,
      );
    }

    // ── Transcribe with Groq Whisper ─────────────────────────────────────
    // The filename's extension tells Groq the audio format.
    const filename =
      doc.source_filename ?? doc.storage_path.split("/").pop() ?? "audio.mp3";
    const form = new FormData();
    form.append("file", file, filename);
    form.append("model", WHISPER_MODEL);
    form.append("response_format", "verbose_json");

    const groqResponse = await fetch(GROQ_TRANSCRIPTION_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${groqKey}` },
      body: form,
    });

    if (!groqResponse.ok) {
      const status = groqResponse.status;
      if (status === 401) {
        return fail(
          "Your Groq API key was rejected — check it in Settings → API keys.",
          401,
        );
      }
      if (status === 413) {
        return fail(
          "The audio file is too large for Groq's transcription API (25 MB on the free tier). Split the recording into ~20-minute segments and upload each separately.",
          413,
        );
      }
      const detail = await groqResponse.text().catch(() => "");
      return fail(
        `Groq transcription failed (${status}): ${detail.slice(0, 300)}`,
        status >= 400 && status < 600 ? status : 502,
      );
    }

    const transcription = (await groqResponse.json()) as GroqVerboseTranscription;
    const groqSegments = transcription.segments ?? [];
    if (groqSegments.length === 0 && !transcription.text?.trim()) {
      return fail("The transcription came back empty — is the recording audible?", 422);
    }

    // ── Chunk: each Whisper segment carries its start time ───────────────
    const segments: Segment[] =
      groqSegments.length > 0
        ? groqSegments.map((s) => ({
            text: s.text,
            timestampSeconds: Math.floor(s.start),
          }))
        : [{ text: transcription.text, timestampSeconds: 0 }];
    const chunks = chunkSegments(segments);
    if (chunks.length === 0) {
      return fail("The transcript contained no usable text.", 422);
    }

    // ── Embed + insert ───────────────────────────────────────────────────
    const embeddings = await embedDocuments(
      voyageKey,
      chunks.map((c) => c.content),
    );
    const rows = chunks.map((chunk, i) => ({
      document_id: doc.id,
      course_id: doc.course_id,
      content: chunk.content,
      embedding: embeddings[i],
      page_number: null,
      timestamp_seconds: chunk.timestampSeconds ?? null,
      chunk_index: i,
    }));
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await admin.from("chunks").insert(rows.slice(i, i + 100));
      if (error) throw new Error(`Failed to save chunks: ${error.message}`);
    }

    // ── Clean up: delete the raw audio, keep only the transcript ─────────
    // (Deliberate — see the note at the top of this file.)
    await admin.storage.from("course-files").remove([doc.storage_path]);

    const duration =
      typeof transcription.duration === "number"
        ? Math.round(transcription.duration)
        : groqSegments.length > 0
          ? Math.round(groqSegments[groqSegments.length - 1].end)
          : null;

    await admin
      .from("documents")
      .update({ status: "ready", storage_path: null, duration_seconds: duration })
      .eq("id", documentId);

    return NextResponse.json({ done: true, chunks: rows.length });
  } catch (err) {
    if (err instanceof VoyageError) {
      return fail(err.message, err.status);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return fail(`Processing failed: ${message}`, 500);
  }
}
