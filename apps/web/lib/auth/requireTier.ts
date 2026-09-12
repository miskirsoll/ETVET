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

export class ReadOnlyRoleError extends Error {
  constructor() {
    super("Reviewers have read-only access and can't make changes.");
  }
}

/**
 * Same as requireTier, but additionally blocks the read-only REVIEWER
 * role -- for every Server Action that actually mutates data (create,
 * update, delete, publish, reorder, session control, ...). requireTier
 * itself stays permissive of REVIEWER (e.g. viewing a tier-gated page, or
 * exporting a SCORM package, is a read -- not something a reviewer needs
 * blocked from), so this is a separate guard layered on top rather than
 * baked into requireTier for every caller.
 */
export async function requireEditTier(minTier: SubscriptionTier): Promise<Session> {
  const session = await requireTier(minTier);
  if (session.appUser.role === "REVIEWER") throw new ReadOnlyRoleError();
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

/** Page-level RBAC guard: redirects instead of throwing, for use in Server Components. */
export async function requireRoleOrRedirect(...allowed: OrgRole[]): Promise<Session> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!allowed.includes(session.appUser.role)) redirect("/studio");
  return session;
}
