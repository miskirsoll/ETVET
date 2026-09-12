import Link from "next/link";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { getLearnerKey } from "@/lib/learner/session";
import { getPublishedCourseBySlug, getCourseOutline, getProgressMap, flattenLessonOrder } from "./data";
import { PasswordForm } from "./PasswordForm";
import { CourseShell } from "./CourseShell";

export default async function CourseLandingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const course = await getPublishedCourseBySlug(slug);
  if (!course) notFound();

  if (course.publish_password) {
    const cookieStore = await cookies();
    const unlocked = cookieStore.get(`etvet_unlock_${slug}`)?.value === "1";
    if (!unlocked) return <PasswordForm slug={slug} />;
  }

  const { sections, lessons } = await getCourseOutline(course.id);
  const key = await getLearnerKey();
  const progress = await getProgressMap(course.id, key);
  const ordered = flattenLessonOrder(sections, lessons);
  const nextLesson =
    ordered.find((l) => {
      const status = progress[l.id]?.status;
      return status !== "completed" && status !== "passed";
    }) ?? ordered[0];

  return (
    <CourseShell course={course} sections={sections} lessons={lessons} progress={progress}>
      <h1 className="mb-2 text-2xl font-semibold">{course.title}</h1>
      <p className="mb-6 text-sm text-black/60 dark:text-white/60">
        {ordered.length} lesson{ordered.length === 1 ? "" : "s"}
      </p>
      {nextLesson ? (
        <Link
          href={`/c/${slug}/lessons/${nextLesson.id}`}
          className="inline-block rounded bg-foreground px-5 py-2.5 text-background"
        >
          {Object.keys(progress).length > 0 ? "Continue" : "Start course"}
        </Link>
      ) : (
        <p className="text-sm text-black/50 dark:text-white/50">This course has no lessons yet.</p>
      )}
    </CourseShell>
  );
}
