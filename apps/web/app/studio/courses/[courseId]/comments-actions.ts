"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth/session";
import { AuthError } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";

// Not tier- or role-gated beyond being an org member -- feedback is a
// team conversation (Author/Trainer/Reviewer/Org Admin can all post and
// resolve), unlike the content-mutating actions in ./actions.ts.

export async function addComment(courseId: string, text: string) {
  const session = await getSession();
  if (!session) throw new AuthError();
  const trimmed = text.trim();
  if (!trimmed) return;

  const supabase = await createClient();
  await supabase.from("course_comments").insert({
    course_id: courseId,
    author_id: session.userId,
    text: trimmed,
  });

  revalidatePath(`/studio/courses/${courseId}`);
  revalidatePath(`/studio/courses/${courseId}/review`);
}

export async function resolveComment(commentId: string, courseId: string, resolved: boolean) {
  const session = await getSession();
  if (!session) throw new AuthError();

  const supabase = await createClient();
  await supabase.from("course_comments").update({ resolved }).eq("id", commentId);

  revalidatePath(`/studio/courses/${courseId}`);
  revalidatePath(`/studio/courses/${courseId}/review`);
}

export async function deleteComment(commentId: string, courseId: string) {
  const session = await getSession();
  if (!session) throw new AuthError();

  const supabase = await createClient();
  await supabase.from("course_comments").delete().eq("id", commentId).eq("author_id", session.userId);

  revalidatePath(`/studio/courses/${courseId}`);
  revalidatePath(`/studio/courses/${courseId}/review`);
}
