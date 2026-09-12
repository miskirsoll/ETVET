import Link from "next/link";
import type { SubscriptionTier } from "@/lib/types/db";
import { tierMeets } from "@/lib/auth/requireTier";

/**
 * Renders `children` when the org's tier is sufficient. Otherwise renders a
 * visibly locked, disabled-looking card with an upgrade CTA — per the spec's
 * explicit rule that MAXPRO-only features must stay visible-but-locked for
 * PRO orgs, never simply hidden.
 */
export function LockedFeature({
  currentTier,
  requiredTier,
  featureName,
  children,
}: {
  currentTier: SubscriptionTier;
  requiredTier: SubscriptionTier;
  featureName: string;
  children: React.ReactNode;
}) {
  if (tierMeets(currentTier, requiredTier)) return <>{children}</>;

  return (
    <div className="pointer-events-none relative select-none opacity-50">
      <div className="pointer-events-auto absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-lg bg-background/70 backdrop-blur-sm">
        <p className="text-sm font-medium">
          {featureName} requires {requiredTier}
        </p>
        <Link
          href={`/upgrade?required=${requiredTier}`}
          className="rounded bg-foreground px-4 py-2 text-sm text-background"
        >
          Upgrade to {requiredTier}
        </Link>
      </div>
      {children}
    </div>
  );
}
