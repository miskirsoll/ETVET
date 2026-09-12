import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Course, Lesson, LearnerProgress, Section } from "@/lib/types/db";
import type { LearnerKey } from "@/lib/learner/session";

export async function getPublishedCourseBySlug(slug: string): Promise<Course | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("courses")
    .select("*")
    .eq("publish_slug", slug)
    .eq("status", "PUBLISHED")
    .maybeSingle();
  return data as Course | null;
}

export async function getCourseOutline(
  courseId: string
): Promise<{ sections: Section[]; lessons: Lesson[] }> {
  const supabase = await createClient();
  const { data: sections } = await supabase
    .from("sections")
    .select("*")
    .eq("course_id", courseId)
    .order("order");

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: lessons } = sectionIds.length
    ? await supabase.from("lessons").select("*").in("section_id", sectionIds).order("order")
    : { data: [] as Lesson[] };

  return { sections: (sections ?? []) as Section[], lessons: (lessons ?? []) as Lesson[] };
}

/** Flattens sections+lessons into reading order, for prev/next + sequential locking. */
export function flattenLessonOrder(sections: Section[], lessons: Lesson[]): Lesson[] {
  const bySection = new Map<string, Lesson[]>();
  for (const l of lessons) {
    const list = bySection.get(l.section_id) ?? [];
    list.push(l);
    bySection.set(l.section_id, list);
  }
  for (const list of bySection.values()) list.sort((a, b) => a.order - b.order);

  const ordered: Lesson[] = [];
  for (const section of [...sections].sort((a, b) => a.order - b.order)) {
    ordered.push(...(bySection.get(section.id) ?? []));
  }
  return ordered;
}

/**
 * Reads back the current learner's own progress via the
 * get_learner_progress() RPC (see migration 0005) rather than a plain
 * table select -- RLS alone can't scope a read to "rows whose anon_token
 * matches the one this caller claims," since anon_token isn't a verifiable
 * JWT claim the way auth.uid() is. The RPC filters by the exact token
 * argument inside its own SQL, so omitting a filter can't broaden it.
 */
export async function getProgressMap(
  courseId: string,
  key: LearnerKey
): Promise<Record<string, LearnerProgress>> {
  if (!key.userId && !key.anonToken) return {};
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_learner_progress", {
    p_course_id: courseId,
    p_anon_token: key.anonToken,
  });

  const map: Record<string, LearnerProgress> = {};
  for (const row of (data ?? []) as LearnerProgress[]) {
    if (row.lesson_id) map[row.lesson_id] = row;
  }
  return map;
}
