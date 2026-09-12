import type { Lesson, Section } from "@/lib/types/db";

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
