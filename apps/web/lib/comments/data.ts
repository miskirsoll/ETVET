import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CourseComment } from "@/lib/types/db";

export interface CommentWithAuthor extends CourseComment {
  authorName: string;
}

export async function getCourseComments(courseId: string): Promise<CommentWithAuthor[]> {
  const supabase = await createClient();
  const { data: comments } = await supabase
    .from("course_comments")
    .select("*")
    .eq("course_id", courseId)
    .order("created_at", { ascending: false });

  const authorIds = [...new Set(((comments ?? []) as CourseComment[]).map((c) => c.author_id))];
  const { data: authors } = authorIds.length
    ? await supabase.from("users").select("id, display_name").in("id", authorIds)
    : { data: [] as { id: string; display_name: string | null }[] };
  const nameById = new Map((authors ?? []).map((a) => [a.id, a.display_name]));

  return ((comments ?? []) as CourseComment[]).map((c) => ({
    ...c,
    authorName: nameById.get(c.author_id) || "(no name set)",
  }));
}
