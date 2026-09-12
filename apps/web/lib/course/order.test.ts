import { describe, expect, it } from "vitest";
import { flattenLessonOrder } from "./order";
import type { Lesson, Section } from "@/lib/types/db";

function section(id: string, order: number): Section {
  return { id, course_id: "c1", title: id, order };
}

function lesson(id: string, sectionId: string, order: number): Lesson {
  return {
    id,
    section_id: sectionId,
    type: "BLOCK",
    title: id,
    icon: null,
    order,
    pass_threshold: 70,
    randomize_questions: false,
    draw_count: null,
    time_limit_seconds: null,
  };
}

describe("flattenLessonOrder", () => {
  it("orders lessons by section order, then lesson order within a section", () => {
    const sections = [section("s2", 1), section("s1", 0)];
    const lessons = [
      lesson("s1-l2", "s1", 1),
      lesson("s1-l1", "s1", 0),
      lesson("s2-l1", "s2", 0),
    ];
    expect(flattenLessonOrder(sections, lessons).map((l) => l.id)).toEqual([
      "s1-l1",
      "s1-l2",
      "s2-l1",
    ]);
  });

  it("returns an empty list for a course with no sections", () => {
    expect(flattenLessonOrder([], [])).toEqual([]);
  });

  it("skips a section with no lessons without erroring", () => {
    const sections = [section("empty", 0), section("s1", 1)];
    const lessons = [lesson("s1-l1", "s1", 0)];
    expect(flattenLessonOrder(sections, lessons).map((l) => l.id)).toEqual(["s1-l1"]);
  });
});
