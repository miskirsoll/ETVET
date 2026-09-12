import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTierOrRedirect } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import type { Block, Lesson, Question, QuestionChoice } from "@/lib/types/db";
import { BlockEditor } from "./BlockEditor";
import { QuizEditor } from "./QuizEditor";

export default async function LessonEditorPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  await requireTierOrRedirect("PRO");
  const { courseId, lessonId } = await params;
  const supabase = await createClient();

  const { data: lesson } = await supabase.from("lessons").select("*").eq("id", lessonId).single();
  if (!lesson) notFound();

  const typedLesson = lesson as Lesson;

  const { data: blocks } =
    typedLesson.type === "BLOCK"
      ? await supabase.from("blocks").select("*").eq("lesson_id", lessonId).order("order")
      : { data: [] as Block[] };

  const { data: questions } =
    typedLesson.type === "QUIZ"
      ? await supabase.from("questions").select("*").eq("lesson_id", lessonId).order("order")
      : { data: [] as Question[] };

  const questionIds = (questions ?? []).map((q) => q.id);
  const { data: choices } = questionIds.length
    ? await supabase.from("question_choices").select("*").in("question_id", questionIds).order("order")
    : { data: [] as QuestionChoice[] };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href={`/studio/courses/${courseId}`} className="text-sm hover:underline">
        ← Back to outline
      </Link>
      <h1 className="text-2xl font-semibold">{typedLesson.title}</h1>

      {typedLesson.type === "BLOCK" ? (
        <BlockEditor lessonId={lessonId} initialBlocks={(blocks ?? []) as Block[]} />
      ) : (
        <QuizEditor
          lessonId={lessonId}
          lesson={typedLesson}
          initialQuestions={(questions ?? []) as Question[]}
          initialChoices={(choices ?? []) as QuestionChoice[]}
        />
      )}
    </div>
  );
}
