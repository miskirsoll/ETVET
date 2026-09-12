import Link from "next/link";
import { Radio, Trash2 } from "lucide-react";
import { requireAuthOrRedirect } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import { LockedFeature } from "@/components/LockedFeature";
import { EmptyState } from "@/components/EmptyState";
import type { LiveSession } from "@/lib/types/db";
import { createLiveSession, deleteLiveSession } from "./actions";

function StatusPill({ status }: { status: LiveSession["status"] }) {
  const styles: Record<LiveSession["status"], string> = {
    live: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300",
    draft: "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60",
    ended: "bg-black/5 text-black/40 dark:bg-white/5 dark:text-white/40",
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>{status}</span>;
}

export default async function LiveSessionsPage() {
  const session = await requireAuthOrRedirect();
  const supabase = await createClient();
  const { data: sessions } = await supabase
    .from("live_sessions")
    .select("*")
    .eq("org_id", session.org.id)
    .order("created_at", { ascending: false });
  const list = (sessions ?? []) as LiveSession[];

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
            <button type="submit" className="rounded bg-brand px-4 py-2 text-brand-foreground">
              Create session
            </button>
          </form>

          {list.length === 0 ? (
            <EmptyState icon={Radio} title="No live sessions yet — create one above." />
          ) : (
            <ul className="flex flex-col gap-3">
              {list.map((s) => (
                <li
                  key={s.id}
                  className="flex items-center justify-between rounded border border-black/10 px-4 py-3 shadow-sm transition-shadow hover:shadow-md dark:border-white/10"
                >
                  <Link href={`/studio/live/${s.id}`} className="flex flex-1 items-center gap-2">
                    <span className="font-medium hover:underline">{s.title}</span>
                    <StatusPill status={s.status} />
                  </Link>
                  <form action={deleteLiveSession.bind(null, s.id)}>
                    <button
                      type="submit"
                      aria-label={`Delete ${s.title}`}
                      className="flex items-center gap-1 text-sm text-red-600 hover:underline"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      Delete
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </LockedFeature>
    </div>
  );
}
