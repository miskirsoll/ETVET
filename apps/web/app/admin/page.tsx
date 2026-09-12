import Link from "next/link";
import { requireRoleOrRedirect } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import { OrgsTable, type AdminOrgRow } from "./OrgsTable";

export default async function AdminPage() {
  await requireRoleOrRedirect("SUPER_ADMIN");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_list_organizations");
  const orgs = (data ?? []) as AdminOrgRow[];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <Link href="/studio" className="text-sm hover:underline">
        ← Back to Studio
      </Link>
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

      <div className="grid grid-cols-3 gap-4 text-center sm:grid-cols-3">
        <Stat label="Organizations" value={orgs.length} />
        <Stat
          label="Members"
          value={orgs.reduce((sum, o) => sum + Number(o.member_count), 0)}
        />
        <Stat
          label="Courses"
          value={orgs.reduce((sum, o) => sum + Number(o.course_count), 0)}
        />
      </div>

      <OrgsTable orgs={orgs} />
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-black/10 p-4 dark:border-white/10">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-sm text-black/50 dark:text-white/50">{label}</div>
    </div>
  );
}
