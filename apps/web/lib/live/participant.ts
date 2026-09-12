import { cookies } from "next/headers";
import { randomUUID } from "crypto";

/**
 * Deliberately separate from lib/learner/session.ts's course-progress
 * anon token: a live-session participant token is scoped to one session
 * (cookie name includes the session id) and is meant to be genuinely
 * short-lived/disposable, per the spec's "keep anonymous live-session
 * participation genuinely anonymous by default" -- joining two different
 * sessions should not be correlatable to the same person the way resuming
 * the same course would legitimately want to be.
 */
function cookieName(sessionId: string): string {
  return `etvet_participant_${sessionId}`;
}

function nameCookieName(sessionId: string): string {
  return `etvet_participant_name_${sessionId}`;
}

export async function getParticipantToken(sessionId: string): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(cookieName(sessionId))?.value ?? null;
}

export async function getParticipantDisplayName(sessionId: string): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(nameCookieName(sessionId))?.value ?? null;
}

/** Server Action only (writes cookies). Call when a participant joins. */
export async function joinAsParticipant(sessionId: string, displayName: string): Promise<string> {
  const cookieStore = await cookies();
  const existing = cookieStore.get(cookieName(sessionId))?.value;
  const token = existing ?? randomUUID();

  if (!existing) {
    cookieStore.set(cookieName(sessionId), token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
    });
  }
  if (displayName) {
    cookieStore.set(nameCookieName(sessionId), displayName.slice(0, 60), {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 12,
      path: "/",
    });
  }
  return token;
}
