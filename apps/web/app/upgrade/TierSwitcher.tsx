"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setOrgTier } from "./actions";
import type { SubscriptionTier } from "@/lib/types/db";

export function TierSwitcher({ tier }: { tier: SubscriptionTier }) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          await setOrgTier(tier);
          router.refresh();
        })
      }
      className="rounded bg-foreground px-3 py-1.5 text-sm text-background disabled:opacity-50"
    >
      {pending ? "Switching…" : `Switch to ${tier}`}
    </button>
  );
}
