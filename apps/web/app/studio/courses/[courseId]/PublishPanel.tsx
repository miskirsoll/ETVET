"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Course } from "@/lib/types/db";
import { publishCourse, unpublishCourse } from "@/app/studio/actions";

export function PublishPanel({ course }: { course: Course }) {
  const [password, setPassword] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const publicUrl =
    typeof window !== "undefined" && course.publish_slug
      ? `${window.location.origin}/c/${course.publish_slug}`
      : course.publish_slug
        ? `/c/${course.publish_slug}`
        : null;

  return (
    <div className="flex flex-col gap-3 rounded border border-black/10 p-4 text-sm dark:border-white/10">
      <div className="flex items-center justify-between">
        <span className="font-medium">
          Status: {course.status === "PUBLISHED" ? "Published" : "Draft"}
        </span>
        {course.status === "PUBLISHED" ? (
          <button
            disabled={pending}
            onClick={() => startTransition(async () => { await unpublishCourse(course.id); router.refresh(); })}
            className="rounded border border-black/15 px-3 py-1.5 dark:border-white/20"
          >
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
            className="rounded bg-foreground px-3 py-1.5 text-background disabled:opacity-50"
          >
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
        <a href={publicUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline dark:text-blue-400">
          {publicUrl}
        </a>
      )}
    </div>
  );
}
