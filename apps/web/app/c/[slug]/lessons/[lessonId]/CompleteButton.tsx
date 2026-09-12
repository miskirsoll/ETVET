"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Check } from "lucide-react";
import { Spinner } from "@/components/Spinner";
import { completeLessonAction } from "@/app/c/actions";

export function CompleteButton({
  courseId,
  lessonId,
  nextHref,
  accentColor,
}: {
  courseId: string;
  lessonId: string;
  nextHref: string | null;
  accentColor?: string;
}) {
  const startedAt = useRef<number | null>(null);
  useEffect(() => {
    startedAt.current = Date.now();
  }, []);
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function onClick() {
    setPending(true);
    const elapsed = Math.round((Date.now() - (startedAt.current ?? Date.now())) / 1000);
    await completeLessonAction(courseId, lessonId, elapsed);
    if (nextHref) router.push(nextHref);
    else router.refresh();
  }

  return (
    <button
      onClick={onClick}
      disabled={pending}
      className="flex items-center gap-1.5 self-start rounded bg-foreground px-5 py-2.5 text-sm text-background disabled:opacity-50"
      style={accentColor ? { backgroundColor: accentColor } : undefined}
    >
      {pending ? (
        <>
          <Spinner /> Saving…
        </>
      ) : nextHref ? (
        <>
          Complete &amp; continue <ArrowRight className="h-4 w-4" aria-hidden />
        </>
      ) : (
        <>
          <Check className="h-4 w-4" aria-hidden /> Mark complete
        </>
      )}
    </button>
  );
}
