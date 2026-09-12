"use server";

import { requireTier } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import type { Question, QuestionChoice, QuestionType } from "@/lib/types/db";

const DEFAULT_CHOICES: Record<QuestionType, { text: string; is_correct: boolean }[]> = {
  multiple_choice: [
    { text: "Option A", is_correct: true },
    { text: "Option B", is_correct: false },
  ],
  multiple_response: [
    { text: "Option A", is_correct: true },
    { text: "Option B", is_correct: false },
  ],
  true_false: [
    { text: "True", is_correct: true },
    { text: "False", is_correct: false },
  ],
  fill_blank: [],
  matching: [],
};

export async function createQuestion(
  lessonId: string,
  type: QuestionType
): Promise<{ question: Question; choices: QuestionChoice[] } | null> {
  await requireTier("PRO");
  const supabase = await createClient();

  const { count } = await supabase
    .from("questions")
    .select("id", { count: "exact", head: true })
    .eq("lesson_id", lessonId);

  const { data: question } = await supabase
    .from("questions")
    .insert({ lesson_id: lessonId, type, order: count ?? 0, prompt: "New question" })
    .select("*")
    .single();
  if (!question) return null;

  const defaults = DEFAULT_CHOICES[type];
  let choices: QuestionChoice[] = [];
  if (defaults.length > 0) {
    const { data } = await supabase
      .from("question_choices")
      .insert(
        defaults.map((c, i) => ({
          question_id: question.id,
          order: i,
          text: c.text,
          is_correct: c.is_correct,
        }))
      )
      .select("*");
    choices = (data ?? []) as QuestionChoice[];
  }

  return { question: question as Question, choices };
}

export async function updateQuestionPrompt(questionId: string, prompt: string) {
  await requireTier("PRO");
  const supabase = await createClient();
  await supabase.from("questions").update({ prompt }).eq("id", questionId);
}

export async function deleteQuestion(questionId: string) {
  await requireTier("PRO");
  const supabase = await createClient();
  await supabase.from("questions").delete().eq("id", questionId);
}

export async function reorderQuestions(orderedIds: string[]) {
  await requireTier("PRO");
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, index) => supabase.from("questions").update({ order: index }).eq("id", id))
  );
}

export async function addChoice(questionId: string): Promise<QuestionChoice | null> {
  await requireTier("PRO");
  const supabase = await createClient();
  const { count } = await supabase
    .from("question_choices")
    .select("id", { count: "exact", head: true })
    .eq("question_id", questionId);
  const { data } = await supabase
    .from("question_choices")
    .insert({ question_id: questionId, order: count ?? 0, text: "New option", is_correct: false })
    .select("*")
    .single();
  return data as QuestionChoice | null;
}

export async function updateChoice(
  choiceId: string,
  fields: Partial<Pick<QuestionChoice, "text" | "is_correct" | "feedback">>
) {
  await requireTier("PRO");
  const supabase = await createClient();
  await supabase.from("question_choices").update(fields).eq("id", choiceId);
}

/**
 * Enforces single-correct-answer semantics for multiple_choice/true_false
 * (radio-button questions): setting one choice correct clears every other
 * choice on the same question. multiple_response questions call
 * updateChoice directly instead, since more than one may be correct.
 */
export async function setSingleCorrectChoice(questionId: string, choiceId: string) {
  await requireTier("PRO");
  const supabase = await createClient();
  await supabase.from("question_choices").update({ is_correct: false }).eq("question_id", questionId);
  await supabase.from("question_choices").update({ is_correct: true }).eq("id", choiceId);
}

export async function deleteChoice(choiceId: string) {
  await requireTier("PRO");
  const supabase = await createClient();
  await supabase.from("question_choices").delete().eq("id", choiceId);
}

export async function updateQuizSettings(
  lessonId: string,
  settings: {
    pass_threshold: number;
    randomize_questions: boolean;
    draw_count: number | null;
    time_limit_seconds: number | null;
  }
) {
  await requireTier("PRO");
  const supabase = await createClient();
  await supabase.from("lessons").update(settings).eq("id", lessonId);
}
