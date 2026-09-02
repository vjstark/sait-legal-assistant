import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Alert, Badge, Card, CardBody, PageHeader, cn } from "@/components/ui";

// Supabase free-tier ceilings this project is sized against.
const FREE_DB_BYTES = 500 * 1024 * 1024; // 500MB Postgres
const FREE_STORAGE_BYTES = 1024 * 1024 * 1024; // 1GB file storage

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const percent = Math.min(100, (used / limit) * 100);
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div
        className={cn(
          "h-full rounded-full",
          percent > 0 && "min-w-[3px]",
          percent > 85
            ? "bg-red-500"
            : percent > 60
              ? "bg-amber-500"
              : "bg-emerald-500",
        )}
        // Width is data-driven, so it can't be a static utility class.
        style={{ width: `${percent}%` }}
      />
    </div>
  );
}

export default async function UsagePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") redirect("/courses");

  const { data: usage, error } = await supabase.rpc("get_admin_usage");

  if (error || !usage) {
    return (
      <>
        <PageHeader title="Free-tier usage" />
        <Alert tone="error">
          Couldn&apos;t load usage — has migration 0004_usage.sql been run in
          the Supabase SQL Editor? ({error?.message})
        </Alert>
      </>
    );
  }

  const { storage_bytes, db_bytes, chunk_count, document_count } = usage as {
    storage_bytes: number;
    db_bytes: number;
    chunk_count: number;
    document_count: number;
  };

  return (
    <>
      <PageHeader
        title="Free-tier usage"
        description="How much of the Supabase free-tier ceilings this project is using."
      />

      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="brand">{document_count} documents</Badge>
          <Badge tone="brand">
            {chunk_count.toLocaleString()} searchable chunks
          </Badge>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardBody className="space-y-3">
              <h2 className="text-lg font-semibold">Database</h2>
              <p>
                <span className="font-serif text-2xl font-semibold text-brand-900">
                  {formatBytes(db_bytes)}
                </span>{" "}
                <span className="text-sm text-slate-500">of 500 MB</span>
              </p>
              <UsageBar used={db_bytes} limit={FREE_DB_BYTES} />
              <p className="text-sm text-slate-500">
                Mostly embeddings — roughly 6–7 KB per chunk. If this nears the
                limit, archive a finished semester&apos;s courses (export +
                delete their chunks).
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-3">
              <h2 className="text-lg font-semibold">File storage</h2>
              <p>
                <span className="font-serif text-2xl font-semibold text-brand-900">
                  {formatBytes(storage_bytes)}
                </span>{" "}
                <span className="text-sm text-slate-500">of 1 GB</span>
              </p>
              <UsageBar used={storage_bytes} limit={FREE_STORAGE_BYTES} />
              <p className="text-sm text-slate-500">
                PDFs and pasted notes. Lecture audio doesn&apos;t accumulate
                here — it is deleted automatically after transcription.
              </p>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
