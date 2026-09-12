"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { LiveSession, LiveSessionStatus, LiveSlide, QaQuestion } from "@/lib/types/db";
import {
  submitPollResponse,
  submitTextResponse,
  submitQuizAnswer,
  submitQuestion,
  upvoteQuestion,
} from "../../actions";

export function PlayClient({ session, slides }: { session: LiveSession; slides: LiveSlide[] }) {
  const [currentSlideId, setCurrentSlideId] = useState(session.current_slide_id);
  const [locked, setLockedState] = useState(session.locked);
  const [status, setStatus] = useState<LiveSessionStatus>(session.status);
  const [submittedSlideIds, setSubmittedSlideIds] = useState<Set<string>>(new Set());
  const [showQa, setShowQa] = useState(false);

  const currentSlide = slides.find((s) => s.id === currentSlideId) ?? null;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`live_sessions:${session.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "live_sessions", filter: `id=eq.${session.id}` },
        (payload) => {
          const updated = payload.new as LiveSession;
          setCurrentSlideId(updated.current_slide_id);
          setLockedState(updated.locked);
          setStatus(updated.status);
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [session.id]);

  if (status === "ended") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 text-center">
        <h1 className="text-xl font-semibold">Session ended</h1>
        <p className="mt-2 text-sm text-black/60 dark:text-white/60">Thanks for participating!</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col gap-6 px-6 py-8">
      <div className="flex items-center justify-between text-sm">
        <h1 className="font-semibold">{session.title}</h1>
        <button onClick={() => setShowQa((v) => !v)} className="hover:underline">
          {showQa ? "Back to slide" : "Q&A"}
        </button>
      </div>

      {showQa ? (
        <QaPanel sessionId={session.id} />
      ) : currentSlide ? (
        <SlideResponse
          key={currentSlide.id}
          slide={currentSlide}
          sessionId={session.id}
          locked={locked}
          submitted={submittedSlideIds.has(currentSlide.id)}
          onSubmitted={() => setSubmittedSlideIds((prev) => new Set(prev).add(currentSlide.id))}
        />
      ) : (
        <p className="text-center text-black/50 dark:text-white/50">
          Waiting for the presenter to start a slide…
        </p>
      )}
    </main>
  );
}

function SlideResponse({
  slide,
  sessionId,
  locked,
  submitted,
  onSubmitted,
}: {
  slide: LiveSlide;
  sessionId: string;
  locked: boolean;
  submitted: boolean;
  onSubmitted: () => void;
}) {
  const prompt = String(slide.config.prompt ?? "");
  const shownAt = useRef<number | null>(null);
  useEffect(() => {
    shownAt.current = Date.now();
  }, []);

  if (locked) {
    return (
      <div className="rounded border border-black/10 p-6 text-center dark:border-white/10">
        <h2 className="mb-2 text-lg font-medium">{prompt}</h2>
        <p className="text-sm text-black/50 dark:text-white/50">Voting is currently locked.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="rounded border border-black/10 p-6 text-center dark:border-white/10">
        <h2 className="mb-2 text-lg font-medium">{prompt}</h2>
        <p className="text-sm text-green-700 dark:text-green-400">Response submitted — thanks!</p>
      </div>
    );
  }

  if (slide.type === "poll") {
    const options = (slide.config.options as string[] | undefined) ?? [];
    const multi = !!slide.config.multiple_response;
    return (
      <PollForm
        prompt={prompt}
        options={options}
        multi={multi}
        onSubmit={async (indices) => {
          await submitPollResponse(slide.id, sessionId, indices);
          onSubmitted();
        }}
      />
    );
  }

  if (slide.type === "word_cloud" || slide.type === "open_ended") {
    return (
      <TextForm
        prompt={prompt}
        multiline={slide.type === "open_ended"}
        onSubmit={async (text) => {
          await submitTextResponse(slide.id, sessionId, text);
          onSubmitted();
        }}
      />
    );
  }

  if (slide.type === "quiz") {
    const options = (slide.config.options as string[] | undefined) ?? [];
    const correctIndex = Number(slide.config.correct_index ?? 0);
    const timeLimit = Number(slide.config.time_limit_seconds ?? 20);
    return (
      <QuizForm
        prompt={prompt}
        options={options}
        timeLimit={timeLimit}
        onSubmit={async (choiceIndex) => {
          const elapsed = Date.now() - (shownAt.current ?? Date.now());
          await submitQuizAnswer(slide.id, sessionId, choiceIndex, correctIndex, elapsed);
          onSubmitted();
        }}
      />
    );
  }

  if (slide.type === "qa_board") {
    return (
      <div className="rounded border border-black/10 p-6 text-center dark:border-white/10">
        <h2 className="mb-2 text-lg font-medium">{prompt}</h2>
        <p className="text-sm text-black/50 dark:text-white/50">
          Use the Q&amp;A tab above to ask a question.
        </p>
      </div>
    );
  }

  return null;
}

function PollForm({
  prompt,
  options,
  multi,
  onSubmit,
}: {
  prompt: string;
  options: string[];
  multi: boolean;
  onSubmit: (indices: number[]) => Promise<void>;
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const [pending, setPending] = useState(false);

  function toggle(i: number) {
    setSelected((prev) => {
      if (multi) return prev.includes(i) ? prev.filter((x) => x !== i) : [...prev, i];
      return [i];
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">{prompt}</h2>
      <ul className="flex flex-col gap-2">
        {options.map((option, i) => (
          <li key={i}>
            <label className="flex items-center gap-2 rounded border border-black/10 p-3 text-sm dark:border-white/20">
              <input
                type={multi ? "checkbox" : "radio"}
                name="poll-option"
                checked={selected.includes(i)}
                onChange={() => toggle(i)}
              />
              {option}
            </label>
          </li>
        ))}
      </ul>
      <button
        disabled={selected.length === 0 || pending}
        onClick={async () => {
          setPending(true);
          await onSubmit(selected);
        }}
        className="rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
      >
        Submit
      </button>
    </div>
  );
}

function TextForm({
  prompt,
  multiline,
  onSubmit,
}: {
  prompt: string;
  multiline: boolean;
  onSubmit: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-medium">{prompt}</h2>
      {multiline ? (
        <textarea
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="rounded border border-black/10 px-3 py-2 text-sm dark:border-white/20"
        />
      ) : (
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={40}
          className="rounded border border-black/10 px-3 py-2 text-sm dark:border-white/20"
        />
      )}
      <button
        disabled={!text.trim() || pending}
        onClick={async () => {
          setPending(true);
          await onSubmit(text);
        }}
        className="rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
      >
        Submit
      </button>
    </div>
  );
}

function QuizForm({
  prompt,
  options,
  timeLimit,
  onSubmit,
}: {
  prompt: string;
  options: string[];
  timeLimit: number;
  onSubmit: (choiceIndex: number) => Promise<void>;
}) {
  const [remaining, setRemaining] = useState(timeLimit);
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((r) => (r <= 1 ? 0 : r - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  async function choose(i: number) {
    if (answered || remaining === 0) return;
    setAnswered(true);
    await onSubmit(i);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between text-sm text-black/50 dark:text-white/50">
        <span>{remaining}s left</span>
      </div>
      <h2 className="text-lg font-medium">{prompt}</h2>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {options.map((option, i) => (
          <li key={i}>
            <button
              disabled={answered || remaining === 0}
              onClick={() => choose(i)}
              className="w-full rounded border border-black/15 p-3 text-left text-sm disabled:opacity-50 dark:border-white/20"
            >
              {option}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function QaPanel({ sessionId }: { sessionId: string }) {
  const [questions, setQuestions] = useState<QaQuestion[]>([]);
  const [text, setText] = useState("");
  const [anonymous, setAnonymous] = useState(true);
  const [upvoted, setUpvoted] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;
    supabase
      .from("qa_questions")
      .select("*")
      .eq("session_id", sessionId)
      .then(({ data }) => {
        if (!cancelled) setQuestions((data ?? []) as QaQuestion[]);
      });

    const channel = supabase
      .channel(`qa_participant:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "qa_questions", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setQuestions((prev) => [...prev, payload.new as QaQuestion]);
          } else if (payload.eventType === "UPDATE") {
            const updated = payload.new as QaQuestion;
            setQuestions((prev) => prev.map((q) => (q.id === updated.id ? updated : q)));
          }
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const visible = questions.filter((q) => q.status !== "hidden").sort((a, b) => b.upvotes - a.upvotes);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ask a question…"
          className="rounded border border-black/10 px-3 py-2 text-sm dark:border-white/20"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={anonymous} onChange={(e) => setAnonymous(e.target.checked)} />
            Ask anonymously
          </label>
          <button
            disabled={!text.trim()}
            onClick={async () => {
              await submitQuestion(sessionId, text, anonymous);
              setText("");
            }}
            className="rounded bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-50"
          >
            Ask
          </button>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {visible.map((q) => (
          <li key={q.id} className="flex items-center justify-between gap-3 rounded border border-black/10 p-3 text-sm dark:border-white/10">
            <span>
              {q.text}
              {q.status === "answered" && (
                <span className="ml-2 text-xs text-green-700 dark:text-green-400">Answered</span>
              )}
            </span>
            <button
              disabled={upvoted.has(q.id)}
              onClick={async () => {
                setUpvoted((prev) => new Set(prev).add(q.id));
                await upvoteQuestion(q.id, sessionId);
              }}
              className="flex shrink-0 items-center gap-0.5 rounded border border-black/15 px-2 py-1 text-xs disabled:opacity-40 dark:border-white/20"
            >
              <ChevronUp className="h-3.5 w-3.5" aria-hidden />
              {q.upvotes}
            </button>
          </li>
        ))}
        {visible.length === 0 && <p className="text-sm text-black/50 dark:text-white/50">No questions yet.</p>}
      </ul>
    </div>
  );
}
