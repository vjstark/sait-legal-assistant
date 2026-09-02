import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";

function formatPercent(score: number) {
  return `${Math.round(score * 100)}%`;
}

function scoreTone(score: number): "success" | "warning" | "danger" {
  if (score >= 0.8) return "success";
  if (score >= 0.6) return "warning";
  return "danger";
}

const BAR_FILL: Record<"success" | "warning" | "danger", string> = {
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

export default async function ProgressPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const { courseId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: course } = await supabase
    .from("courses")
    .select("id, name")
    .eq("id", courseId)
    .single();
  if (!course) notFound();

  // All three queries are RLS-scoped to the signed-in student's own rows.
  const [{ data: topics }, { data: attempts }, { data: reviews }] =
    await Promise.all([
      supabase.rpc("get_weak_topics", { match_course_id: courseId }),
      supabase
        .from("quiz_attempts")
        .select("id, question, score, topic, ai_feedback, created_at")
        .eq("course_id", courseId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("flashcard_reviews")
        .select("topic, self_rating")
        .eq("course_id", courseId),
    ]);

  const weakTopics = (topics ?? []) as {
    topic: string;
    avg_score: number;
    attempt_count: number;
  }[];

  // Flashcard self-ratings, tallied per topic ("again"/"hard" signal weakness).
  const reviewsByTopic = new Map<
    string,
    { total: number; struggling: number }
  >();
  for (const review of reviews ?? []) {
    const key = review.topic ?? "(untagged)";
    const entry = reviewsByTopic.get(key) ?? { total: 0, struggling: 0 };
    entry.total += 1;
    if (review.self_rating === "again" || review.self_rating === "hard") {
      entry.struggling += 1;
    }
    reviewsByTopic.set(key, entry);
  }

  return (
    <>
      <PageHeader
        title="Your progress"
        description={course.name}
        backHref={`/courses/${courseId}`}
        backLabel={course.name}
      />

      <section className="mb-8">
        <h2 className="mb-3 text-xl">Strengths &amp; weaknesses by topic</h2>
        {weakTopics.length ? (
          <Card>
            <ul className="divide-y divide-line">
              {weakTopics.map((topic) => {
                const score = Number(topic.avg_score);
                const tone = scoreTone(score);
                const percent = Math.max(0, Math.min(100, Math.round(score * 100)));
                return (
                  <li key={topic.topic} className="px-5 py-4 sm:px-6">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium text-slate-800">
                        {topic.topic}
                      </span>
                      {tone === "danger" && (
                        <Badge tone="danger">needs review</Badge>
                      )}
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div
                        role="img"
                        aria-label={`Average quiz score ${percent}%`}
                        className="h-2 w-full max-w-xs overflow-hidden rounded-full bg-slate-100"
                      >
                        <div
                          className={`h-2 rounded-full ${BAR_FILL[tone]}`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                      <span className="whitespace-nowrap text-sm text-slate-500">
                        {formatPercent(score)} · {topic.attempt_count}{" "}
                        {topic.attempt_count === 1 ? "attempt" : "attempts"}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        ) : (
          <EmptyState
            title="No quiz attempts yet"
            description={
              <>
                Try{" "}
                <Link
                  href={`/courses/${courseId}/chat`}
                  className="text-brand-700 underline hover:text-brand-800"
                >
                  Quiz me
                </Link>{" "}
                and your strengths and weaknesses will show up here (and steer
                future sessions).
              </>
            }
          />
        )}
      </section>

      {reviewsByTopic.size > 0 && (
        <section className="mb-8">
          <h2 className="mb-3 text-xl">Flashcard reviews</h2>
          <Card>
            <ul className="divide-y divide-line">
              {[...reviewsByTopic.entries()].map(([topic, entry]) => (
                <li
                  key={topic}
                  className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 sm:px-6"
                >
                  <span className="font-medium text-slate-800">{topic}</span>
                  <span className="text-sm text-slate-500">
                    {entry.total} reviewed
                    {entry.struggling > 0
                      ? ` · ${entry.struggling} marked again/hard`
                      : ""}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-xl">Recent quiz history</h2>
        {attempts?.length ? (
          <Card>
            <ol className="divide-y divide-line">
              {attempts.map((attempt) => (
                <li key={attempt.id} className="px-5 py-4 sm:px-6">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={scoreTone(Number(attempt.score))}>
                      {formatPercent(Number(attempt.score))}
                    </Badge>
                    {attempt.topic && <Badge tone="brand">{attempt.topic}</Badge>}
                    <span className="text-xs text-slate-500">
                      {new Date(attempt.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-800">
                    {attempt.question}
                  </p>
                  {attempt.ai_feedback && (
                    <p className="mt-1 text-xs text-slate-500">
                      {attempt.ai_feedback}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          </Card>
        ) : (
          <EmptyState
            title="No quiz attempts yet"
            description="Your recent quiz answers and feedback will appear here."
          />
        )}
      </section>
    </>
  );
}
