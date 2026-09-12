import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Block, Lesson, Question, QuestionChoice, Section } from "@/lib/types/db";
import type { CourseExportData, ExportLesson, ExportSection } from "./types";

export async function fetchCourseExportData(courseId: string): Promise<CourseExportData | null> {
  const supabase = await createClient();

  const { data: course } = await supabase
    .from("courses")
    .select("id, title")
    .eq("id", courseId)
    .single();
  if (!course) return null;

  const { data: sections } = await supabase
    .from("sections")
    .select("*")
    .eq("course_id", courseId)
    .order("order");
  const sectionRows = (sections ?? []) as Section[];

  const sectionIds = sectionRows.map((s) => s.id);
  const { data: lessons } = sectionIds.length
    ? await supabase.from("lessons").select("*").in("section_id", sectionIds).order("order")
    : { data: [] as Lesson[] };
  const lessonRows = (lessons ?? []) as Lesson[];

  const blockLessonIds = lessonRows.filter((l) => l.type === "BLOCK").map((l) => l.id);
  const { data: blocks } = blockLessonIds.length
    ? await supabase.from("blocks").select("*").in("lesson_id", blockLessonIds).order("order")
    : { data: [] as Block[] };
  const blockRows = (blocks ?? []) as Block[];

  const quizLessonIds = lessonRows.filter((l) => l.type === "QUIZ").map((l) => l.id);
  const { data: questions } = quizLessonIds.length
    ? await supabase.from("questions").select("*").in("lesson_id", quizLessonIds).order("order")
    : { data: [] as Question[] };
  const questionRows = (questions ?? []) as Question[];

  const questionIds = questionRows.map((q) => q.id);
  const { data: choices } = questionIds.length
    ? await supabase.from("question_choices").select("*").in("question_id", questionIds).order("order")
    : { data: [] as QuestionChoice[] };
  const choiceRows = (choices ?? []) as QuestionChoice[];

  const choicesByQuestion = new Map<string, QuestionChoice[]>();
  for (const c of choiceRows) {
    const list = choicesByQuestion.get(c.question_id) ?? [];
    list.push(c);
    choicesByQuestion.set(c.question_id, list);
  }

  const questionsByLesson = new Map<string, Question[]>();
  for (const q of questionRows) {
    const list = questionsByLesson.get(q.lesson_id) ?? [];
    list.push(q);
    questionsByLesson.set(q.lesson_id, list);
  }

  const blocksByLesson = new Map<string, Block[]>();
  for (const b of blockRows) {
    const list = blocksByLesson.get(b.lesson_id) ?? [];
    list.push(b);
    blocksByLesson.set(b.lesson_id, list);
  }

  const lessonsBySection = new Map<string, Lesson[]>();
  for (const l of lessonRows) {
    const list = lessonsBySection.get(l.section_id) ?? [];
    list.push(l);
    lessonsBySection.set(l.section_id, list);
  }

  const exportSections: ExportSection[] = sectionRows.map((section) => ({
    id: section.id,
    title: section.title,
    lessons: (lessonsBySection.get(section.id) ?? []).map(
      (lesson): ExportLesson => ({
        id: lesson.id,
        type: lesson.type,
        title: lesson.title,
        pass_threshold: lesson.pass_threshold,
        randomize_questions: lesson.randomize_questions,
        draw_count: lesson.draw_count,
        time_limit_seconds: lesson.time_limit_seconds,
        blocks: (blocksByLesson.get(lesson.id) ?? []).map((b) => ({
          id: b.id,
          type: b.type,
          content: b.content,
        })),
        questions: (questionsByLesson.get(lesson.id) ?? []).map((q) => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          choices: (choicesByQuestion.get(q.id) ?? []).map((c) => ({
            id: c.id,
            text: c.text,
            is_correct: c.is_correct,
          })),
        })),
      })
    ),
  }));

  return { id: course.id, title: course.title, sections: exportSections };
}
