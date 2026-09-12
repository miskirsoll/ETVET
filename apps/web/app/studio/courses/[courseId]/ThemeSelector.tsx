"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Theme } from "@/lib/types/db";
import { setCourseTheme } from "@/app/studio/themes/actions";

export function ThemeSelector({
  courseId,
  currentThemeId,
  themes,
}: {
  courseId: string;
  currentThemeId: string | null;
  themes: Theme[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <label className="flex items-center gap-2 text-sm">
      Theme
      <select
        disabled={pending}
        value={currentThemeId ?? ""}
        onChange={(e) =>
          startTransition(async () => {
            await setCourseTheme(courseId, e.target.value || null);
            router.refresh();
          })
        }
        className="rounded border border-black/10 px-2 py-1 dark:border-white/20"
      >
        <option value="">Default (no theme)</option>
        {themes.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
          </option>
        ))}
      </select>
    </label>
  );
}
