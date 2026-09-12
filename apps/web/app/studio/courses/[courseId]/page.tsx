import { notFound } from "next/navigation";
import { requireTierOrRedirect } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import type { Course, Lesson, Section, Theme } from "@/lib/types/db";
import { OutlineEditor } from "./OutlineEditor";
import { PublishPanel } from "./PublishPanel";
import { ThemeSelector } from "./ThemeSelector";

export default async function CourseOutlinePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await requireTierOrRedirect("PRO");
  const { courseId } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();
  if (!course) notFound();

  const { data: themes } = await supabase
    .from("themes")
    .select("*")
    .eq("org_id", session.org.id)
    .order("created_at", { ascending: false });

  const { data: sections } = await supabase
    .from("sections")
    .select("*")
    .eq("course_id", courseId)
    .order("order");

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: lessons } = sectionIds.length
    ? await supabase.from("lessons").select("*").in("section_id", sectionIds).order("order")
    : { data: [] as Lesson[] };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{(course as Course).title}</h1>
      <ThemeSelector
        courseId={courseId}
        currentThemeId={(course as Course).theme_id}
        themes={(themes ?? []) as Theme[]}
      />
      <PublishPanel course={course as Course} />
      <OutlineEditor
        courseId={courseId}
        initialSections={(sections ?? []) as Section[]}
        initialLessons={(lessons ?? []) as Lesson[]}
      />
    </div>
  );
}
