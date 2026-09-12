"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { Spinner } from "@/components/Spinner";
import type { OrgRole } from "@/lib/types/db";
import { createInvite } from "./actions";

const ROLES: { value: OrgRole; label: string }[] = [
  { value: "AUTHOR", label: "Author" },
  { value: "TRAINER", label: "Trainer" },
  { value: "REVIEWER", label: "Reviewer" },
];

export function InviteForm() {
  const [role, setRole] = useState<OrgRole>("AUTHOR");
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          setCopied(false);
          startTransition(async () => {
            try {
              const invite = await createInvite(role, email);
              setLink(`${window.location.origin}/signup?invite=${invite.token}`);
              setEmail("");
            } catch (err) {
              setError(err instanceof Error ? err.message : "Failed to create invite.");
            }
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          Role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as OrgRole)}
            className="rounded border border-black/10 px-3 py-2 dark:border-white/20"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Email (optional, for your own reference)
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded border border-black/10 px-3 py-2 dark:border-white/20"
          />
        </label>
        <button
          type="submit"
          disabled={pending}
          className="flex items-center gap-1.5 rounded bg-brand px-4 py-2 text-sm text-brand-foreground disabled:opacity-50"
        >
          {pending ? <Spinner className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" aria-hidden />}
          {pending ? "Creating…" : "Create invite link"}
        </button>
      </form>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {link && (
        <div className="flex items-center gap-2 rounded border border-black/10 p-3 text-sm dark:border-white/20">
          <code className="flex-1 truncate">{link}</code>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(link);
              setCopied(true);
            }}
            className="flex items-center gap-1 rounded border border-black/15 px-3 py-1 dark:border-white/20"
          >
            {copied ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
    </div>
  );
}
