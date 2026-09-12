"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getOrCreateLearnerKey } from "@/lib/learner/session";
import type { LearnerProgress, Question, QuestionChoice } from "@/lib/types/db";

/**
 * The Bridge's async mode reuses live_responses (Module B's schema)
 * rather than inventing a parallel response table -- but a course
 * learner's identity comes from lib/learner/session.ts (anon token or an
 * authenticated user id), not a live-session participant_token. Encoding
 * "user:<id>" for authenticated learners lets one text column serve both
 * identity systems without a schema change; anonymous learners just use
 * their existing anon token directly.
 */
async function bridgeParticipantToken(): Promise<string> {
  const key = await getOrCreateLearnerKey();
  return key.userId ? `user:${key.userId}` : (key.anonToken as string);
}

export async function verifyCoursePassword(slug: string, formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const supabase = await createClient();
  const { data: course } = await supabase
    .from("courses")
    .select("publish_password")
    .eq("publish_slug", slug)
    .eq("status", "PUBLISHED")
    .maybeSingle();

  if (!course || course.publish_password !== password) {
    return { error: "Incorrect password." };
  }

  const cookieStore = await cookies();
  cookieStore.set(`etvet_unlock_${slug}`, "1", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
}

async function upsertProgress(fields: {
  course_id: string;
  lesson_id: string;
  status: LearnerProgress["status"];
  score: number | null;
  time_spent_seconds: number;
}) {
  // Ensures an anon token exists before the RPC needs one, then leaves the
  // actual insert-or-update to submit_learner_progress() (migration 0006)
  // as a single atomic call -- see that migration for why this can't be a
  // plain table upsert from here.
  const key = await getOrCreateLearnerKey();
  const supabase = await createClient();
  await supabase.rpc("submit_learner_progress", {
    p_course_id: fields.course_id,
    p_lesson_id: fields.lesson_id,
    p_anon_token: key.anonToken,
    p_status: fields.status,
    p_score: fields.score,
    p_time_spent_seconds: fields.time_spent_seconds,
  });
}

export async function completeLessonAction(
  courseId: string,
  lessonId: string,
  timeSpentSeconds: number
) {
  await upsertProgress({
    course_id: courseId,
    lesson_id: lessonId,
    status: "completed",
    score: null,
    time_spent_seconds: Math.max(0, Math.round(timeSpentSeconds)),
  });
}

/**
 * Grades server-side against the authoritative is_correct flags -- the
 * client only ever submits *which choice ids it picked*, never a score or
 * a pass/fail verdict, so a tampered request can't forge a passing result.
 */
export async function submitQuizAction(
  courseId: string,
  lessonId: string,
  answers: Record<string, string[]>,
  timeSpentSeconds: number
): Promise<{ score: number; passed: boolean }> {
  const supabase = await createClient();
  const questionIds = Object.keys(answers);

  const { data: lesson } = await supabase
    .from("lessons")
    .select("pass_threshold")
    .eq("id", lessonId)
    .single();
  const passThreshold = lesson?.pass_threshold ?? 70;

  const { data: questions } = questionIds.length
    ? await supabase.from("questions").select("*").in("id", questionIds)
    : { data: [] as Question[] };
  const { data: choices } = questionIds.length
    ? await supabase.from("question_choices").select("*").in("question_id", questionIds)
    : { data: [] as QuestionChoice[] };

  const choicesByQuestion = new Map<string, QuestionChoice[]>();
  for (const c of (choices ?? []) as QuestionChoice[]) {
    const list = choicesByQuestion.get(c.question_id) ?? [];
    list.push(c);
    choicesByQuestion.set(c.question_id, list);
  }

  let correctCount = 0;
  const total = (questions ?? []).length;
  for (const question of (questions ?? []) as Question[]) {
    const questionChoices = choicesByQuestion.get(question.id) ?? [];
    const correctIds = new Set(questionChoices.filter((c) => c.is_correct).map((c) => c.id));
    const submitted = new Set(answers[question.id] ?? []);
    const isCorrect =
      correctIds.size === submitted.size && [...correctIds].every((id) => submitted.has(id));
    if (isCorrect) correctCount++;
  }

  const score = total > 0 ? Math.round((correctCount / total) * 100) : 0;
  const passed = score >= passThreshold;

  await upsertProgress({
    course_id: courseId,
    lesson_id: lessonId,
    status: passed ? "passed" : "failed",
    score,
    time_spent_seconds: Math.max(0, Math.round(timeSpentSeconds)),
  });

  return { score, passed };
}

// ---------- The Bridge: async interactive-block responses ----------

export async function submitBridgeResponse(
  liveSlideId: string,
  response: Record<string, unknown>
) {
  const token = await bridgeParticipantToken();
  const supabase = await createClient();
  await supabase.from("live_responses").insert({
    live_slide_id: liveSlideId,
    participant_token: token,
    response,
  });
}
