import Link from "next/link";
import { Check, Lock, X } from "lucide-react";
import type { Course, Lesson, LearnerProgress, Section, Theme } from "@/lib/types/db";
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
  if (status === "completed" || status === "passed") {
    return <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" aria-hidden />;
  }
  if (status === "failed") {
    return <X className="h-3.5 w-3.5 text-red-600 dark:text-red-400" aria-hidden />;
  }
  return null;
}

export function CourseShell({
  course,
  sections,
  lessons,
  progress,
  activeLessonId,
  theme,
  children,
}: {
  course: Course;
  sections: Section[];
  lessons: Lesson[];
  progress: Record<string, LearnerProgress>;
  activeLessonId?: string;
  theme?: Theme | null;
  children: React.ReactNode;
}) {
  const ordered = flattenLessonOrder(sections, lessons);
  const wideLayout = theme?.layout_config?.width === "wide";
  // color/font-family are inherited CSS properties, so setting them once on
  // the outer wrapper is enough to theme every descendant (headings, block
  // content, etc.) that doesn't set its own explicit color/font class.
  const themeStyle: React.CSSProperties | undefined = theme
    ? {
        backgroundColor: theme.colors.background,
        color: theme.colors.text,
        fontFamily: theme.fonts.body,
      }
    : undefined;
  const accentColor = theme?.colors.primary;
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
                      <li
                        key={lesson.id}
                        className="flex items-center gap-1.5 text-black/30 dark:text-white/30"
                      >
                        <Lock className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        {lesson.title}
                      </li>
                    );
                  }
                  return (
                    <li key={lesson.id}>
                      <Link
                        href={`/c/${course.publish_slug}/lessons/${lesson.id}`}
                        className={`inline-flex items-center gap-1.5 ${isActive ? "font-semibold underline" : "hover:underline"}`}
                        style={isActive && accentColor ? { color: accentColor } : undefined}
                      >
                        {badge}
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
    <div
      className={`mx-auto flex min-h-screen flex-col gap-6 px-4 py-8 sm:flex-row ${
        wideLayout ? "max-w-7xl" : "max-w-5xl"
      }`}
      style={themeStyle}
    >
      {showSidebar &&
        (collapsed ? (
          <details className="sm:hidden">
            <summary className="cursor-pointer text-sm font-medium">Course outline</summary>
            <div className="mt-2">{sidebar}</div>
          </details>
        ) : null)}
      {showSidebar && (
        <aside className={`w-full shrink-0 sm:w-56 ${collapsed ? "hidden sm:block" : ""}`}>
          {theme?.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={theme.logo_url} alt="" className="mb-4 h-8 w-auto" />
          )}
          {sidebar}
        </aside>
      )}
      <main className="min-w-0 flex-1">
        {!showSidebar && theme?.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={theme.logo_url} alt="" className="mb-4 h-8 w-auto" />
        )}
        {children}
      </main>
    </div>
  );
}
