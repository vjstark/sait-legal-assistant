import { tool } from "ai";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { embedQuery } from "@/lib/ai/voyage";

// ─────────────────────────────────────────────────────────────────
// Retrieval shared by the chat tool and the quiz/flashcard routes:
// embed the query → match_chunks RPC → look up matched documents →
// return chunks with prebuilt citation display text.
// ─────────────────────────────────────────────────────────────────

type MatchedChunk = {
  id: string;
  document_id: string;
  content: string;
  page_number: number | null;
  timestamp_seconds: number | null;
  similarity: number;
};

type MatchedDocument = {
  id: string;
  title: string;
  category: string;
  source_url: string | null;
};

export type RetrievedChunk = {
  content: string;
  citation: string;
  category: string;
  similarity: number;
};

function formatTimestamp(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const mmss = `${hours > 0 ? String(minutes).padStart(2, "0") : minutes}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${mmss}` : mmss;
}

function buildCitation(chunk: MatchedChunk, doc: MatchedDocument | undefined): string {
  if (!doc) return "Course material";
  if (doc.category === "url_source" && doc.source_url) {
    return `${doc.title} (${doc.source_url})`;
  }
  if (chunk.timestamp_seconds != null) {
    return `${doc.title}, at ${formatTimestamp(chunk.timestamp_seconds)}`;
  }
  if (chunk.page_number != null) {
    return `${doc.title}, p. ${chunk.page_number}`;
  }
  return doc.title;
}

export async function retrieveChunks({
  voyageKey,
  supabase,
  courseId,
  query,
  count = 8,
}: {
  voyageKey: string;
  supabase: SupabaseClient;
  courseId: string;
  query: string;
  count?: number;
}): Promise<RetrievedChunk[]> {
  const embedding = await embedQuery(voyageKey, query);

  const { data: chunks, error: matchError } = await supabase.rpc("match_chunks", {
    query_embedding: embedding,
    match_course_id: courseId,
    match_count: count,
  });
  if (matchError) throw new Error(`Course material search failed: ${matchError.message}`);

  const matched = (chunks ?? []) as MatchedChunk[];
  if (matched.length === 0) return [];

  const documentIds = [...new Set(matched.map((c) => c.document_id))];
  const { data: documents, error: docsError } = await supabase
    .from("documents")
    .select("id, title, category, source_url")
    .in("id", documentIds);
  if (docsError) throw new Error(`Document lookup failed: ${docsError.message}`);

  const docsById = new Map((documents ?? []).map((d: MatchedDocument) => [d.id, d]));

  return matched.map((chunk) => {
    const doc = docsById.get(chunk.document_id);
    return {
      content: chunk.content,
      citation: buildCitation(chunk, doc),
      category: doc?.category ?? "unknown",
      similarity: chunk.similarity,
    };
  });
}

// ─────────────────────────────────────────────────────────────────
// Tool factory for the chat route. `supabase` must be the
// user-scoped server client so RLS and auth.uid() apply.
// ─────────────────────────────────────────────────────────────────

export function buildTools({
  voyageKey,
  courseId,
  supabase,
}: {
  voyageKey: string;
  courseId: string;
  supabase: SupabaseClient;
}) {
  return {
    findRelevantContent: tool({
      description:
        "Search the course materials (textbooks, slides, lecture audio transcripts, past exams, notes, linked sources) for content relevant to a query. Returns excerpts with a prebuilt citation for each — cite them verbatim.",
      inputSchema: z.object({
        query: z.string().describe("The concept or question to search the course materials for."),
      }),
      execute: async ({ query }) => {
        const results = await retrieveChunks({ voyageKey, supabase, courseId, query });
        if (results.length === 0) {
          return { chunks: [], note: "No relevant course material found for this query." };
        }
        return {
          chunks: results.map(({ content, citation }) => ({ content, citation })),
        };
      },
    }),

    getWeakTopics: tool({
      description:
        "Get the topics this student has scored lowest on in past quizzes for this course, weakest first.",
      inputSchema: z.object({}),
      execute: async () => {
        const { data, error } = await supabase.rpc("get_weak_topics", {
          match_course_id: courseId,
        });
        if (error) throw new Error(`Weak-topics lookup failed: ${error.message}`);
        return {
          topics: (data ?? []) as { topic: string; avg_score: number; attempt_count: number }[],
        };
      },
    }),
  };
}
