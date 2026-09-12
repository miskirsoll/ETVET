"use client";

import { useState, useTransition } from "react";
import { Building2 } from "lucide-react";
import { TierBadge } from "@/components/TierBadge";
import { EmptyState } from "@/components/EmptyState";
import type { SubscriptionTier } from "@/lib/types/db";
import { setOrgTierAsAdmin } from "./actions";

export interface AdminOrgRow {
  org_id: string;
  name: string;
  subscription_tier: SubscriptionTier;
  created_at: string;
  member_count: number;
  course_count: number;
}

const TIERS: SubscriptionTier[] = ["FREE", "PRO", "MAXPRO"];

export function OrgsTable({ orgs }: { orgs: AdminOrgRow[] }) {
  if (orgs.length === 0) {
    return <EmptyState icon={Building2} title="No organizations yet." />;
  }

  return (
    <table className="w-full overflow-hidden rounded border border-black/10 text-left text-sm shadow-sm dark:border-white/10">
      <thead className="bg-black/5 dark:bg-white/5">
        <tr>
          <th scope="col" className="px-3 py-2 font-medium">
            Organization
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Tier
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Members
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Courses
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Created
          </th>
          <th scope="col" className="px-3 py-2 font-medium">
            Override tier
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-black/10 dark:divide-white/10">
        {orgs.map((org) => (
          <OrgRow key={org.org_id} org={org} />
        ))}
      </tbody>
    </table>
  );
}

function OrgRow({ org }: { org: AdminOrgRow }) {
  const [pending, startTransition] = useTransition();
  const [tier, setTier] = useState<SubscriptionTier>(org.subscription_tier);

  return (
    <tr>
      <td className="px-3 py-2">{org.name}</td>
      <td className="px-3 py-2">
        <TierBadge tier={org.subscription_tier} />
      </td>
      <td className="px-3 py-2">{org.member_count}</td>
      <td className="px-3 py-2">{org.course_count}</td>
      <td className="px-3 py-2 text-black/50 dark:text-white/50">
        {new Date(org.created_at).toLocaleDateString()}
      </td>
      <td className="px-3 py-2">
        <div className="flex items-center gap-2">
          <label className="sr-only" htmlFor={`tier-${org.org_id}`}>
            Override tier for {org.name}
          </label>
          <select
            id={`tier-${org.org_id}`}
            value={tier}
            onChange={(e) => setTier(e.target.value as SubscriptionTier)}
            className="rounded border border-black/15 px-2 py-1 text-xs dark:border-white/20"
          >
            {TIERS.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={pending || tier === org.subscription_tier}
            onClick={() => startTransition(async () => { await setOrgTierAsAdmin(org.org_id, tier); })}
            className="rounded border border-black/15 px-2 py-1 text-xs disabled:opacity-50 dark:border-white/20"
          >
            Set
          </button>
        </div>
      </td>
    </tr>
  );
}
