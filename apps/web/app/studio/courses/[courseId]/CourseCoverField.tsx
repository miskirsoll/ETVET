"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileUpload } from "@/components/FileUpload";
import { updateCourseCover } from "@/app/studio/actions";

export function CourseCoverField({
  courseId,
  orgId,
  initialUrl,
}: {
  courseId: string;
  orgId: string;
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [, startTransition] = useTransition();
  const router = useRouter();

  function save(next: string) {
    setUrl(next);
    startTransition(async () => {
      await updateCourseCover(courseId, next || null);
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-4 rounded border border-black/10 p-4 dark:border-white/10">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Course cover" className="h-16 w-28 rounded object-cover" />
      ) : (
        <div className="h-16 w-28 rounded bg-black/5 dark:bg-white/5" />
      )}
      <div className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Cover image</span>
        <input
          className="rounded border border-black/10 px-2 py-1 text-xs dark:border-white/20"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onBlur={(e) => save(e.target.value)}
          placeholder="https://…"
        />
        <FileUpload orgId={orgId} accept="image/*" label="Upload cover" onUploaded={save} />
      </div>
    </div>
  );
}
