import { cookies } from "next/headers";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";

const ANON_COOKIE = "etvet_anon";

export interface LearnerKey {
  userId: string | null;
  anonToken: string | null;
}

/**
 * Read-only: safe in Server Components. Never creates a token -- creating
 * one requires writing a cookie, which only a Server Action/Route Handler
 * can do. A visitor who hasn't triggered a progress-writing action yet
 * simply has no anon token, which is fine since there's nothing to look up
 * for them either.
 */
export async function getLearnerKey(): Promise<LearnerKey> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { userId: user.id, anonToken: null };

  const cookieStore = await cookies();
  const anonToken = cookieStore.get(ANON_COOKIE)?.value ?? null;
  return { userId: null, anonToken };
}

/**
 * Server Action only: resolves the same identity as getLearnerKey(), but
 * mints and persists a new anon token cookie on first write if the visitor
 * is both unauthenticated and has none yet.
 */
export async function getOrCreateLearnerKey(): Promise<LearnerKey> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) return { userId: user.id, anonToken: null };

  const cookieStore = await cookies();
  let anonToken = cookieStore.get(ANON_COOKIE)?.value;
  if (!anonToken) {
    anonToken = randomUUID();
    cookieStore.set(ANON_COOKIE, anonToken, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return { userId: null, anonToken };
}
