import { requireAuthOrRedirect } from "@/lib/auth/requireTier";
import { LockedFeature } from "@/components/LockedFeature";

export default async function LiveSessionsPage() {
  const session = await requireAuthOrRedirect();

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">Live Sessions</h1>
      <LockedFeature
        currentTier={session.org.subscription_tier}
        requiredTier="MAXPRO"
        featureName="Live Interactive Sessions"
      >
        <div className="rounded border border-black/10 p-8 text-sm text-black/60 dark:border-white/10 dark:text-white/60">
          Session builder (polls, word clouds, quiz/leaderboard slides), join-by-code, and
          present mode ship in Phase 2 of the build plan. This page exists now so the
          MAXPRO gate is wired end-to-end before that UI is built.
        </div>
      </LockedFeature>
    </div>
  );
}
