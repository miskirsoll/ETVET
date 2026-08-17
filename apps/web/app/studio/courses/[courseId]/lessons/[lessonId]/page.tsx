import Link from "next/link";
import { notFound } from "next/navigation";
import { requireTierOrRedirect } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import type { Block, Lesson } from "@/lib/types/db";
import { BlockEditor } from "./BlockEditor";

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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Link href={`/studio/courses/${courseId}`} className="text-sm hover:underline">
        ← Back to outline
      </Link>
      <h1 className="text-2xl font-semibold">{typedLesson.title}</h1>

      {typedLesson.type === "BLOCK" ? (
        <BlockEditor lessonId={lessonId} initialBlocks={(blocks ?? []) as Block[]} />
      ) : (
        <p className="rounded border border-black/10 p-6 text-sm text-black/60 dark:border-white/10 dark:text-white/60">
          Quiz Lesson editor is coming in the next milestone (multiple choice + true/false
          first, per the build plan). This lesson is stored as a Quiz Lesson so the outline
          structure is already in place.
        </p>
      )}
    </div>
  );
}
