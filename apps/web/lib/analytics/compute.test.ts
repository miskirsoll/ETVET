import { describe, expect, it } from "vitest";
import { completionRate, averageQuizScore, distinctLearnerCount } from "./compute";
import type { LearnerProgress } from "@/lib/types/db";

function mk(over: Partial<LearnerProgress>): LearnerProgress {
  return {
    id: "id",
    course_id: "c1",
    lesson_id: null,
    user_id: null,
    anon_token: null,
    status: "in_progress",
    score: null,
    time_spent_seconds: 0,
    updated_at: "now",
    ...over,
  };
}

describe("distinctLearnerCount", () => {
  it("counts unique learners by user_id or anon_token, not by row", () => {
    const rows = [
      mk({ user_id: "u1", lesson_id: "l1" }),
      mk({ user_id: "u1", lesson_id: "l2" }), // same learner, two lessons
      mk({ anon_token: "a1", lesson_id: "l1" }),
      mk({ anon_token: "a1", lesson_id: "l2" }),
      mk({ anon_token: "a2", lesson_id: "l1" }),
    ];
    expect(distinctLearnerCount(rows)).toBe(3);
  });
});

describe("completionRate", () => {
  it("is finishers over total learners who touched the course", () => {
    const rows = [
      mk({ user_id: "u1", lesson_id: "l1", status: "completed" }),
      mk({ user_id: "u1", lesson_id: "l2", status: "completed" }),
      mk({ anon_token: "a1", lesson_id: "l1", status: "completed" }),
      mk({ anon_token: "a1", lesson_id: "l2", status: "passed" }),
      mk({ anon_token: "a2", lesson_id: "l1", status: "completed" }), // never reached l2
    ];
    expect(completionRate(rows, "l2")).toBe(2 / 3);
  });

  it("returns null rather than 0 when there's no data yet", () => {
    expect(completionRate([], "l2")).toBeNull();
  });

  it("returns null when there's no last lesson to measure against", () => {
    const rows = [mk({ user_id: "u1", lesson_id: "l1", status: "completed" })];
    expect(completionRate(rows, null)).toBeNull();
  });

  it("does not count a failed status on the last lesson as a finish", () => {
    const rows = [
      mk({ user_id: "u1", lesson_id: "l2", status: "completed" }),
      mk({ user_id: "u2", lesson_id: "l2", status: "failed" }),
    ];
    expect(completionRate(rows, "l2")).toBe(1 / 2);
  });
});

describe("averageQuizScore", () => {
  it("averages only scored attempts on QUIZ-type lessons", () => {
    const quizLessonIds = new Set(["q1", "q2"]);
    const rows = [
      mk({ lesson_id: "q1", score: 80 }),
      mk({ lesson_id: "q1", score: 60 }),
      mk({ lesson_id: "q2", score: 100 }),
      mk({ lesson_id: "block-lesson", score: null }), // not a quiz lesson
      mk({ lesson_id: "q1", score: null }), // in-progress attempt, no score yet
    ];
    expect(averageQuizScore(rows, quizLessonIds)).toBe((80 + 60 + 100) / 3);
  });

  it("returns null when there are no rows", () => {
    expect(averageQuizScore([], new Set(["q1"]))).toBeNull();
  });

  it("returns null when there are no quiz lessons in the course", () => {
    const rows = [mk({ lesson_id: "q1", score: 80 })];
    expect(averageQuizScore(rows, new Set())).toBeNull();
  });
});
