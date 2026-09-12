import type { SubscriptionTier } from "@/lib/types/db";

const STYLES: Record<SubscriptionTier, string> = {
  FREE: "bg-black/10 text-black/70 dark:bg-white/10 dark:text-white/70",
  PRO: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  MAXPRO: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
};

export function TierBadge({ tier }: { tier: SubscriptionTier }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[tier]}`}>
      {tier}
    </span>
  );
}
