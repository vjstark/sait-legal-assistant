"use client";

/*
 * Quiz panel — exam-style questions graded with feedback.
 * Same request/response flow as before; only the presentation changed.
 */

import { useState } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  CardBody,
  Label,
  Spinner,
  Textarea,
  cn,
} from "@/components/ui";
import {
  errorText,
  FeedbackButtons,
  missingKeyNames,
  MissingKeysNotice,
  postJson,
} from "./shared";

type QuizQuestion = {
  question: string;
  topic: string;
  modelAnswer: string;
  sourceCitation: string;
  fromPastExam: boolean;
};

type QuizGrade = { correct: boolean; score: number; explanation: string };

export function QuizPanel({ courseId }: { courseId: string }) {
  const [question, setQuestion] = useState<QuizQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [grade, setGrade] = useState<QuizGrade | null>(null);
  const [loading, setLoading] = useState<"question" | "grade" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [missingKeys, setMissingKeys] = useState<string[]>([]);

  const newQuestion = async () => {
    const missing = missingKeyNames();
    if (missing.length > 0) {
      setMissingKeys(missing);
      return;
    }
    setMissingKeys([]);
    setError(null);
    setGrade(null);
    setAnswer("");
    setQuestion(null);
    setLoading("question");
    try {
      setQuestion(await postJson<QuizQuestion>("/api/quiz/question", { courseId }));
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(null);
    }
  };

  const submitAnswer = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!question || !answer.trim()) return;
    setError(null);
    setLoading("grade");
    try {
      setGrade(
        await postJson<QuizGrade>("/api/quiz/grade", {
          courseId,
          question: question.question,
          topic: question.topic,
          modelAnswer: question.modelAnswer,
          studentAnswer: answer.trim(),
        }),
      );
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(null);
    }
  };

  const pct = grade ? Math.round(grade.score * 100) : 0;
  const scoreColor =
    pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-red-600";

  return (
    <div className="space-y-4 py-4">
      {missingKeys.length > 0 && <MissingKeysNotice missing={missingKeys} />}
      {error && <Alert tone="error">{error}</Alert>}

      {!question && (
        <Card className="border-dashed">
          <CardBody className="flex flex-col items-center gap-4 py-12 text-center">
            <p className="max-w-md font-serif text-lg text-brand-900">
              Ready when you are
            </p>
            <p className="max-w-md text-sm text-slate-500">
              Get an exam-style question, drawn from your weaker topics when you
              have quiz history.
            </p>
            <Button
              type="button"
              disabled={loading === "question"}
              onClick={() => void newQuestion()}
            >
              {loading === "question" ? (
                <>
                  <Spinner className="border-white/30 border-t-white" />
                  Writing a question…
                </>
              ) : (
                "New question"
              )}
            </Button>
          </CardBody>
        </Card>
      )}

      {question && (
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="brand">{question.topic}</Badge>
              {question.fromPastExam && <Badge tone="accent">Past exam</Badge>}
            </div>
            <p className="mt-4 whitespace-pre-wrap break-words font-serif text-lg leading-relaxed text-brand-900">
              {question.question}
            </p>
            <p className="mt-4 text-xs text-slate-400">({question.sourceCitation})</p>
          </CardBody>
        </Card>
      )}

      {question && !grade && (
        <form onSubmit={(event) => void submitAnswer(event)} className="space-y-3">
          <div>
            <Label htmlFor="quiz-answer">Your answer</Label>
            <Textarea
              id="quiz-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              rows={6}
              placeholder="Write your answer…"
              disabled={loading === "grade"}
            />
          </div>
          <div>
            <Button type="submit" disabled={loading === "grade" || !answer.trim()}>
              {loading === "grade" ? (
                <>
                  <Spinner className="border-white/30 border-t-white" />
                  Grading…
                </>
              ) : (
                "Submit answer"
              )}
            </Button>
          </div>
        </form>
      )}

      {grade && question && (
        <Card>
          <CardBody>
            <div className="flex flex-wrap items-center gap-4">
              <p className={cn("font-serif text-5xl", scoreColor)}>{pct}%</p>
              <Badge tone={grade.correct ? "success" : "danger"}>
                {grade.correct ? "Correct" : "Not quite"}
              </Badge>
            </div>
            <p className="mt-4 max-w-prose whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
              {grade.explanation}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <FeedbackButtons courseId={courseId} mode="quiz" topic={question.topic} />
              <Button
                type="button"
                variant="secondary"
                disabled={loading === "question"}
                onClick={() => void newQuestion()}
              >
                Next question
              </Button>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
