"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { LiveResponse, LiveSession, LiveSlide, QaQuestion } from "@/lib/types/db";
import { pollCounts, wordCloudWeights, textResponses, quizLeaderboard } from "@/lib/live/aggregate";
import { goToSlide, setLocked, setQaStatus } from "../../actions";

export function PresentClient({ session, slides }: { session: LiveSession; slides: LiveSlide[] }) {
  const sorted = useMemo(() => [...slides].sort((a, b) => a.order - b.order), [slides]);
  const [currentSlideId, setCurrentSlideId] = useState(
    session.current_slide_id ?? sorted[0]?.id ?? null
  );
  const [locked, setLockedState] = useState(session.locked);
  const [responses, setResponses] = useState<LiveResponse[]>([]);
  const [qaQuestions, setQaQuestions] = useState<QaQuestion[]>([]);
  const [showQa, setShowQa] = useState(false);

  const currentSlide = sorted.find((s) => s.id === currentSlideId) ?? null;
  const currentIndex = sorted.findIndex((s) => s.id === currentSlideId);

  // Load existing responses for the current slide, then stream new ones in.
  useEffect(() => {
    if (!currentSlideId) return;
    const supabase = createClient();
    let cancelled = false;

    supabase
      .from("live_responses")
      .select("*")
      .eq("live_slide_id", currentSlideId)
      .then(({ data }) => {
        if (!cancelled) setResponses((data ?? []) as LiveResponse[]);
      });

    const channel = supabase
      .channel(`live_responses:${currentSlideId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "live_responses", filter: `live_slide_id=eq.${currentSlideId}` },
        (payload) => {
          setResponses((prev) => [...prev, payload.new as LiveResponse]);
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [currentSlideId]);

  // Q&A is session-wide (participants can ask anytime), not tied to the
  // current slide -- load once and stream changes for the session.
  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    supabase
      .from("qa_questions")
      .select("*")
      .eq("session_id", session.id)
      .then(({ data }) => {
        if (!cancelled) setQaQuestions((data ?? []) as QaQuestion[]);
      });

    const channel = supabase
      .channel(`qa_questions:${session.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_questions", filter: `session_id=eq.${session.id}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setQaQuestions((prev) => [...prev, payload.new as QaQuestion]);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as QaQuestion;
            setQaQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [session.id]);

  async function navigate(delta: number) {
    const next = sorted[currentIndex + delta];
    if (!next) return;
    setCurrentSlideId(next.id);
    setResponses([]);
    await goToSlide(session.id, next.id);
  }

  async function toggleLock() {
    const next = !locked;
    setLockedState(next);
    await setLocked(session.id, next);
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between text-sm">
        <Link href={`/studio/live/${session.id}`} className="hover:underline">
          ← Back to builder
        </Link>
        <span>
          Slide {currentIndex + 1} of {sorted.length}
        </span>
      </div>

      <div className="flex-1 rounded border border-black/10 p-8 dark:border-white/10">
        {currentSlide ? (
          <SlidePresentation slide={currentSlide} responses={responses} />
        ) : (
          <p className="text-black/50 dark:text-white/50">No slides in this session.</p>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          disabled={currentIndex <= 0}
          className="rounded border border-black/15 px-4 py-2 text-sm disabled:opacity-40 dark:border-white/20"
        >
          ← Previous
        </button>
        <button
          onClick={() => navigate(1)}
          disabled={currentIndex >= sorted.length - 1}
          className="rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-40"
        >
          Next →
        </button>
        <button
          onClick={toggleLock}
          className="rounded border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          {locked ? "Unlock voting" : "Lock voting"}
        </button>
        <span className="text-sm text-black/50 dark:text-white/50">{responses.length} responses</span>
        <button
          onClick={() => setShowQa((v) => !v)}
          className="ml-auto rounded border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          Q&amp;A ({qaQuestions.filter((q) => q.status !== "hidden").length})
        </button>
      </div>

      {showQa && (
        <QaModeration
          questions={qaQuestions}
          onStatusChange={(id, status) => {
            setQaQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, status } : q)));
            setQaStatus(id, status);
          }}
        />
      )}
    </div>
  );
}

function SlidePresentation({ slide, responses }: { slide: LiveSlide; responses: LiveResponse[] }) {
  const prompt = String(slide.config.prompt ?? "");

  if (slide.type === "poll") {
    const options = (slide.config.options as string[] | undefined) ?? [];
    const counts = pollCounts(responses, options.length);
    const max = Math.max(1, ...counts);
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">{prompt}</h1>
        <div className="flex flex-col gap-3">
          {options.map((option, i) => (
            <div key={i}>
              <div className="mb-1 flex justify-between text-sm">
                <span>{option}</span>
                <span>{counts[i]}</span>
              </div>
              <div className="h-6 rounded bg-black/5 dark:bg-white/5">
                <div
                  className="h-6 rounded bg-foreground transition-all"
                  style={{ width: `${(counts[i] / max) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (slide.type === "word_cloud") {
    const weights = wordCloudWeights(responses);
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">{prompt}</h1>
        <div className="flex flex-wrap items-center justify-center gap-3 py-8">
          {weights.map(({ word, count }) => (
            <span
              key={word}
              style={{ fontSize: `${14 + Math.min(count, 10) * 6}px` }}
              className="font-medium"
            >
              {word}
            </span>
          ))}
          {weights.length === 0 && <p className="text-black/50 dark:text-white/50">Waiting for responses…</p>}
        </div>
      </div>
    );
  }

  if (slide.type === "open_ended") {
    const texts = textResponses(responses);
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">{prompt}</h1>
        <ul className="flex flex-col gap-2">
          {texts.map((t, i) => (
            <li key={i} className="rounded bg-black/5 p-3 text-sm dark:bg-white/5">
              {t}
            </li>
          ))}
          {texts.length === 0 && <p className="text-black/50 dark:text-white/50">Waiting for responses…</p>}
        </ul>
      </div>
    );
  }

  if (slide.type === "quiz") {
    const leaderboard = quizLeaderboard(responses);
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">{prompt}</h1>
        <ol className="flex flex-col gap-2">
          {leaderboard.map((entry, i) => (
            <li key={entry.participantToken} className="flex justify-between rounded bg-black/5 p-3 text-sm dark:bg-white/5">
              <span>
                {i + 1}. {entry.displayName || "Anonymous"}
              </span>
              <span>{entry.correctCount} correct</span>
            </li>
          ))}
          {leaderboard.length === 0 && <p className="text-black/50 dark:text-white/50">Waiting for answers…</p>}
        </ol>
      </div>
    );
  }

  if (slide.type === "qa_board") {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold">{prompt}</h1>
        <p className="text-sm text-black/50 dark:text-white/50">
          Participants can submit and upvote questions from the Q&amp;A panel below at any time.
        </p>
      </div>
    );
  }

  return null;
}

function QaModeration({
  questions,
  onStatusChange,
}: {
  questions: QaQuestion[];
  onStatusChange: (id: string, status: "approved" | "hidden" | "answered" | "pending") => void;
}) {
  const sorted = [...questions].sort((a, b) => b.upvotes - a.upvotes);
  return (
    <div className="rounded border border-black/10 p-4 dark:border-white/10">
      <h2 className="mb-3 text-sm font-medium">Q&amp;A moderation</h2>
      <ul className="flex flex-col gap-2">
        {sorted.map((q) => (
          <li key={q.id} className="flex items-center justify-between gap-3 text-sm">
            <span className={q.status === "hidden" ? "text-black/30 line-through dark:text-white/30" : ""}>
              {q.text} <span className="text-black/40 dark:text-white/40">({q.upvotes} upvotes)</span>
            </span>
            <div className="flex gap-2 text-xs">
              <button onClick={() => onStatusChange(q.id, "answered")} className="hover:underline">
                Mark answered
              </button>
              <button onClick={() => onStatusChange(q.id, "hidden")} className="hover:underline">
                Hide
              </button>
            </div>
          </li>
        ))}
        {sorted.length === 0 && <p className="text-black/50 dark:text-white/50">No questions yet.</p>}
      </ul>
    </div>
  );
}
