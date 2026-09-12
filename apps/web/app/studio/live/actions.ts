"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireTier } from "@/lib/auth/requireTier";
import { createClient } from "@/lib/supabase/server";
import type { LiveSlide, LiveSlideType } from "@/lib/types/db";

function generateJoinCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I to avoid ambiguity
  let code = "";
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
  return code;
}

export async function createLiveSession(formData: FormData) {
  const session = await requireTier("MAXPRO");
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const supabase = await createClient();
  let joinCode = generateJoinCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await supabase
      .from("live_sessions")
      .select("id")
      .eq("join_code", joinCode)
      .maybeSingle();
    if (!existing) break;
    joinCode = generateJoinCode();
  }

  const { data } = await supabase
    .from("live_sessions")
    .insert({ org_id: session.org.id, owner_id: session.appUser.id, title, join_code: joinCode })
    .select("id")
    .single();
  if (!data) return;

  redirect(`/studio/live/${data.id}`);
}

export async function deleteLiveSession(sessionId: string) {
  await requireTier("MAXPRO");
  const supabase = await createClient();
  await supabase.from("live_sessions").delete().eq("id", sessionId);
  revalidatePath("/studio/live");
}

export async function startSession(sessionId: string) {
  await requireTier("MAXPRO");
  const supabase = await createClient();
  const { data: firstSlide } = await supabase
    .from("live_slides")
    .select("id")
    .eq("session_id", sessionId)
    .order("order")
    .limit(1)
    .maybeSingle();
  await supabase
    .from("live_sessions")
    .update({ status: "live", current_slide_id: firstSlide?.id ?? null, locked: false })
    .eq("id", sessionId);
  revalidatePath(`/studio/live/${sessionId}`);
}

export async function endSession(sessionId: string) {
  await requireTier("MAXPRO");
  const supabase = await createClient();
  await supabase.from("live_sessions").update({ status: "ended" }).eq("id", sessionId);
  revalidatePath(`/studio/live/${sessionId}`);
}

export async function setLocked(sessionId: string, locked: boolean) {
  await requireTier("MAXPRO");
  const supabase = await createClient();
  await supabase.from("live_sessions").update({ locked }).eq("id", sessionId);
}

export async function goToSlide(sessionId: string, slideId: string) {
  await requireTier("MAXPRO");
  const supabase = await createClient();
  await supabase.from("live_sessions").update({ current_slide_id: slideId, locked: false }).eq("id", sessionId);
}

const DEFAULT_SLIDE_CONFIG: Record<LiveSlideType, Record<string, unknown>> = {
  poll: { prompt: "New poll question", options: ["Option A", "Option B"] },
  word_cloud: { prompt: "New word cloud prompt" },
  open_ended: { prompt: "New open-ended prompt" },
  quiz: { prompt: "New quiz question", options: ["Option A", "Option B"], correct_index: 0, time_limit_seconds: 20 },
  qa_board: { prompt: "Ask us anything" },
};

export async function createSlide(sessionId: string, type: LiveSlideType): Promise<LiveSlide | null> {
  await requireTier("MAXPRO");
  const supabase = await createClient();
  const { count } = await supabase
    .from("live_slides")
    .select("id", { count: "exact", head: true })
    .eq("session_id", sessionId);
  const { data } = await supabase
    .from("live_slides")
    .insert({ session_id: sessionId, type, order: count ?? 0, config: DEFAULT_SLIDE_CONFIG[type] })
    .select("*")
    .single();
  return data as LiveSlide | null;
}

export async function updateSlideConfig(slideId: string, config: Record<string, unknown>) {
  await requireTier("MAXPRO");
  const supabase = await createClient();
  await supabase.from("live_slides").update({ config }).eq("id", slideId);
}

export async function deleteSlide(slideId: string) {
  await requireTier("MAXPRO");
  const supabase = await createClient();
  await supabase.from("live_slides").delete().eq("id", slideId);
}

export async function reorderSlides(orderedIds: string[]) {
  await requireTier("MAXPRO");
  const supabase = await createClient();
  await Promise.all(
    orderedIds.map((id, index) => supabase.from("live_slides").update({ order: index }).eq("id", id))
  );
}

export async function setQaStatus(questionId: string, status: "approved" | "hidden" | "answered" | "pending") {
  await requireTier("MAXPRO");
  const supabase = await createClient();
  await supabase.from("qa_questions").update({ status }).eq("id", questionId);
}
