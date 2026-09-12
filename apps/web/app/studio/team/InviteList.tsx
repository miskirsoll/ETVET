"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Mail, Trash2 } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { Spinner } from "@/components/Spinner";
import type { OrgInvite } from "@/lib/types/db";
import { revokeInvite } from "./actions";

export function InviteList({ invites }: { invites: OrgInvite[] }) {
  if (invites.length === 0) {
    return <EmptyState icon={Mail} title="No pending invites." />;
  }

  return (
    <ul className="flex flex-col divide-y divide-black/10 rounded border border-black/10 shadow-sm dark:divide-white/10 dark:border-white/10">
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
          className="flex items-center gap-1.5 rounded border border-black/15 px-3 py-1 dark:border-white/20"
        >
          {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
          {copied ? "Copied!" : "Copy link"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => { await revokeInvite(invite.id); })}
          className="flex items-center gap-1.5 rounded border border-black/15 px-3 py-1 text-red-600 disabled:opacity-50 dark:border-white/20"
        >
          {pending ? <Spinner className="h-3.5 w-3.5" /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
          Revoke
        </button>
      </div>
    </li>
  );
}
