import { notFound } from "next/navigation";
import { requireTierOrRedirect } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import type { Course, Lesson, Section } from "@/lib/types/db";
import { OutlineEditor } from "./OutlineEditor";
import { PublishPanel } from "./PublishPanel";

export default async function CourseOutlinePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  await requireTierOrRedirect("PRO");
  const { courseId } = await params;
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("*")
    .eq("id", courseId)
    .single();
  if (!course) notFound();

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
      <PublishPanel course={course as Course} />
      <OutlineEditor
        courseId={courseId}
        initialSections={(sections ?? []) as Section[]}
        initialLessons={(lessons ?? []) as Lesson[]}
      />
    </div>
  );
}
