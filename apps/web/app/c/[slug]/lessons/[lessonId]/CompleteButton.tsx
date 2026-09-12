"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { completeLessonAction } from "@/app/c/actions";

export function CompleteButton({
  courseId,
  lessonId,
  nextHref,
}: {
  courseId: string;
  lessonId: string;
  nextHref: string | null;
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
      className="self-start rounded bg-foreground px-5 py-2.5 text-sm text-background disabled:opacity-50"
    >
      {pending ? "Saving…" : nextHref ? "Complete & continue →" : "Mark complete"}
    </button>
  );
}
