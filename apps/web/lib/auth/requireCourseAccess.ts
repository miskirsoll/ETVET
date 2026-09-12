import "server-only";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Course } from "@/lib/types/db";
import type { Session } from "@/lib/auth/session";

/**
 * Studio (authoring) pages fetch a course by id and otherwise rely on RLS
 * alone for tenant isolation. But "anyone reads published courses" (the
 * policy the public /c/[slug] renderer needs) isn't scoped to the owning
 * org the way the "org members manage own courses" write policy is --
 * once a course is PUBLISHED, RLS lets any authenticated org's session
 * read that row too. requireTierOrRedirect only checks the caller's own
 * tier, not that they own this particular course, so every studio route
 * keyed by courseId needs this explicit check as well.
 */
export async function requireCourseAccess(courseId: string, session: Session): Promise<Course> {
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("*").eq("id", courseId).single();
  if (!course || (course as Course).org_id !== session.org.id) notFound();
  return course as Course;
}
