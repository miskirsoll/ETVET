"use client";

import { useState } from "react";

export function ScormExportButton({ courseId }: { courseId: string }) {
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<string[] | null>(null);
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [downloaded, setDownloaded] = useState(false);

  async function handleClick() {
    setPending(true);
    setErrors(null);
    setWarnings(null);
    setDownloaded(false);

    const response = await fetch(`/studio/courses/${courseId}/scorm`);

    if (!response.ok) {
      const body = await response.json().catch(() => ({ errors: ["Unknown error."] }));
      setErrors(body.errors ?? ["Unknown error."]);
      setPending(false);
      return;
    }

    const warningsHeader = response.headers.get("X-Etvet-Warnings");
    if (warningsHeader) {
      try {
        const parsed = JSON.parse(decodeURIComponent(warningsHeader));
        if (Array.isArray(parsed) && parsed.length > 0) setWarnings(parsed);
      } catch {
        // ignore malformed header
      }
    }

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `course-${courseId}-scorm12.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);

    setDownloaded(true);
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-3 rounded border border-black/10 p-4 text-sm dark:border-white/10">
      <div className="flex items-center justify-between">
        <span className="font-medium">SCORM export (for Moodle)</span>
        <button
          onClick={handleClick}
          disabled={pending}
          className="rounded bg-foreground px-4 py-2 text-sm text-background disabled:opacity-50"
        >
          {pending ? "Building package…" : "Download SCORM for Moodle"}
        </button>
      </div>

      {errors && (
        <div className="rounded bg-red-100 p-3 text-red-800 dark:bg-red-950 dark:text-red-300">
          <p className="font-medium">Couldn&apos;t build the package:</p>
          <ul className="list-disc pl-5">
            {errors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {warnings && (
        <div className="rounded bg-amber-100 p-3 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
          <p className="font-medium">Package built, with a few notes:</p>
          <ul className="list-disc pl-5">
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      {downloaded && (
        <div className="rounded border border-black/10 p-3 dark:border-white/10">
          <p className="mb-2 font-medium">Uploading to Moodle</p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>In your Moodle course, turn editing on and choose <strong>Add an activity or resource</strong>.</li>
            <li>Select <strong>SCORM package</strong>.</li>
            <li>Upload the downloaded zip file as the package.</li>
            <li>
              Under <strong>Completion tracking</strong>, set it to track completion (e.g. by grade or by
              the activity being marked complete) so the gradebook reflects the score/status this
              package reports.
            </li>
            <li>
              Leave <strong>Force completed</strong> off unless you intentionally want to override this
              package&apos;s own completion tracking.
            </li>
            <li>Save, then open the activity as a test learner to confirm it loads correctly.</li>
          </ol>
        </div>
      )}
    </div>
  );
}
