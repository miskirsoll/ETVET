import Link from "next/link";
import { BookOpen, Copy, Trash2 } from "lucide-react";
import { requireTierOrRedirect } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import { EmptyState } from "@/components/EmptyState";
import { createCourse, duplicateCourse, deleteCourse } from "./actions";
import type { Course } from "@/lib/types/db";

function StatusPill({ status }: { status: Course["status"] }) {
  const isPublished = status === "PUBLISHED";
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        isPublished
          ? "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
          : "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60"
      }`}
    >
      {isPublished ? "Published" : "Draft"}
    </span>
  );
}

export default async function CoursesDashboard() {
  const session = await requireTierOrRedirect("PRO");
  const supabase = await createClient();
  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("org_id", session.org.id)
    .order("updated_at", { ascending: false });
  const list = (courses ?? []) as Course[];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Courses</h1>
      </div>

      <form action={createCourse} className="flex gap-2">
        <input
          type="text"
          name="title"
          placeholder="New course title"
          required
          className="flex-1 rounded border border-black/10 px-3 py-2 dark:border-white/20"
        />
        <button type="submit" className="rounded bg-brand px-4 py-2 text-brand-foreground">
          Create course
        </button>
      </form>

      {list.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="No courses yet — create your first one above."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {list.map((course) => (
            <li
              key={course.id}
              className="flex items-center justify-between rounded border border-black/10 px-4 py-3 shadow-sm transition-shadow hover:shadow-md dark:border-white/10"
            >
              <Link
                href={`/studio/courses/${course.id}`}
                className="flex flex-1 items-center gap-3"
              >
                {course.cover_image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={course.cover_image_url}
                    alt=""
                    className="h-10 w-16 shrink-0 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded bg-black/5 dark:bg-white/5">
                    <BookOpen className="h-4 w-4 text-black/25 dark:text-white/25" aria-hidden />
                  </div>
                )}
                <span className="flex items-center gap-2">
                  <span className="font-medium hover:underline">{course.title}</span>
                  <StatusPill status={course.status} />
                </span>
              </Link>
              <div className="flex gap-3">
                <form action={duplicateCourse}>
                  <input type="hidden" name="id" value={course.id} />
                  <button
                    type="submit"
                    aria-label={`Duplicate ${course.title}`}
                    className="flex items-center gap-1 text-sm text-black/60 hover:underline dark:text-white/60"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden />
                    Duplicate
                  </button>
                </form>
                <form action={deleteCourse}>
                  <input type="hidden" name="id" value={course.id} />
                  <button
                    type="submit"
                    aria-label={`Delete ${course.title}`}
                    className="flex items-center gap-1 text-sm text-red-600 hover:underline"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
