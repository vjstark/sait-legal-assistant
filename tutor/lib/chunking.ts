// Shared text chunker for the ingestion pipelines (PDF pages, pasted notes,
// web articles, audio transcripts).
//
// Why chunking exists: embedding models and retrieval work best on passages of
// a few hundred tokens — big enough to carry a complete thought, small enough
// that a search hit is precise. We aim for roughly 400–512 tokens per chunk.
// We don't have a real tokenizer here (and don't need one); the standard
// approximation is 1 token ≈ 4 characters, so the target is ~1600–2000 chars.
//
// Consecutive chunks overlap by ~15% so an idea that straddles a chunk
// boundary still appears intact in at least one chunk.
//
// No dependencies — plain string handling only.

/** One piece of source material, e.g. a PDF page or a transcript segment. */
export interface Segment {
  text: string;
  /** 1-based page number (PDFs) — carried onto chunks for citations. */
  pageNumber?: number;
  /** Start time in whole seconds (audio) — carried onto chunks for citations. */
  timestampSeconds?: number;
}

/** One chunk ready to be embedded and stored. */
export interface Chunk {
  content: string;
  /** Page number of the segment where this chunk STARTS. */
  pageNumber?: number;
  /** Timestamp of the segment where this chunk STARTS. */
  timestampSeconds?: number;
}

export interface ChunkOptions {
  /** Hard ceiling per chunk, in characters. Default 2000 (~500 tokens). */
  maxChars?: number;
  /** Characters of trailing text repeated at the start of the next chunk. Default 300 (~15%). */
  overlapChars?: number;
}

// Internal unit of packing: a sentence (or paragraph fragment) plus the
// page/timestamp of the segment it came from, and whether it started a new
// paragraph (so we can rejoin with a blank line instead of a space).
interface Piece {
  text: string;
  pageNumber?: number;
  timestampSeconds?: number;
  startsParagraph: boolean;
}

/**
 * Split an array of segments into overlapping chunks of ~1600–2000 characters.
 *
 * - Splits on paragraph and sentence boundaries where possible, never mid-word
 *   (except for pathological unbroken runs longer than a whole chunk).
 * - Each chunk inherits the pageNumber/timestampSeconds of the segment where
 *   its first sentence begins.
 * - Empty / whitespace-only segments are skipped.
 */
export function chunkSegments(
  segments: Segment[],
  options: ChunkOptions = {},
): Chunk[] {
  const maxChars = options.maxChars ?? 2000;
  const overlapChars = options.overlapChars ?? Math.round(maxChars * 0.15);

  // Step 1: break every segment down into tagged sentence-sized pieces.
  const pieces: Piece[] = [];
  for (const segment of segments) {
    if (!segment.text || segment.text.trim().length === 0) continue; // skip empties

    // Paragraphs first (double newline), then sentences within each paragraph.
    const paragraphs = segment.text.split(/\n\s*\n/);
    for (const paragraph of paragraphs) {
      const trimmed = paragraph.trim();
      if (trimmed.length === 0) continue;

      let first = true;
      for (const sentence of splitIntoSentences(trimmed, maxChars)) {
        pieces.push({
          text: sentence,
          pageNumber: segment.pageNumber,
          timestampSeconds: segment.timestampSeconds,
          startsParagraph: first,
        });
        first = false;
      }
    }
  }

  if (pieces.length === 0) return [];

  // Step 2: greedily pack pieces into chunks up to maxChars, carrying a small
  // tail of the previous chunk forward as overlap.
  const chunks: Chunk[] = [];
  let buffer: Piece[] = [];
  let bufferLen = 0;
  // Overlap pieces are repeats — a chunk that would contain ONLY repeats
  // (possible at the very end) must not be emitted, so we track how many of
  // the buffer's leading pieces are carried-over overlap.
  let overlapCount = 0;

  const emit = () => {
    const fresh = buffer.slice(overlapCount);
    if (fresh.length === 0) return; // nothing new — don't emit a pure repeat
    chunks.push({
      content: joinPieces(buffer),
      pageNumber: buffer[0].pageNumber,
      timestampSeconds: buffer[0].timestampSeconds,
    });
  };

  for (const piece of pieces) {
    // Would this piece push the chunk past the ceiling? Close the chunk first
    // (an over-long single piece was already word-split in step 1, so a
    // non-empty buffer is guaranteed to hold at least one full piece).
    if (bufferLen > 0 && bufferLen + piece.text.length + 1 > maxChars) {
      emit();

      // Build the overlap: whole pieces from the end of the finished chunk,
      // newest-first, as long as they fit in the overlap budget.
      const tail: Piece[] = [];
      let tailLen = 0;
      for (let i = buffer.length - 1; i >= 0; i--) {
        const candidate = buffer[i];
        if (tailLen + candidate.text.length > overlapChars) break;
        tail.unshift(candidate);
        tailLen += candidate.text.length + 1;
      }
      buffer = tail;
      bufferLen = tailLen;
      overlapCount = tail.length;
    }
    buffer.push(piece);
    bufferLen += piece.text.length + 1; // +1 for the joining space
  }

  // Whatever is left is the final chunk (if it contains anything new).
  if (buffer.length > 0) emit();

  return chunks;
}

/**
 * Split a paragraph into sentences. Falls back to word-boundary slices for
 * any "sentence" longer than a whole chunk (tables, un-punctuated OCR text…)
 * so the packer never has to cut mid-word.
 */
function splitIntoSentences(paragraph: string, maxChars: number): string[] {
  // Split after ., !, ? or … (plus any closing quote/bracket) followed by
  // whitespace. Good enough for prose; imperfect around abbreviations, which
  // only means a slightly early/late boundary — harmless for our purposes.
  const rough = paragraph
    .split(/(?<=[.!?…]["')\]]?)\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const sentences: string[] = [];
  for (const sentence of rough) {
    if (sentence.length <= maxChars) {
      sentences.push(sentence);
      continue;
    }
    // Oversized: slice at word boundaries into pieces under maxChars.
    let remaining = sentence;
    while (remaining.length > maxChars) {
      // Find the last space inside the window; if there is none (one giant
      // unbroken token), hard-cut — the only case where mid-"word" is allowed.
      let cut = remaining.lastIndexOf(" ", maxChars);
      if (cut <= 0) cut = maxChars;
      sentences.push(remaining.slice(0, cut).trim());
      remaining = remaining.slice(cut).trim();
    }
    if (remaining.length > 0) sentences.push(remaining);
  }
  return sentences;
}

/** Rejoin pieces: blank line where a paragraph began, single space otherwise. */
function joinPieces(pieces: Piece[]): string {
  let out = "";
  for (let i = 0; i < pieces.length; i++) {
    if (i > 0) out += pieces[i].startsParagraph ? "\n\n" : " ";
    out += pieces[i].text;
  }
  return out;
}
