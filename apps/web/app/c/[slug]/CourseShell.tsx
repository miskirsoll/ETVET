import Link from "next/link";
import type { Course, Lesson, LearnerProgress, Section } from "@/lib/types/db";
import { flattenLessonOrder } from "./data";

function isUnlocked(
  index: number,
  ordered: Lesson[],
  progress: Record<string, LearnerProgress>,
  navigation: Course["nav_settings"]["navigation"]
): boolean {
  if (navigation === "free") return true;
  if (index === 0) return true;
  const prev = ordered[index - 1];
  const prevStatus = progress[prev.id]?.status;
  return prevStatus === "completed" || prevStatus === "passed";
}

function statusBadge(status?: LearnerProgress["status"]) {
  if (status === "completed" || status === "passed") return "✓";
  if (status === "failed") return "✗";
  return null;
}

export function CourseShell({
  course,
  sections,
  lessons,
  progress,
  activeLessonId,
  children,
}: {
  course: Course;
  sections: Section[];
  lessons: Lesson[];
  progress: Record<string, LearnerProgress>;
  activeLessonId?: string;
  children: React.ReactNode;
}) {
  const ordered = flattenLessonOrder(sections, lessons);
  const showSidebar = course.nav_settings.sidebar !== "off";
  const collapsed = course.nav_settings.sidebar === "hidden";

  const sidebar = showSidebar && (
    <nav className="flex flex-col gap-3 text-sm">
      {[...sections]
        .sort((a, b) => a.order - b.order)
        .map((section) => (
          <div key={section.id}>
            <p className="mb-1 font-medium text-black/70 dark:text-white/70">{section.title}</p>
            <ul className="flex flex-col gap-1 pl-2">
              {lessons
                .filter((l) => l.section_id === section.id)
                .sort((a, b) => a.order - b.order)
                .map((lesson) => {
                  const index = ordered.findIndex((l) => l.id === lesson.id);
                  const unlocked = isUnlocked(
                    index,
                    ordered,
                    progress,
                    course.nav_settings.navigation
                  );
                  const badge = statusBadge(progress[lesson.id]?.status);
                  const isActive = lesson.id === activeLessonId;
                  if (!unlocked) {
                    return (
                      <li key={lesson.id} className="text-black/30 dark:text-white/30">
                        🔒 {lesson.title}
                      </li>
                    );
                  }
                  return (
                    <li key={lesson.id}>
                      <Link
                        href={`/c/${course.publish_slug}/lessons/${lesson.id}`}
                        className={isActive ? "font-semibold underline" : "hover:underline"}
                      >
                        {badge && <span className="mr-1">{badge}</span>}
                        {lesson.title}
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </div>
        ))}
    </nav>
  );

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-8 sm:flex-row">
      {showSidebar &&
        (collapsed ? (
          <details className="sm:hidden">
            <summary className="cursor-pointer text-sm font-medium">Course outline</summary>
            <div className="mt-2">{sidebar}</div>
          </details>
        ) : null)}
      {showSidebar && (
        <aside className={`w-full shrink-0 sm:w-56 ${collapsed ? "hidden sm:block" : ""}`}>
          {sidebar}
        </aside>
      )}
      <main className="min-w-0 flex-1">{children}</main>
    </div>
  );
}
