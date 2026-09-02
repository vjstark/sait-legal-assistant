// POST /api/ingest/file — turn an uploaded PDF or .txt into searchable chunks.
//
// Body: { documentId: string, cursor?: number }
//   cursor = 0-based PDF page index to resume from. The UI calls this route
//   repeatedly: each call processes up to 20 pages and reports progress, so a
//   300-page textbook doesn't blow past serverless time limits.
//
// Response: { done: boolean, nextCursor?: number, processed: number, total: number }
//   processed = pages completed so far overall, total = total pages.
//
// BYOK: the Voyage embedding key arrives in the x-voyage-key header and is
// used for this one request only — never logged, never stored.

import { NextResponse } from "next/server";
import { extractText, getDocumentProxy } from "unpdf";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedDocuments, VoyageError } from "@/lib/ai/voyage";
import { resolveVoyageKey } from "@/lib/ai/voyage";
import { chunkSegments, type Segment } from "@/lib/chunking";

export const maxDuration = 300;

const PAGES_PER_CALL = 20;

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
  let cursor: number;
  try {
    const body = (await request.json()) as {
      documentId?: string;
      cursor?: number;
    };
    if (!body.documentId) throw new Error("missing documentId");
    documentId = body.documentId;
    cursor = typeof body.cursor === "number" && body.cursor > 0 ? body.cursor : 0;
  } catch {
    return NextResponse.json(
      { error: "Request body must be JSON with a documentId." },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  const { data: doc } = await admin
    .from("documents")
    .select("id, course_id, category, storage_path, source_filename, status, review_status")
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

  if (doc.category === "url_source" || doc.category === "lecture_audio") {
    return fail(
      `This route handles PDF/text files, not ${doc.category} documents.`,
      400,
    );
  }
  if (!doc.storage_path) {
    return fail("Document has no uploaded file to process.", 400);
  }

  const voyageKey = resolveVoyageKey(request.headers);
  if (!voyageKey) {
    return fail(
      "Missing Voyage API key — add it in Settings → API keys or ask the admin to enable the shared key.",
      400,
    );
  }

  try {
    // ── Download the file from storage ───────────────────────────────────
    const { data: file, error: downloadError } = await admin.storage
      .from("course-files")
      .download(doc.storage_path);
    if (downloadError || !file) {
      return fail(
        `Could not download the file from storage: ${downloadError?.message ?? "unknown error"}`,
        500,
      );
    }
    const buffer = await file.arrayBuffer();

    const filename = doc.source_filename ?? doc.storage_path;
    const isTxt = filename.toLowerCase().endsWith(".txt");

    // ── Plain text (pasted notes): one segment, one pass ─────────────────
    if (isTxt) {
      const text = new TextDecoder("utf-8").decode(buffer);
      await admin.from("documents").update({ status: "processing" }).eq("id", documentId);
      await admin.from("chunks").delete().eq("document_id", documentId);

      const chunks = chunkSegments([{ text }]);
      if (chunks.length === 0) {
        return fail("The text file is empty — nothing to ingest.", 422);
      }
      await embedAndInsert(admin, doc, chunks, 0, voyageKey);

      await admin.from("documents").update({ status: "ready" }).eq("id", documentId);
      return NextResponse.json({ done: true, processed: 1, total: 1 });
    }

    // ── PDF: extract per-page text ───────────────────────────────────────
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { totalPages, text: pages } = await extractText(pdf, {
      mergePages: false,
    });

    if (cursor === 0) {
      // First call for this document: reset so re-processing is clean.
      await admin
        .from("documents")
        .update({ status: "processing", page_count: totalPages })
        .eq("id", documentId);
      await admin.from("chunks").delete().eq("document_id", documentId);
    }

    const end = Math.min(cursor + PAGES_PER_CALL, totalPages);
    const segments: Segment[] = [];
    for (let i = cursor; i < end; i++) {
      // pageNumber is 1-based — what a student sees in their PDF viewer.
      segments.push({ text: pages[i] ?? "", pageNumber: i + 1 });
    }
    const chunks = chunkSegments(segments);

    if (chunks.length > 0) {
      // chunk_index must continue across batches: start after the current max.
      let startIndex = 0;
      if (cursor > 0) {
        const { data: last } = await admin
          .from("chunks")
          .select("chunk_index")
          .eq("document_id", documentId)
          .order("chunk_index", { ascending: false })
          .limit(1)
          .maybeSingle();
        startIndex = last ? last.chunk_index + 1 : 0;
      }
      await embedAndInsert(admin, doc, chunks, startIndex, voyageKey);
    }

    if (end < totalPages) {
      return NextResponse.json({
        done: false,
        nextCursor: end,
        processed: end,
        total: totalPages,
      });
    }

    await admin.from("documents").update({ status: "ready" }).eq("id", documentId);
    return NextResponse.json({ done: true, processed: totalPages, total: totalPages });
  } catch (err) {
    if (err instanceof VoyageError) {
      return fail(err.message, err.status);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return fail(`Processing failed: ${message}`, 500);
  }
}

/** Embed chunk texts with Voyage and bulk-insert the chunk rows. */
async function embedAndInsert(
  admin: ReturnType<typeof createAdminClient>,
  doc: { id: string; course_id: string },
  chunks: { content: string; pageNumber?: number }[],
  startIndex: number,
  voyageKey: string,
) {
  const embeddings = await embedDocuments(
    voyageKey,
    chunks.map((c) => c.content),
  );
  const rows = chunks.map((chunk, i) => ({
    document_id: doc.id,
    course_id: doc.course_id,
    content: chunk.content,
    embedding: embeddings[i],
    page_number: chunk.pageNumber ?? null,
    timestamp_seconds: null,
    chunk_index: startIndex + i,
  }));
  // Insert in slices to keep each request payload modest (1024 floats/row).
  for (let i = 0; i < rows.length; i += 100) {
    const { error } = await admin.from("chunks").insert(rows.slice(i, i + 100));
    if (error) throw new Error(`Failed to save chunks: ${error.message}`);
  }
}
