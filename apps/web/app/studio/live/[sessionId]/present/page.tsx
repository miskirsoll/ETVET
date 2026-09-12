import { notFound, redirect } from "next/navigation";
import { requireTierOrRedirect } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import type { LiveSession, LiveSlide } from "@/lib/types/db";
import { PresentClient } from "./PresentClient";

export default async function PresentPage({
  params,
}: {
  params: Promise<{ sessionId: string }>;
}) {
  await requireTierOrRedirect("MAXPRO");
  const { sessionId } = await params;
  const supabase = await createClient();

  const { data: liveSession } = await supabase
    .from("live_sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (!liveSession) notFound();
  if (liveSession.status !== "live") redirect(`/studio/live/${sessionId}`);

  const { data: slides } = await supabase
    .from("live_slides")
    .select("*")
    .eq("session_id", sessionId)
    .order("order");

  return (
    <PresentClient
      session={liveSession as LiveSession}
      slides={(slides ?? []) as LiveSlide[]}
    />
  );
}
