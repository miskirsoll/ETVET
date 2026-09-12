import Link from "next/link";
import { requireAuthOrRedirect } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import { LockedFeature } from "@/components/LockedFeature";
import type { LiveSession } from "@/lib/types/db";
import { createLiveSession, deleteLiveSession } from "./actions";

export default async function LiveSessionsPage() {
  const session = await requireAuthOrRedirect();
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("live_sessions")
    .select("*")
    .eq("org_id", session.org.id)
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-semibold">Live Sessions</h1>
      <LockedFeature
        currentTier={session.org.subscription_tier}
        requiredTier="MAXPRO"
        featureName="Live Interactive Sessions"
      >
        <div className="flex flex-col gap-6">
          <form action={createLiveSession} className="flex gap-2">
            <input
              type="text"
              name="title"
              placeholder="New session title"
              required
              className="flex-1 rounded border border-black/10 px-3 py-2 dark:border-white/20"
            />
            <button type="submit" className="rounded bg-foreground px-4 py-2 text-background">
              Create session
            </button>
          </form>

          <ul className="flex flex-col gap-3">
            {(sessions as LiveSession[] | null)?.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded border border-black/10 px-4 py-3 dark:border-white/10"
              >
                <Link href={`/studio/live/${s.id}`} className="flex-1 hover:underline">
                  <span className="font-medium">{s.title}</span>{" "}
                  <span className="text-xs text-black/50 dark:text-white/50">{s.status}</span>
                </Link>
                <form action={deleteLiveSession.bind(null, s.id)}>
                  <button type="submit" className="text-sm text-red-600 hover:underline">
                    Delete
                  </button>
                </form>
              </li>
            ))}
            {(!sessions || sessions.length === 0) && (
              <p className="text-sm text-black/50 dark:text-white/50">
                No live sessions yet — create one above.
              </p>
            )}
          </ul>
        </div>
      </LockedFeature>
    </div>
  );
}
