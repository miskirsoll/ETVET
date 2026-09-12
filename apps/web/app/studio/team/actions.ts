"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import type { OrgInvite, OrgRole } from "@/lib/types/db";

const INVITABLE_ROLES: OrgRole[] = ["AUTHOR", "TRAINER", "REVIEWER"];

export async function createInvite(role: OrgRole, email: string): Promise<OrgInvite> {
  const session = await requireRole("ORG_ADMIN");
  if (!INVITABLE_ROLES.includes(role)) {
    throw new Error("Can only invite as Author, Trainer, or Reviewer.");
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("org_invites")
    .insert({
      org_id: session.org.id,
      role,
      created_by: session.userId,
      email: email.trim() || null,
    })
    .select("*")
    .single();
  if (error) throw new Error(error.message);

  revalidatePath("/studio/team");
  return data as OrgInvite;
}

export async function revokeInvite(inviteId: string) {
  await requireRole("ORG_ADMIN");
  const supabase = await createClient();
  await supabase.from("org_invites").delete().eq("id", inviteId);
  revalidatePath("/studio/team");
}
