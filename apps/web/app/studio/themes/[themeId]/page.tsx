import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTierOrRedirect } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import type { Theme } from "@/lib/types/db";
import { ThemeEditor } from "./ThemeEditor";

export default async function ThemeEditPage({
  params,
}: {
  params: Promise<{ themeId: string }>;
}) {
  const session = await requireTierOrRedirect("PRO");
  const { themeId } = await params;
  const supabase = await createClient();
  const { data: theme } = await supabase.from("themes").select("*").eq("id", themeId).single();
  if (!theme) notFound();

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link href="/studio/themes" className="text-sm hover:underline">
        ← Back to themes
      </Link>
      <ThemeEditor theme={theme as Theme} orgId={session.org.id} />
    </div>
  );
}
