import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLearnerKey } from "@/lib/learner/session";
import type { Block, InteractiveBlock, Lesson, Question, QuestionChoice } from "@/lib/types/db";
import {
  getPublishedCourseBySlug,
  getCourseOutline,
  getProgressMap,
  flattenLessonOrder,
  getCourseTheme,
} from "../../data";
import { CourseShell } from "../../CourseShell";
import { BlockView } from "./BlockView";
import { QuizRunner } from "./QuizRunner";
import { CompleteButton } from "./CompleteButton";

export default async function LessonPage({
  params,
}: {
  params: Promise<{ slug: string; lessonId: string }>;
}) {
  const { slug, lessonId } = await params;
  const course = await getPublishedCourseBySlug(slug);
  if (!course) notFound();

  if (course.publish_password) {
    const cookieStore = await cookies();
    const unlocked = cookieStore.get(`etvet_unlock_${slug}`)?.value === "1";
    if (!unlocked) redirect(`/c/${slug}`);
  }

  const { sections, lessons } = await getCourseOutline(course.id);
  const lesson = lessons.find((l) => l.id === lessonId);
  if (!lesson) notFound();

  const key = await getLearnerKey();
  const progress = await getProgressMap(course.id, key);
  const theme = await getCourseTheme(course.theme_id);
  const ordered = flattenLessonOrder(sections, lessons);
  const index = ordered.findIndex((l) => l.id === lessonId);

  // Sequential navigation is enforced server-side here too, not just by
  // hiding the sidebar link -- a learner could otherwise deep-link past a
  // locked lesson directly by URL.
  if (course.nav_settings.navigation === "sequential" && index > 0) {
    const prevStatus = progress[ordered[index - 1].id]?.status;
    if (prevStatus !== "completed" && prevStatus !== "passed") {
      redirect(`/c/${slug}/lessons/${ordered[index - 1].id}`);
    }
  }

  const nextLesson = ordered[index + 1] ?? null;
  const nextHref = nextLesson ? `/c/${slug}/lessons/${nextLesson.id}` : null;

  const supabase = await createClient();

  if (lesson.type === "BLOCK") {
    const { data: blocks } = await supabase
      .from("blocks")
      .select("*")
      .eq("lesson_id", lessonId)
      .order("order");

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
      <CourseShell
        course={course}
        sections={sections}
        lessons={lessons}
        progress={progress}
        activeLessonId={lessonId}
        theme={theme}
      >
        <h1 className="mb-6 text-2xl font-semibold">{lesson.title}</h1>
        <BlockView
          blocks={(blocks ?? []) as Block[]}
          slug={slug}
          nextHref={nextHref}
          theme={theme}
          interactiveBlocksByBlockId={interactiveBlocksByBlockId}
        />
        <div className="mt-8">
          <CompleteButton
            courseId={course.id}
            lessonId={lessonId}
            nextHref={nextHref}
            accentColor={theme?.colors.primary}
          />
        </div>
      </CourseShell>
    );
  }

  const { data: questions } = await supabase
    .from("questions")
    .select("*")
    .eq("lesson_id", lessonId)
    .order("order");
  const questionIds = (questions ?? []).map((q) => q.id);
  const { data: choices } = questionIds.length
    ? await supabase.from("question_choices").select("*").in("question_id", questionIds).order("order")
    : { data: [] as QuestionChoice[] };

  const choicesByQuestion: Record<string, QuestionChoice[]> = {};
  for (const c of (choices ?? []) as QuestionChoice[]) {
    (choicesByQuestion[c.question_id] ??= []).push(c);
  }

  return (
    <CourseShell
      course={course}
      sections={sections}
      lessons={lessons}
      progress={progress}
      activeLessonId={lessonId}
      theme={theme}
    >
      <h1 className="mb-6 text-2xl font-semibold">{lesson.title}</h1>
      <QuizRunner
        courseId={course.id}
        lesson={lesson as Lesson}
        questions={(questions ?? []) as Question[]}
        choicesByQuestion={choicesByQuestion}
        nextHref={nextHref}
        accentColor={theme?.colors.primary}
      />
    </CourseShell>
  );
}
