"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, EyeOff, Globe } from "lucide-react";
import { Spinner } from "@/components/Spinner";
import type { Course } from "@/lib/types/db";
import { publishCourse, unpublishCourse } from "@/app/studio/actions";

export function PublishPanel({ course }: { course: Course }) {
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const isPublished = course.status === "PUBLISHED";

  const publicUrl =
    typeof window !== "undefined" && course.publish_slug
      ? `${window.location.origin}/c/${course.publish_slug}`
      : course.publish_slug
        ? `/c/${course.publish_slug}`
        : null;

  return (
    <div className="flex flex-col gap-3 rounded border border-black/10 p-4 text-sm dark:border-white/10">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 font-medium">
          Status:
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              isPublished
                ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                : "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60"
            }`}
          >
            {isPublished ? "Published" : "Draft"}
          </span>
        </span>
        {isPublished ? (
          <button
            disabled={pending}
            onClick={() => startTransition(async () => { await unpublishCourse(course.id); router.refresh(); })}
            className="flex items-center gap-1.5 rounded border border-black/15 px-3 py-1.5 dark:border-white/20"
          >
            {pending ? <Spinner className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" aria-hidden />}
            Unpublish
          </button>
        ) : (
          <button
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await publishCourse(course.id, password);
                router.refresh();
              })
            }
            className="flex items-center gap-1.5 rounded bg-brand px-3 py-1.5 text-brand-foreground disabled:opacity-50"
          >
            {pending ? <Spinner className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" aria-hidden />}
            {pending ? "Publishing…" : "Publish"}
          </button>
        )}
      </div>

      {course.status !== "PUBLISHED" && (
        <label className="flex flex-col gap-1">
          Optional password (leave blank for none)
          <input
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded border border-black/10 px-2 py-1 dark:border-white/20"
          />
        </label>
      )}

      {course.status === "PUBLISHED" && publicUrl && (
        <a
          href={publicUrl}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-1 text-brand-text hover:underline"
        >
          {publicUrl}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </a>
      )}
    </div>
  );
}
