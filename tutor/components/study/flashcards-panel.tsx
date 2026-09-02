"use client";

/*
 * Flashcards panel — generate a set, flip through it, rate each card.
 * Same request flow and recordFlashcardReview wiring; presentation only.
 */

import { useState } from "react";
import {
  Alert,
  Button,
  Badge,
  Card,
  CardBody,
  Input,
  Label,
  Select,
  Spinner,
  cn,
} from "@/components/ui";
import { recordFlashcardReview } from "@/app/actions/feedback";
import {
  errorText,
  missingKeyNames,
  MissingKeysNotice,
  postJson,
} from "./shared";

type Flashcard = { front: string; back: string; topic: string };

type SelfRating = "again" | "hard" | "good" | "easy";

const RATINGS: { id: SelfRating; label: string; classes: string }[] = [
  {
    id: "again",
    label: "Again",
    classes:
      "border-red-200 text-red-700 hover:bg-red-50 focus-visible:outline-red-600",
  },
  {
    id: "hard",
    label: "Hard",
    classes:
      "border-amber-300 text-amber-700 hover:bg-amber-50 focus-visible:outline-amber-600",
  },
  {
    id: "good",
    label: "Good",
    classes:
      "border-brand-200 text-brand-700 hover:bg-brand-50 focus-visible:outline-brand-800",
  },
  {
    id: "easy",
    label: "Easy",
    classes:
      "border-emerald-200 text-emerald-700 hover:bg-emerald-50 focus-visible:outline-emerald-600",
  },
];

export function FlashcardsPanel({ courseId }: { courseId: string }) {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(8);
  const [cards, setCards] = useState<Flashcard[] | null>(null);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingKeys, setMissingKeys] = useState<string[]>([]);

  const generate = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const missing = missingKeyNames();
    if (missing.length > 0) {
      setMissingKeys(missing);
      return;
    }
    setMissingKeys([]);
    setError(null);
    setCards(null);
    setDone(false);
    setIndex(0);
    setRevealed(false);
    setLoading(true);
    try {
      const result = await postJson<{ cards: Flashcard[] }>("/api/flashcards", {
        courseId,
        count,
        topic: topic.trim() || undefined,
      });
      if (!result.cards?.length) {
        setError("No cards came back — try a different topic.");
      } else {
        setCards(result.cards);
      }
    } catch (err) {
      setError(errorText(err));
    } finally {
      setLoading(false);
    }
  };

  const rate = (selfRating: SelfRating) => {
    if (!cards) return;
    const card = cards[index];
    void recordFlashcardReview({
      courseId,
      cardFront: card.front,
      cardBack: card.back,
      topic: card.topic,
      selfRating,
    });
    if (index + 1 < cards.length) {
      setIndex(index + 1);
      setRevealed(false);
    } else {
      setDone(true);
    }
  };

  if (!cards || done) {
    return (
      <div className="space-y-4 py-4">
        {done && (
          <Card>
            <CardBody className="py-8 text-center">
              <p className="text-balance font-serif text-xl text-brand-900">
                That’s all {cards?.length} cards — nice work.
              </p>
              <p className="mt-1.5 text-sm text-slate-500">
                Generate another set to keep going.
              </p>
            </CardBody>
          </Card>
        )}
        {missingKeys.length > 0 && <MissingKeysNotice missing={missingKeys} />}
        {error && <Alert tone="error">{error}</Alert>}

        <Card>
          <CardBody>
            <form
              onSubmit={(event) => void generate(event)}
              className="flex flex-col gap-4 sm:flex-row sm:items-end"
            >
              <div className="min-w-0 flex-1">
                <Label htmlFor="flashcards-topic">
                  Topic <span className="font-normal text-slate-400">(optional)</span>
                </Label>
                <Input
                  id="flashcards-topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="e.g. Consideration, negligence, remedies…"
                  disabled={loading}
                />
              </div>
              <div className="w-full sm:w-24">
                <Label htmlFor="flashcards-count">Cards</Label>
                <Select
                  id="flashcards-count"
                  value={count}
                  onChange={(event) => setCount(Number(event.target.value))}
                  disabled={loading}
                >
                  {[4, 6, 8, 10, 12, 15].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit" disabled={loading} className="sm:shrink-0">
                {loading ? (
                  <>
                    <Spinner className="border-white/30 border-t-white" />
                    Generating…
                  </>
                ) : done || cards ? (
                  "New set"
                ) : (
                  "Generate flashcards"
                )}
              </Button>
            </form>
          </CardBody>
        </Card>
      </div>
    );
  }

  const card = cards[index];
  return (
    <div className="mx-auto w-full max-w-xl space-y-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm tabular-nums text-slate-500">
          Card {index + 1} of {cards.length}
        </p>
        <Badge tone="brand">{card.topic}</Badge>
      </div>
      <progress
        value={index + 1}
        max={cards.length}
        aria-label={`Progress: card ${index + 1} of ${cards.length}`}
        className="h-1 w-full appearance-none overflow-hidden rounded-full bg-brand-100 [&::-moz-progress-bar]:bg-brand-700 [&::-webkit-progress-bar]:bg-brand-100 [&::-webkit-progress-value]:bg-brand-700"
      />

      <button
        type="button"
        aria-pressed={revealed}
        onClick={() => setRevealed(!revealed)}
        className="group block w-full touch-manipulation rounded-card text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-800 [perspective:1200px]"
      >
        <span
          className={cn(
            "grid min-h-56 w-full [transform-style:preserve-3d] motion-safe:transition-transform motion-safe:duration-500",
            revealed && "[transform:rotateY(180deg)]",
          )}
        >
          <span
            aria-hidden={revealed}
            className="flex flex-col items-center justify-center gap-3 rounded-card border border-line bg-surface p-6 shadow-[0_1px_2px_rgb(20_35_57/0.04)] transition-colors [backface-visibility:hidden] [grid-area:1/1] group-hover:border-brand-200"
          >
            <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
              Front · click to reveal
            </span>
            <span className="whitespace-pre-wrap break-words text-balance text-center font-serif text-xl leading-relaxed text-brand-900">
              {card.front}
            </span>
          </span>
          <span
            aria-hidden={!revealed}
            className="flex flex-col items-center justify-center gap-3 rounded-card border border-brand-200 bg-brand-50 p-6 shadow-[0_1px_2px_rgb(20_35_57/0.04)] transition-colors [backface-visibility:hidden] [grid-area:1/1] [transform:rotateY(180deg)] group-hover:border-brand-600/40"
          >
            <span className="text-[11px] font-medium uppercase tracking-wider text-brand-600">
              Back · click to hide
            </span>
            <span className="max-w-prose whitespace-pre-wrap break-words text-center text-[15px] leading-7 text-brand-900">
              {card.back}
            </span>
          </span>
        </span>
      </button>

      {revealed ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {RATINGS.map((rating) => (
            <button
              key={rating.id}
              type="button"
              onClick={() => rate(rating.id)}
              className={cn(
                "touch-manipulation rounded-lg border bg-surface px-4 py-2 text-sm font-medium transition-colors",
                "focus-visible:outline-2 focus-visible:outline-offset-2",
                rating.classes,
              )}
            >
              {rating.label}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-slate-500">
          Try to answer before revealing, then rate how it went.
        </p>
      )}
    </div>
  );
}
