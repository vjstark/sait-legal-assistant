// POST /api/ingest/url — fetch a web page, extract the readable article text,
// and turn it into searchable chunks.
//
// Body: { documentId: string } — must reference a url_source document with a
// source_url. Citations for these chunks use the document's source_url, so
// page_number and timestamp_seconds stay null.
//
// Response: { done: true, chunks: n }
//
// BYOK: the Voyage key arrives in the x-voyage-key header — never logged,
// never stored.

import { NextResponse } from "next/server";
import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { embedDocuments, VoyageError } from "@/lib/ai/voyage";
import { resolveVoyageKey } from "@/lib/ai/voyage";
import { chunkSegments, type Segment } from "@/lib/chunking";

export const maxDuration = 300;

const FETCH_TIMEOUT_MS = 30_000;
// Some sites serve bots an empty shell; a browsery UA gets the real page.
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

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
    .select("id, course_id, category, source_url, title, review_status")
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

  if (doc.category !== "url_source" || !doc.source_url) {
    return fail("This route only processes url_source documents with a source URL.", 400);
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

    // ── Fetch the page ───────────────────────────────────────────────────
    let html: string;
    try {
      const response = await fetch(doc.source_url, {
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*" },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
        redirect: "follow",
      });
      if (!response.ok) {
        return fail(
          `The page returned HTTP ${response.status} — check that the URL is public and correct.`,
          422,
        );
      }
      html = await response.text();
    } catch (fetchErr) {
      const timedOut = fetchErr instanceof Error && fetchErr.name === "TimeoutError";
      return fail(
        timedOut
          ? "Fetching the page timed out after 30 seconds."
          : "Could not reach the URL — check that it is public and correct.",
        422,
      );
    }

    // ── Extract the readable article (strips nav, ads, footers…) ─────────
    // A muted virtual console keeps jsdom's CSS-parse warnings out of logs.
    const virtualConsole = new VirtualConsole();
    virtualConsole.on("error", () => {});
    const dom = new JSDOM(html, { url: doc.source_url, virtualConsole });
    const article = new Readability(dom.window.document).parse();

    if (!article || !article.textContent || article.textContent.trim().length === 0) {
      return fail(
        "Could not extract readable text from this page — it may be an app-like page or behind a login. Try saving the content as a text file instead.",
        422,
      );
    }

    // ── Chunk: paragraphs as segments, no page numbers ───────────────────
    const segments: Segment[] = article.textContent
      .split(/\n\s*\n/)
      .map((paragraph) => ({ text: paragraph }));
    const chunks = chunkSegments(segments);
    if (chunks.length === 0) {
      return fail("The page contained no usable text.", 422);
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
      timestamp_seconds: null,
      chunk_index: i,
    }));
    for (let i = 0; i < rows.length; i += 100) {
      const { error } = await admin.from("chunks").insert(rows.slice(i, i + 100));
      if (error) throw new Error(`Failed to save chunks: ${error.message}`);
    }

    // ── Finish: fill in a blank title from the article, mark ready ───────
    const updates: { status: string; title?: string } = { status: "ready" };
    if ((!doc.title || doc.title.trim().length === 0) && article.title) {
      updates.title = article.title;
    }
    await admin.from("documents").update(updates).eq("id", documentId);

    return NextResponse.json({ done: true, chunks: rows.length });
  } catch (err) {
    if (err instanceof VoyageError) {
      return fail(err.message, err.status);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return fail(`Processing failed: ${message}`, 500);
  }
}
