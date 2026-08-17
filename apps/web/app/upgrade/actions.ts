"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import type { SubscriptionTier } from "@/lib/types/db";

/**
 * Stub for Stripe checkout: flips `subscription_tier` directly so the
 * requireTier() gating is wired end-to-end before real billing exists.
 * Swap the body for a Stripe Checkout session + webhook handler later —
 * every call site that gates on subscription_tier stays unchanged.
 * Restricted to ORG_ADMIN, matching the spec's role table (billing/tier
 * management is an Org Admin responsibility).
 */
export async function setOrgTier(tier: SubscriptionTier) {
  const session = await requireRole("ORG_ADMIN", "SUPER_ADMIN");
  const supabase = await createClient();
  await supabase.from("organizations").update({ subscription_tier: tier }).eq("id", session.org.id);
  revalidatePath("/", "layout");
}
