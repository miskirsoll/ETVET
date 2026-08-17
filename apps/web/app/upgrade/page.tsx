import { requireAuthOrRedirect } from "@/lib/auth/requireTier";
import { TierBadge } from "@/components/TierBadge";
import { TierSwitcher } from "./TierSwitcher";

const TIERS: { tier: "FREE" | "PRO" | "MAXPRO"; blurb: string; features: string[] }[] = [
  {
    tier: "FREE",
    blurb: "Try the authoring studio.",
    features: ["1 course, watermarked", "Basic themes", "Basic quiz types"],
  },
  {
    tier: "PRO",
    blurb: "Unlimited course authoring.",
    features: [
      "Unlimited courses",
      "All quiz types & question banks",
      "Custom themes, fonts, logo",
      "SCORM export for Moodle",
      "Team authoring",
    ],
  },
  {
    tier: "MAXPRO",
    blurb: "Authoring + live interactivity.",
    features: [
      "Everything in PRO",
      "Live Interactive Sessions (polls, word clouds, quizzes, Q&A)",
      "Embed live blocks inside courses",
      "Unified analytics dashboard",
      "AI in-course tutor",
    ],
  },
];

export default async function UpgradePage({
  searchParams,
}: {
  searchParams: Promise<{ required?: string }>;
}) {
  const session = await requireAuthOrRedirect();
  const { required } = await searchParams;
  const isOrgAdmin = session.appUser.role === "ORG_ADMIN" || session.appUser.role === "SUPER_ADMIN";

  return (
    <div className="mx-auto flex min-h-screen max-w-4xl flex-col gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">Plans</h1>
        <p className="mt-1 text-sm text-black/60 dark:text-white/60">
          Current plan: <TierBadge tier={session.org.subscription_tier} />
        </p>
        {required && (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-400">
            That feature requires the {required} tier.
          </p>
        )}
        <p className="mt-2 text-xs text-black/40 dark:text-white/40">
          Billing isn&apos;t wired to Stripe yet — switching plans here updates
          subscription_tier directly so gating can be tested end-to-end.
          {!isOrgAdmin && " Only an Org Admin can change the plan."}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {TIERS.map(({ tier, blurb, features }) => (
          <div
            key={tier}
            className="flex flex-col gap-3 rounded border border-black/10 p-5 dark:border-white/10"
          >
            <div className="flex items-center justify-between">
              <TierBadge tier={tier} />
              {session.org.subscription_tier === tier && (
                <span className="text-xs text-black/40 dark:text-white/40">Current</span>
              )}
            </div>
            <p className="text-sm text-black/60 dark:text-white/60">{blurb}</p>
            <ul className="flex flex-1 flex-col gap-1 text-sm">
              {features.map((f) => (
                <li key={f}>• {f}</li>
              ))}
            </ul>
            {isOrgAdmin && session.org.subscription_tier !== tier && (
              <TierSwitcher tier={tier} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
