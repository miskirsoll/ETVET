import "server-only";
import { redirect } from "next/navigation";
import { getSession, type Session } from "@/lib/auth/session";
import type { OrgRole, SubscriptionTier } from "@/lib/types/db";

const TIER_RANK: Record<SubscriptionTier, number> = { FREE: 0, PRO: 1, MAXPRO: 2 };

export function tierMeets(tier: SubscriptionTier, minTier: SubscriptionTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[minTier];
}

export class TierError extends Error {
  constructor(public required: SubscriptionTier) {
    super(`Requires ${required} subscription tier`);
  }
}

export class AuthError extends Error {
  constructor() {
    super("Not authenticated");
  }
}

/**
 * The gating guard the whole platform depends on. Call this at the top of
 * every protected Server Action and Route Handler — Server Component pages
 * that render forms are NOT a security boundary on their own (a POST can
 * always be sent directly), so this must run server-side on every mutating
 * or tier-restricted entry point, not just be inferred from what the UI
 * shows. Throws (rather than redirecting) so callers can turn it into a
 * form error; page-level guards should use `requireTierOrRedirect` instead.
 */
export async function requireTier(minTier: SubscriptionTier): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AuthError();
  if (!tierMeets(session.org.subscription_tier, minTier)) {
    throw new TierError(minTier);
  }
  return session;
}

/** Page-level guard: redirects instead of throwing, for use in Server Components. */
export async function requireTierOrRedirect(minTier: SubscriptionTier): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!tierMeets(session.org.subscription_tier, minTier)) {
    redirect(`/upgrade?required=${minTier}`);
  }
  return session;
}

export async function requireAuthOrRedirect(): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export class RoleError extends Error {
  constructor(public allowed: OrgRole[]) {
    super(`Requires one of: ${allowed.join(", ")}`);
  }
}

/** RBAC guard: enforced server-side, not inferred from what a page renders. */
export async function requireRole(...allowed: OrgRole[]): Promise<Session> {
  const session = await getSession();
  if (!session) throw new AuthError();
  if (!allowed.includes(session.appUser.role)) throw new RoleError(allowed);
  return session;
}
