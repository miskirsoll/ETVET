"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { InteractiveBlockMode, LiveResponse, LiveSession, LiveSlide } from "@/lib/types/db";
import { pollCounts, wordCloudWeights, textResponses } from "@/lib/live/aggregate";
import { submitBridgeResponse } from "@/app/c/actions";

/**
 * The Bridge: renders a block linked to a Live Session. Sync mode is just
 * a join point (the actual live experience happens at /join/[code]); async
 * mode renders the linked session's first slide inline, self-paced, no
 * presenter or realtime subscription needed -- a learner submits and
 * immediately sees the aggregate refreshed, which is enough for "a running
 * aggregate of all responses so far" without the complexity of a live
 * socket for something that isn't actually live.
 */
export function InteractiveBlockView({
  liveSessionId,
  mode,
}: {
  liveSessionId: string | null;
  mode: InteractiveBlockMode;
}) {
  const [session, setSession] = useState<LiveSession | null>(null);
  const [slide, setSlide] = useState<LiveSlide | null>(null);
  const [responses, setResponses] = useState<LiveResponse[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!liveSessionId) return;
    const supabase = createClient();
    let cancelled = false;

    async function load() {
      const { data: sessionRow } = await supabase
        .from("live_sessions")
        .select("*")
        .eq("id", liveSessionId)
        .maybeSingle();
      if (cancelled) return;
      setSession(sessionRow as LiveSession | null);

      if (mode === "async" && sessionRow?.status === "live") {
        const { data: slideRow } = await supabase
          .from("live_slides")
          .select("*")
          .eq("session_id", liveSessionId)
          .order("order")
          .limit(1)
          .maybeSingle();
        if (cancelled) return;
        setSlide(slideRow as LiveSlide | null);

        if (slideRow) {
          const { data: responseRows } = await supabase
            .from("live_responses")
            .select("*")
            .eq("live_slide_id", slideRow.id);
          if (!cancelled) setResponses((responseRows ?? []) as LiveResponse[]);
        }
      }
      setLoaded(true);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [liveSessionId, mode]);

  if (!liveSessionId) return null;
  if (!loaded) return null;

  if (!session) {
    return (
      <p className="rounded border border-black/10 p-4 text-sm text-black/50 dark:border-white/10 dark:text-white/50">
        This interactive activity isn&apos;t available right now.
      </p>
    );
  }

  if (mode === "sync") {
    if (session.status !== "live") {
      return (
        <p className="rounded border border-black/10 p-4 text-sm text-black/50 dark:border-white/10 dark:text-white/50">
          This live activity isn&apos;t happening right now. Check back when your trainer starts
          it.
        </p>
      );
    }
    return (
      <a
        href={`/join/${session.join_code}`}
        target="_blank"
        rel="noreferrer"
        className="inline-block rounded bg-foreground px-5 py-2.5 text-sm text-background"
      >
        Join the live session: {session.title} →
      </a>
    );
  }

  // async
  if (session.status !== "live" || !slide) {
    return (
      <p className="rounded border border-black/10 p-4 text-sm text-black/50 dark:border-white/10 dark:text-white/50">
        This activity isn&apos;t available right now.
      </p>
    );
  }

  return (
    <AsyncSlide
      slide={slide}
      responses={responses}
      onSubmitted={(response) => {
        submitBridgeResponse(slide.id, response).then(async () => {
          const supabase = createClient();
          const { data } = await supabase.from("live_responses").select("*").eq("live_slide_id", slide.id);
          setResponses((data ?? []) as LiveResponse[]);
        });
      }}
    />
  );
}

function AsyncSlide({
  slide,
  responses,
  onSubmitted,
}: {
  slide: LiveSlide;
  responses: LiveResponse[];
  onSubmitted: (response: Record<string, unknown>) => void;
}) {
  const [submitted, setSubmitted] = useState(false);
  const [text, setText] = useState("");
  const prompt = String(slide.config.prompt ?? "");

  if (slide.type === "poll") {
    const options = (slide.config.options as string[] | undefined) ?? [];
    const counts = pollCounts(responses, options.length);
    const max = Math.max(1, ...counts);
    return (
      <div className="flex flex-col gap-3 rounded border border-black/10 p-4 dark:border-white/10">
        <h3 className="font-medium">{prompt}</h3>
        {submitted ? (
          <div className="flex flex-col gap-2">
            {options.map((option, i) => (
              <div key={i}>
                <div className="mb-1 flex justify-between text-xs">
                  <span>{option}</span>
                  <span>{counts[i]}</span>
                </div>
                <div className="h-3 rounded bg-black/5 dark:bg-white/5">
                  <div className="h-3 rounded bg-foreground" style={{ width: `${(counts[i] / max) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {options.map((option, i) => (
              <li key={i}>
                <button
                  onClick={() => {
                    setSubmitted(true);
                    onSubmitted({ choices: [i] });
                  }}
                  className="w-full rounded border border-black/15 p-2 text-left text-sm dark:border-white/20"
                >
                  {option}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  if (slide.type === "word_cloud" || slide.type === "open_ended") {
    if (submitted) {
      const items =
        slide.type === "word_cloud" ? wordCloudWeights(responses) : textResponses(responses).map((t) => ({ word: t, count: 1 }));
      return (
        <div className="flex flex-col gap-3 rounded border border-black/10 p-4 dark:border-white/10">
          <h3 className="font-medium">{prompt}</h3>
          <div className="flex flex-wrap gap-2">
            {items.map(({ word }, i) => (
              <span key={i} className="rounded bg-black/5 px-2 py-1 text-sm dark:bg-white/5">
                {word}
              </span>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-3 rounded border border-black/10 p-4 dark:border-white/10">
        <h3 className="font-medium">{prompt}</h3>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="rounded border border-black/10 px-3 py-2 text-sm dark:border-white/20"
        />
        <button
          disabled={!text.trim()}
          onClick={() => {
            setSubmitted(true);
            onSubmitted({ text: text.trim() });
          }}
          className="self-start rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          Submit
        </button>
      </div>
    );
  }

  return (
    <p className="rounded border border-black/10 p-4 text-sm text-black/50 dark:border-white/10 dark:text-white/50">
      This slide type isn&apos;t supported in async course embeds yet.
    </p>
  );
}
