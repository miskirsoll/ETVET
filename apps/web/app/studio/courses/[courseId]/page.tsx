import Link from "next/link";
import { redirect } from "next/navigation";
import { requireTierOrRedirect } from "@/lib/auth/requireTier";
import { requireCourseAccess } from "@/lib/auth/requireCourseAccess";
import { createClient } from "@/lib/supabase/server";
import { getCourseComments } from "@/lib/comments/data";
import type { Lesson, Section, Theme } from "@/lib/types/db";
import { OutlineEditor } from "./OutlineEditor";
import { PublishPanel } from "./PublishPanel";
import { ThemeSelector } from "./ThemeSelector";
import { CourseCoverField } from "./CourseCoverField";
import { ScormExportButton } from "./ScormExportButton";
import { CommentsPanel } from "./CommentsPanel";

export default async function CourseOutlinePage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await requireTierOrRedirect("PRO");
  const { courseId } = await params;
  const course = await requireCourseAccess(courseId, session);

  // REVIEWERs can't act on anything in this editor (§7.12: read-only +
  // commenting role) -- send them to the purpose-built preview instead of
  // a half-disabled version of this page.
  if (session.appUser.role === "REVIEWER") {
    redirect(`/studio/courses/${courseId}/review`);
  }

  const supabase = await createClient();

  const { data: themes } = await supabase
    .from("themes")
    .select("*")
    .eq("org_id", session.org.id)
    .order("created_at", { ascending: false });

  const { data: sections } = await supabase
    .from("sections")
    .select("*")
    .eq("course_id", courseId)
    .order("order");

  const sectionIds = (sections ?? []).map((s) => s.id);
  const { data: lessons } = sectionIds.length
    ? await supabase.from("lessons").select("*").in("section_id", sectionIds).order("order")
    : { data: [] as Lesson[] };

  const comments = await getCourseComments(courseId);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold">{course.title}</h1>
      <CourseCoverField
        courseId={courseId}
        orgId={session.org.id}
        initialUrl={course.cover_image_url}
      />
      <ThemeSelector
        courseId={courseId}
        currentThemeId={course.theme_id}
        themes={(themes ?? []) as Theme[]}
      />
      <PublishPanel course={course} />
      <div className="flex gap-3">
        <ScormExportButton courseId={courseId} />
        <Link
          href={`/studio/courses/${courseId}/analytics`}
          className="inline-block rounded border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          Analytics {session.org.subscription_tier !== "MAXPRO" && "(MAXPRO)"}
        </Link>
        <Link
          href={`/studio/courses/${courseId}/review`}
          className="inline-block rounded border border-black/15 px-4 py-2 text-sm dark:border-white/20"
        >
          Reviewer preview
        </Link>
      </div>
      <OutlineEditor
        courseId={courseId}
        initialSections={(sections ?? []) as Section[]}
        initialLessons={(lessons ?? []) as Lesson[]}
      />
      <CommentsPanel courseId={courseId} comments={comments} currentUserId={session.userId} />
    </div>
  );
}
