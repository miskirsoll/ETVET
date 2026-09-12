import type { LearnerProgress } from "@/lib/types/db";

/** A learner is identified by whichever of user_id/anon_token is set (see learner_progress_identity check constraint). */
function learnerKey(p: LearnerProgress): string | null {
  return p.user_id ?? p.anon_token ?? null;
}

export function distinctLearnerCount(progress: LearnerProgress[]): number {
  return new Set(progress.map(learnerKey).filter((k): k is string => k !== null)).size;
}

/**
 * Fraction of learners who ever touched the course that reached
 * completed/passed on its last lesson -- "reached the end", not "completed
 * every single lesson", since sequential navigation already guarantees the
 * former implies passing through everything before it.
 */
export function completionRate(progress: LearnerProgress[], lastLessonId: string | null): number | null {
  const totalLearners = distinctLearnerCount(progress);
  if (totalLearners === 0 || !lastLessonId) return null;
  const finishers = new Set(
    progress
      .filter((p) => p.lesson_id === lastLessonId && (p.status === "completed" || p.status === "passed"))
      .map(learnerKey)
      .filter((k): k is string => k !== null)
  );
  return finishers.size / totalLearners;
}

export function averageQuizScore(progress: LearnerProgress[], quizLessonIds: Set<string>): number | null {
  const scores = progress
    .filter((p) => p.lesson_id && quizLessonIds.has(p.lesson_id) && p.score !== null)
    .map((p) => p.score as number);
  if (scores.length === 0) return null;
  return scores.reduce((a, b) => a + b, 0) / scores.length;
}
