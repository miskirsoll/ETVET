"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireTier } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import type { Block, BlockType, LessonType } from "@/lib/types/db";

// ---------- Courses ----------

export async function createCourse(formData: FormData) {
  const session = await requireTier("PRO");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .insert({ org_id: session.org.id, owner_id: session.appUser.id, title })
    .select("id")
    .single();
  if (!data) return;

  redirect(`/studio/courses/${data.id}`);
}

export async function duplicateCourse(formData: FormData) {
  const session = await requireTier("PRO");
  const courseId = String(formData.get("id"));
  const supabase = await createClient();

  const { data: course } = await supabase.from("courses").select("*").eq("id", courseId).single();
  if (!course) return;

  const { data: newCourse } = await supabase
    .from("courses")
    .insert({
      org_id: session.org.id,
      owner_id: session.appUser.id,
      title: `${course.title} (copy)`,
      cover_image_url: course.cover_image_url,
      theme_id: course.theme_id,
      nav_settings: course.nav_settings,
    })
    .select("id")
    .single();
  if (!newCourse) return;

  const { data: sections } = await supabase
    .from("sections")
    .select("*")
    .eq("course_id", courseId)
    .order("order");

  for (const section of sections ?? []) {
    const { data: newSection } = await supabase
      .from("sections")
      .insert({ course_id: newCourse.id, title: section.title, order: section.order })
      .select("id")
      .single();
    if (!newSection) continue;

    const { data: lessons } = await supabase
      .from("lessons")
      .select("*")
      .eq("section_id", section.id)
      .order("order");

    for (const lesson of lessons ?? []) {
      const { data: newLesson } = await supabase
        .from("lessons")
        .insert({
          section_id: newSection.id,
          type: lesson.type,
          title: lesson.title,
          icon: lesson.icon,
          order: lesson.order,
        })
        .select("id")
        .single();
      if (!newLesson) continue;

      const { data: blocks } = await supabase
        .from("blocks")
        .select("*")
        .eq("lesson_id", lesson.id)
        .order("order");

      if (blocks && blocks.length > 0) {
        await supabase.from("blocks").insert(
          blocks.map((b) => ({
            lesson_id: newLesson.id,
            type: b.type,
            order: b.order,
            config: b.config,
            content: b.content,
          }))
        );
      }
    }
  }

  revalidatePath("/studio");
}

export async function deleteCourse(formData: FormData) {
  await requireTier("PRO");
  const id = String(formData.get("id"));
  const supabase = await createClient();
  await supabase.from("courses").delete().eq("id", id);
  revalidatePath("/studio");
}

// ---------- Sections ----------

export async function createSection(courseId: string, title: string) {
  await requireTier("PRO");
  const supabase = await createClient();
  const { count } = await supabase
    .from("sections")
    .select("id", { count: "exact", head: true })
    .eq("course_id", courseId);
  await supabase
    .from("sections")
    .insert({ course_id: courseId, title: title || "Untitled section", order: count ?? 0 });
  revalidatePath(`/studio/courses/${courseId}`);
}

export async function deleteSection(courseId: string, sectionId: string) {
  await requireTier("PRO");
  const supabase = await createClient();
  await supabase.from("sections").delete().eq("id", sectionId);
  revalidatePath(`/studio/courses/${courseId}`);
}

export async function reorderSections(courseId: string, orderedIds: string[]) {
  await requireTier("PRO");
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, index) => supabase.from("sections").update({ order: index }).eq("id", id))
  );
  revalidatePath(`/studio/courses/${courseId}`);
}

// ---------- Lessons ----------

export async function createLesson(
  courseId: string,
  sectionId: string,
  title: string,
  type: LessonType
) {
  await requireTier("PRO");
  const supabase = await createClient();
  const { count } = await supabase
    .from("lessons")
    .select("id", { count: "exact", head: true })
    .eq("section_id", sectionId);
  await supabase
    .from("lessons")
    .insert({ section_id: sectionId, title: title || "Untitled lesson", type, order: count ?? 0 });
  revalidatePath(`/studio/courses/${courseId}`);
}

export async function deleteLesson(courseId: string, lessonId: string) {
  await requireTier("PRO");
  const supabase = await createClient();
  await supabase.from("lessons").delete().eq("id", lessonId);
  revalidatePath(`/studio/courses/${courseId}`);
}

export async function reorderLessons(courseId: string, orderedIds: string[]) {
  await requireTier("PRO");
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, index) => supabase.from("lessons").update({ order: index }).eq("id", id))
  );
  revalidatePath(`/studio/courses/${courseId}`);
}

// ---------- Blocks ----------

const DEFAULT_BLOCK_CONTENT: Record<BlockType, Block["content"]> = {
  heading: { text: "New heading" },
  text: { text: "New paragraph text." },
  statement: { text: "A key statement." },
  quote: { text: "A quotable line.", attribution: "" },
  list: { items: ["First item", "Second item"], style: "bulleted" },
  image: { url: "", alt: "" },
  video: { url: "" },
  divider: {},
};

export async function createBlock(lessonId: string, type: BlockType): Promise<Block | null> {
  await requireTier("PRO");
  const supabase = await createClient();
  const { count } = await supabase
    .from("blocks")
    .select("id", { count: "exact", head: true })
    .eq("lesson_id", lessonId);
  const { data } = await supabase
    .from("blocks")
    .insert({
      lesson_id: lessonId,
      type,
      order: count ?? 0,
      content: DEFAULT_BLOCK_CONTENT[type],
      config: {},
    })
    .select("*")
    .single();
  return data as Block | null;
}

export async function updateBlockContent(blockId: string, content: Block["content"]) {
  await requireTier("PRO");
  const supabase = await createClient();
  await supabase.from("blocks").update({ content }).eq("id", blockId);
}

export async function deleteBlock(blockId: string) {
  await requireTier("PRO");
  const supabase = await createClient();
  await supabase.from("blocks").delete().eq("id", blockId);
}

export async function reorderBlocks(orderedIds: string[]) {
  await requireTier("PRO");
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, index) => supabase.from("blocks").update({ order: index }).eq("id", id))
  );
}
