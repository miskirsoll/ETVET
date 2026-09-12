import { requireRoleOrRedirect } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/Avatar";
import type { AppUser, OrgInvite } from "@/lib/types/db";
import { InviteForm } from "./InviteForm";
import { InviteList } from "./InviteList";

export default async function TeamPage() {
  const session = await requireRoleOrRedirect("ORG_ADMIN");
  const supabase = await createClient();

  const { data: members } = await supabase
    .from("users")
    .select("*")
    .eq("org_id", session.org.id)
    .order("created_at");

  const { data: invites } = await supabase
    .from("org_invites")
    .select("*")
    .eq("org_id", session.org.id)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold">Team</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          {session.org.name} — invite teammates as Author, Trainer, or Reviewer. There&apos;s no
          outbound email yet, so copy the generated link and send it yourself.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Members</h2>
        <ul className="flex flex-col divide-y divide-black/10 rounded border border-black/10 shadow-sm dark:divide-white/10 dark:border-white/10">
          {((members ?? []) as AppUser[]).map((m) => {
            const name = m.display_name || "(no name set)";
            return (
              <li key={m.id} className="flex items-center justify-between px-4 py-2 text-sm">
                <span className="flex items-center gap-2">
                  <Avatar name={name} />
                  {name}
                </span>
                <span className="rounded-full bg-black/5 px-2 py-0.5 text-xs text-black/60 dark:bg-white/10 dark:text-white/60">
                  {m.role}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Invite a teammate</h2>
        <InviteForm />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Pending invites</h2>
        <InviteList invites={(invites ?? []) as OrgInvite[]} />
      </section>
    </div>
  );
}
