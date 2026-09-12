import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getParticipantToken } from "@/lib/live/participant";
import type { LiveSession, LiveSlide } from "@/lib/types/db";
import { PlayClient } from "./PlayClient";

export default async function PlayPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const supabase = await createClient();
  const { data: liveSession } = await supabase
    .from("live_sessions")
    .select("*")
    .eq("join_code", code.toUpperCase())
    .maybeSingle();
  if (!liveSession) notFound();

  const token = await getParticipantToken(liveSession.id);
  if (!token) redirect(`/join/${code.toUpperCase()}`);

  const { data: slides } = await supabase
    .from("live_slides")
    .select("*")
    .eq("session_id", liveSession.id)
    .order("order");

  return (
    <PlayClient
      session={liveSession as LiveSession}
      slides={(slides ?? []) as LiveSlide[]}
    />
  );
}
