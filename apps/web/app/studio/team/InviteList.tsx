"use client";

import { useState, useTransition } from "react";
import type { OrgInvite } from "@/lib/types/db";
import { revokeInvite } from "./actions";

export function InviteList({ invites }: { invites: OrgInvite[] }) {
  if (invites.length === 0) {
    return <p className="text-sm text-black/50 dark:text-white/50">No pending invites.</p>;
  }

  return (
    <ul className="flex flex-col divide-y divide-black/10 rounded border border-black/10 dark:divide-white/10 dark:border-white/10">
      {invites.map((invite) => (
        <InviteRow key={invite.id} invite={invite} />
      ))}
    </ul>
  );
}

function InviteRow({ invite }: { invite: OrgInvite }) {
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();
  const expired = new Date(invite.expires_at) < new Date();

  return (
    <li className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
      <div className="flex flex-col">
        <span>
          {invite.role}
          {invite.email && <span className="text-black/50 dark:text-white/50"> · {invite.email}</span>}
        </span>
        <span className="text-xs text-black/50 dark:text-white/50">
          {expired ? "Expired" : `Expires ${new Date(invite.expires_at).toLocaleDateString()}`}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/signup?invite=${invite.token}`);
            setCopied(true);
          }}
          className="rounded border border-black/15 px-3 py-1 dark:border-white/20"
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => { await revokeInvite(invite.id); })}
          className="rounded border border-black/15 px-3 py-1 text-red-600 disabled:opacity-50 dark:border-white/20"
        >
          Revoke
        </button>
      </div>
    </li>
  );
}
