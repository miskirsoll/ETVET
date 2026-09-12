import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { AppUser, Organization } from "@/lib/types/db";

export interface Session {
  userId: string;
  appUser: AppUser;
  org: Organization;
}

/**
 * Loads the current caller's identity: auth user, their `users` row, and
 * their organization (with its subscription_tier). Returns null when there
 * is no authenticated session. This is the one place that resolves "who is
 * calling and what org/tier are they in" — every guard below builds on it.
 */
export async function getSession(): Promise<Session | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: appUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!appUser) return null;

  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", appUser.org_id)
    .single();
  if (!org) return null;

  return { userId: user.id, appUser: appUser as AppUser, org: org as Organization };
}
