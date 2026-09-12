import { notFound } from "next/navigation";
import { requireTierOrRedirect } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import { BackLink } from "@/components/BackLink";
import type { LiveSession, LiveSlide } from "@/lib/types/db";
import { SlideEditor } from "./SlideEditor";
import { SessionControls } from "./SessionControls";

export default async function LiveSessionBuilderPage({
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

  const { data: slides } = await supabase
    .from("live_slides")
    .select("*")
    .eq("session_id", sessionId)
    .order("order");

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <BackLink href="/studio/live">Back to sessions</BackLink>
      <h1 className="text-2xl font-semibold">{(liveSession as LiveSession).title}</h1>
      <SessionControls session={liveSession as LiveSession} />
      <SlideEditor sessionId={sessionId} initialSlides={(slides ?? []) as LiveSlide[]} />
    </div>
  );
}
