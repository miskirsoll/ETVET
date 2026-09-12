import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTierOrRedirect } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import type { Block, InteractiveBlock, Lesson, LiveSession, Question, QuestionChoice } from "@/lib/types/db";
import { BlockEditor } from "./BlockEditor";
import { QuizEditor } from "./QuizEditor";

export default async function LessonEditorPage({
  params,
}: {
  params: Promise<{ courseId: string; lessonId: string }>;
}) {
  const session = await requireTierOrRedirect("PRO");
  const { courseId, lessonId } = await params;
  const supabase = await createClient();

  const { data: lesson } = await supabase.from("lessons").select("*").eq("id", lessonId).single();
  if (!lesson) notFound();

  const typedLesson = lesson as Lesson;

  const { data: blocks } =
    typedLesson.type === "BLOCK"
      ? await supabase.from("blocks").select("*").eq("lesson_id", lessonId).order("order")
      : { data: [] as Block[] };

  // For the Button block's "jump to lesson" picker -- every lesson in the
  // same course, regardless of section.
  const { data: courseSections } = await supabase
    .from("sections")
    .select("id")
    .eq("course_id", courseId);
  const sectionIds = (courseSections ?? []).map((s) => s.id);
  const { data: courseLessons } = sectionIds.length
    ? await supabase.from("lessons").select("id, title").in("section_id", sectionIds).order("order")
    : { data: [] as { id: string; title: string }[] };

  const { data: questions } =
    typedLesson.type === "QUIZ"
      ? await supabase.from("questions").select("*").eq("lesson_id", lessonId).order("order")
      : { data: [] as Question[] };

  const questionIds = (questions ?? []).map((q) => q.id);
  const { data: choices } = questionIds.length
    ? await supabase.from("question_choices").select("*").in("question_id", questionIds).order("order")
    : { data: [] as QuestionChoice[] };

  // For the Interactive block (MAXPRO only): the org's live sessions to
  // link to, and any existing link for blocks already in this lesson.
  const { data: liveSessions } =
    session.org.subscription_tier === "MAXPRO"
      ? await supabase
          .from("live_sessions")
          .select("*")
          .eq("org_id", session.org.id)
          .order("created_at", { ascending: false })
      : { data: [] as LiveSession[] };

  const interactiveBlockIds = (blocks ?? [])
    .filter((b) => b.type === "interactive")
    .map((b) => b.id);
  const { data: interactiveBlocks } = interactiveBlockIds.length
    ? await supabase.from("interactive_blocks").select("*").in("block_id", interactiveBlockIds)
    : { data: [] as InteractiveBlock[] };
  const interactiveBlocksByBlockId: Record<string, InteractiveBlock> = {};
  for (const ib of (interactiveBlocks ?? []) as InteractiveBlock[]) {
    interactiveBlocksByBlockId[ib.block_id] = ib;
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href={`/studio/courses/${courseId}`} className="text-sm hover:underline">
        ← Back to outline
      </Link>
      <h1 className="text-2xl font-semibold">{typedLesson.title}</h1>

      {typedLesson.type === "BLOCK" ? (
        <BlockEditor
          lessonId={lessonId}
          initialBlocks={(blocks ?? []) as Block[]}
          courseLessons={(courseLessons ?? []).filter((l) => l.id !== lessonId)}
          orgId={session.org.id}
          tier={session.org.subscription_tier}
          liveSessions={(liveSessions ?? []) as LiveSession[]}
          interactiveBlocksByBlockId={interactiveBlocksByBlockId}
        />
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
