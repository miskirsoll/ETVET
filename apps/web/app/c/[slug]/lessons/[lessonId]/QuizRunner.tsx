"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { Lesson, Question, QuestionChoice } from "@/lib/types/db";
import { submitQuizAction } from "@/app/c/actions";

function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function QuizRunner({
  courseId,
  lesson,
  questions,
  choicesByQuestion,
  nextHref,
}: {
  courseId: string;
  lesson: Lesson;
  questions: Question[];
  choicesByQuestion: Record<string, QuestionChoice[]>;
  nextHref: string | null;
}) {
  const activeQuestions = useMemo(() => {
    const sorted = [...questions].sort((a, b) => a.order - b.order);
    if (lesson.randomize_questions) {
      const picked = shuffle(sorted);
      return lesson.draw_count ? picked.slice(0, lesson.draw_count) : picked;
    }
    return sorted;
  }, [questions, lesson.randomize_questions, lesson.draw_count]);

  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [result, setResult] = useState<{ score: number; passed: boolean } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);

  function toggle(question: Question, choiceId: string) {
    setAnswers((prev) => {
      const current = prev[question.id] ?? [];
      if (question.type === "multiple_response") {
        const next = current.includes(choiceId)
          ? current.filter((id) => id !== choiceId)
          : [...current, choiceId];
        return { ...prev, [question.id]: next };
      }
      return { ...prev, [question.id]: [choiceId] };
    });
  }

  async function submit() {
    setSubmitting(true);
    const elapsed = Math.round((Date.now() - (startedAt.current ?? Date.now())) / 1000);
    const payload: Record<string, string[]> = {};
    for (const q of activeQuestions) payload[q.id] = answers[q.id] ?? [];
    const res = await submitQuizAction(courseId, lesson.id, payload, elapsed);
    setResult(res);
    setSubmitting(false);
  }

  if (result) {
    return (
      <div className="flex flex-col gap-4">
        <div
          className={`rounded p-4 text-sm ${
            result.passed
              ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
              : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
          }`}
        >
          Score: {result.score}% — {result.passed ? "Passed" : "Not passed"} (needs{" "}
          {lesson.pass_threshold}%)
        </div>
        <div className="flex gap-3">
          {!result.passed && (
            <button
              onClick={() => {
                setResult(null);
                setAnswers({});
                startedAt.current = Date.now();
              }}
              className="rounded border border-black/15 px-4 py-2 text-sm dark:border-white/20"
            >
              Retry
            </button>
          )}
          {result.passed && nextHref && (
            <Link href={nextHref} className="rounded bg-foreground px-4 py-2 text-sm text-background">
              Next lesson →
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {lesson.time_limit_seconds && (
        <QuizTimer
          seconds={lesson.time_limit_seconds}
          onExpire={() => {
            if (!submitting) submit();
          }}
        />
      )}
      <ol className="flex flex-col gap-5">
        {activeQuestions.map((question, index) => (
          <li key={question.id} className="rounded border border-black/10 p-4 dark:border-white/10">
            <p className="mb-3 font-medium">
              {index + 1}. {question.prompt}
            </p>
            <ul className="flex flex-col gap-2 text-sm">
              {(choicesByQuestion[question.id] ?? []).map((choice) => (
                <li key={choice.id} className="flex items-center gap-2">
                  <input
                    type={question.type === "multiple_response" ? "checkbox" : "radio"}
                    name={`q-${question.id}`}
                    checked={(answers[question.id] ?? []).includes(choice.id)}
                    onChange={() => toggle(question, choice.id)}
                  />
                  <span>{choice.text}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <button
        onClick={submit}
        disabled={submitting}
        className="self-start rounded bg-foreground px-5 py-2.5 text-sm text-background disabled:opacity-50"
      >
        {submitting ? "Submitting…" : "Submit"}
      </button>
    </div>
  );
}

function QuizTimer({ seconds, onExpire }: { seconds: number; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(seconds);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(interval);
          onExpire();
          return 0;
        }
        return r - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const minutes = Math.floor(remaining / 60);
  const secs = remaining % 60;
  return (
    <p className="text-sm font-medium text-black/60 dark:text-white/60">
      Time remaining: {minutes}:{secs.toString().padStart(2, "0")}
    </p>
  );
}
