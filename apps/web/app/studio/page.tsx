import Link from "next/link";
import { requireTierOrRedirect } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import { createCourse, duplicateCourse, deleteCourse } from "./actions";
import type { Course } from "@/lib/types/db";

export default async function CoursesDashboard() {
  const session = await requireTierOrRedirect("PRO");
  const supabase = await createClient();
  const { data: courses } = await supabase
    .from("courses")
    .select("*")
    .eq("org_id", session.org.id)
    .order("updated_at", { ascending: false });

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
        <button type="submit" className="rounded bg-foreground px-4 py-2 text-background">
          Create course
        </button>
      </form>

      <ul className="flex flex-col gap-3">
        {(courses as Course[] | null)?.map((course) => (
          <li
            key={course.id}
            className="flex items-center justify-between rounded border border-black/10 px-4 py-3 dark:border-white/10"
          >
            <Link
              href={`/studio/courses/${course.id}`}
              className="flex flex-1 items-center gap-3 hover:underline"
            >
              {course.cover_image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={course.cover_image_url}
                  alt=""
                  className="h-10 w-16 shrink-0 rounded object-cover"
                />
              ) : (
                <div className="h-10 w-16 shrink-0 rounded bg-black/5 dark:bg-white/5" />
              )}
              <span>
                <span className="font-medium">{course.title}</span>{" "}
                <span className="text-xs text-black/50 dark:text-white/50">{course.status}</span>
              </span>
            </Link>
            <div className="flex gap-2">
              <form action={duplicateCourse}>
                <input type="hidden" name="id" value={course.id} />
                <button type="submit" className="text-sm text-black/60 hover:underline dark:text-white/60">
                  Duplicate
                </button>
              </form>
              <form action={deleteCourse}>
                <input type="hidden" name="id" value={course.id} />
                <button type="submit" className="text-sm text-red-600 hover:underline">
                  Delete
                </button>
              </form>
            </div>
          </li>
        ))}
        {(!courses || courses.length === 0) && (
          <p className="text-sm text-black/50 dark:text-white/50">
            No courses yet — create your first one above.
          </p>
        )}
      </ul>
    </div>
  );
}
