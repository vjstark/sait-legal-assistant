// Voyage AI embeddings — called directly over REST so the BYOK key can be
// passed per-request without ever touching an env var or database.
// voyage-law-2: legal-domain model, 1024-dim output (matches vector(1024)
// in the schema), 16K-token context. Free grant: 200M tokens.

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = "voyage-law-2";

// Voyage caps a single request at 128 inputs; stay under it.
const BATCH_SIZE = 96;

export class VoyageError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
    this.name = "VoyageError";
  }
}

/** Resolve the Voyage key from the request header, falling back to an admin-funded env key. */
export function resolveVoyageKey(headers: Headers): string | null {
  return headers.get("x-voyage-key") ?? process.env.VOYAGE_API_KEY ?? null;
}

async function requestEmbeddings(
  apiKey: string,
  input: string[],
  inputType: "document" | "query",
): Promise<number[][]> {
  const response = await fetch(VOYAGE_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input, model: MODEL, input_type: inputType }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const hint =
      response.status === 401
        ? "Your Voyage API key was rejected — check it in Settings → API keys."
        : response.status === 429
          ? "Voyage rate limit hit — wait a moment and try again."
          : detail.slice(0, 300);
    throw new VoyageError(`Voyage embeddings failed (${response.status}): ${hint}`, response.status);
  }

  const json = (await response.json()) as {
    data: { index: number; embedding: number[] }[];
  };
  // Voyage returns entries with an index; sort to be safe.
  return json.data
    .slice()
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/** Embed document chunks for storage (batched under Voyage's per-request cap). */
export async function embedDocuments(
  apiKey: string,
  texts: string[],
): Promise<number[][]> {
  const all: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    all.push(
      ...(await requestEmbeddings(apiKey, texts.slice(i, i + BATCH_SIZE), "document")),
    );
  }
  return all;
}

/** Embed a search query (input_type "query" — Voyage tunes these differently). */
export async function embedQuery(apiKey: string, text: string): Promise<number[]> {
  const [embedding] = await requestEmbeddings(apiKey, [text], "query");
  return embedding;
}
