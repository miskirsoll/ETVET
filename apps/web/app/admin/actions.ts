"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import type { SubscriptionTier } from "@/lib/types/db";

export async function setOrgTierAsAdmin(orgId: string, tier: SubscriptionTier) {
  await requireRole("SUPER_ADMIN");
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_set_org_tier", { p_org_id: orgId, p_tier: tier });
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
}
