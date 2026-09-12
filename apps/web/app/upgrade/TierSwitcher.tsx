"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Spinner } from "@/components/Spinner";
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
      className="flex items-center justify-center gap-1.5 rounded bg-brand px-3 py-1.5 text-sm text-brand-foreground disabled:opacity-50"
    >
      {pending && <Spinner className="h-3.5 w-3.5" />}
      {pending ? "Switching…" : `Switch to ${tier}`}
    </button>
  );
}
