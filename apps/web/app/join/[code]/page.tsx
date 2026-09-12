import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./JoinForm";

export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: liveSession } = await supabase
    .from("live_sessions")
    .select("title, status")
    .eq("join_code", code.toUpperCase())
    .maybeSingle();

  if (!liveSession || liveSession.status !== "live") {
    return (
      <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-3 px-6 text-center">
        <h1 className="text-xl font-semibold">Session not live</h1>
        <p className="text-sm text-black/60 dark:text-white/60">
          This code isn&apos;t attached to a session that&apos;s currently live. Check with your
          presenter that it has started.
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div className="text-center">
        <p className="text-sm text-black/60 dark:text-white/60">Joining</p>
        <h1 className="text-2xl font-semibold">{liveSession.title}</h1>
      </div>
      <JoinForm code={code.toUpperCase()} />
    </main>
  );
}
