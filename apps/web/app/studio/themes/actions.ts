"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireEditTier } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import {
  DEFAULT_THEME_COLORS,
  DEFAULT_THEME_FONTS,
  DEFAULT_THEME_LAYOUT,
  type Theme,
} from "@/lib/types/db";

export async function createTheme(formData: FormData) {
  const session = await requireEditTier("PRO");
  const name = String(formData.get("name") ?? "").trim() || "Untitled theme";

  const supabase = await createClient();
  const { data } = await supabase
    .from("themes")
    .insert({
      org_id: session.org.id,
      name,
      colors: DEFAULT_THEME_COLORS,
      fonts: DEFAULT_THEME_FONTS,
      layout_config: DEFAULT_THEME_LAYOUT,
    })
    .select("id")
    .single();
  if (!data) return;

  redirect(`/studio/themes/${data.id}`);
}

export async function updateTheme(
  themeId: string,
  fields: Partial<Pick<Theme, "name" | "colors" | "fonts" | "logo_url" | "layout_config">>
) {
  await requireEditTier("PRO");
  const supabase = await createClient();
  await supabase.from("themes").update(fields).eq("id", themeId);
  revalidatePath(`/studio/themes/${themeId}`);
}

export async function deleteTheme(themeId: string) {
  await requireEditTier("PRO");
  const supabase = await createClient();
  await supabase.from("themes").delete().eq("id", themeId);
  revalidatePath("/studio/themes");
}

export async function setCourseTheme(courseId: string, themeId: string | null) {
  await requireEditTier("PRO");
  const supabase = await createClient();
  await supabase.from("courses").update({ theme_id: themeId }).eq("id", courseId);
  revalidatePath(`/studio/courses/${courseId}`);
}
