import Link from "next/link";
import { Palette, Trash2 } from "lucide-react";
import { requireTierOrRedirect } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import type { Theme } from "@/lib/types/db";
import { createTheme, deleteTheme } from "./actions";

export default async function ThemesPage() {
  const session = await requireTierOrRedirect("PRO");
  const supabase = await createClient();
  const { data: themes } = await supabase
    .from("themes")
    .select("*")
    .eq("org_id", session.org.id)
    .order("created_at", { ascending: false });
  const list = (themes ?? []) as Theme[];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <h1 className="text-2xl font-semibold">Themes</h1>

      <form action={createTheme} className="flex gap-2">
        <input
          type="text"
          name="name"
          placeholder="New theme name"
          required
          className="flex-1 rounded border border-black/10 px-3 py-2 dark:border-white/20"
        />
        <button type="submit" className="rounded bg-brand px-4 py-2 text-brand-foreground">
          Create theme
        </button>
      </form>

      {list.length === 0 ? (
        <EmptyState
          icon={Palette}
          title="No themes yet — create one above, then assign it to a course from the course outline page."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((theme) => (
            <li
              key={theme.id}
              className="flex items-center justify-between rounded border border-black/10 px-4 py-3 shadow-sm transition-shadow hover:shadow-md dark:border-white/10"
            >
              <div className="flex items-center gap-3">
                <span
                  className="h-5 w-5 rounded-full border border-black/10"
                  style={{ backgroundColor: theme.colors.primary }}
                />
                <Link href={`/studio/themes/${theme.id}`} className="hover:underline">
                  {theme.name}
                </Link>
              </div>
              <form action={deleteTheme.bind(null, theme.id)}>
                <button
                  type="submit"
                  aria-label={`Delete theme ${theme.name}`}
                  className="flex items-center gap-1 text-sm text-red-600 hover:underline"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  Delete
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
