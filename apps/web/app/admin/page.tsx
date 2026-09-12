import { BookOpen, Building2, Users, type LucideIcon } from "lucide-react";
import { requireRoleOrRedirect } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/BackLink";
import { OrgsTable, type AdminOrgRow } from "./OrgsTable";

export default async function AdminPage() {
  await requireRoleOrRedirect("SUPER_ADMIN");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_organizations");
  const orgs = (data ?? []) as AdminOrgRow[];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <BackLink href="/studio">Back to Studio</BackLink>
      <div>
        <h1 className="text-2xl font-semibold">Platform admin</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Every organization on ETVET, for support purposes only — not a customer-facing
          surface.
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600">Couldn&apos;t load organizations: {error.message}</p>
      )}

      <div className="grid grid-cols-3 gap-4 sm:grid-cols-3">
        <Stat icon={Building2} label="Organizations" value={orgs.length} />
        <Stat
          icon={Users}
          label="Members"
          value={orgs.reduce((sum, o) => sum + Number(o.member_count), 0)}
        />
        <Stat
          icon={BookOpen}
          label="Courses"
          value={orgs.reduce((sum, o) => sum + Number(o.course_count), 0)}
        />
      </div>

      <OrgsTable orgs={orgs} />
    </main>
  );
}

function Stat({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: number }) {
  return (
    <div className="flex items-start gap-3 rounded border border-black/10 p-4 shadow-sm dark:border-white/10">
      <div className="rounded-full bg-brand-subtle p-2 text-brand-text">
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div>
        <div className="text-2xl font-semibold">{value}</div>
        <div className="text-sm text-black/50 dark:text-white/50">{label}</div>
      </div>
    </div>
  );
}
