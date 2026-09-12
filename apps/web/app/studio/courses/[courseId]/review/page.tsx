import { requireTierOrRedirect } from "@/lib/auth/requireTier";
import { requireCourseAccess } from "@/lib/auth/requireCourseAccess";
import { getCourseOutline } from "@/app/c/[slug]/data";
import { getCourseComments } from "@/lib/comments/data";
import { CommentsPanel } from "../CommentsPanel";

/** Read-only preview + feedback for the REVIEWER role (§7.12) -- no
 *  edit/drag/delete controls, just the outline and a comment thread. The
 *  main editor page redirects REVIEWERs here, since they can't act on
 *  anything there anyway; other roles can also open this directly as a
 *  clean "what does this look like to a reviewer" preview. */
export default async function CourseReviewPage({
  params,
}: {
  params: Promise<{ courseId: string }>;
}) {
  const session = await requireTierOrRedirect("PRO");
  const { courseId } = await params;
  const course = await requireCourseAccess(courseId, session);

  const { sections, lessons } = await getCourseOutline(courseId);
  const lessonsBySection = new Map<string, typeof lessons>();
  for (const lesson of lessons) {
    const list = lessonsBySection.get(lesson.section_id) ?? [];
    list.push(lesson);
    lessonsBySection.set(lesson.section_id, list);
  }
  for (const list of lessonsBySection.values()) list.sort((a, b) => a.order - b.order);
  const orderedSections = [...sections].sort((a, b) => a.order - b.order);

  const comments = await getCourseComments(courseId);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">{course.title}</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Read-only preview — leave feedback below.
        </p>
      </div>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-medium">Outline</h2>
        {orderedSections.length === 0 && (
          <p className="text-sm text-black/50 dark:text-white/50">No lessons yet.</p>
        )}
        {orderedSections.map((section) => (
          <div key={section.id} className="flex flex-col gap-1">
            <h3 className="text-sm font-medium text-black/70 dark:text-white/70">
              {section.title}
            </h3>
            <ul className="flex flex-col divide-y divide-black/10 rounded border border-black/10 dark:divide-white/10 dark:border-white/10">
              {(lessonsBySection.get(section.id) ?? []).map((lesson) => (
                <li key={lesson.id} className="flex items-center justify-between px-4 py-2 text-sm">
                  <span>{lesson.title}</span>
                  <span className="text-xs text-black/50 dark:text-white/50">{lesson.type}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <CommentsPanel courseId={courseId} comments={comments} currentUserId={session.userId} />
    </div>
  );
}
