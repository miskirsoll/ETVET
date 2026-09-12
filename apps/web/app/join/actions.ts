"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  joinAsParticipant,
  getParticipantToken,
  getParticipantDisplayName,
} from "@/lib/live/participant";
import { checkRateLimit } from "@/lib/rateLimit/check";
import { getClientIp } from "@/lib/rateLimit/clientIp";

export async function joinSession(code: string, formData: FormData) {
  const ip = await getClientIp();
  const allowed = await checkRateLimit(`join-session:${ip}`, 20, 60);
  if (!allowed) {
    return { error: "Too many attempts. Try again in a minute." };
  }

  const displayName = String(formData.get("displayName") ?? "").trim();
  const supabase = await createClient();
  const { data: liveSession } = await supabase
    .from("live_sessions")
    .select("id, status")
    .eq("join_code", code.toUpperCase())
    .maybeSingle();

  if (!liveSession || liveSession.status !== "live") {
    return { error: "This session isn't live right now. Double-check the code with your presenter." };
  }

  await joinAsParticipant(liveSession.id, displayName);
  redirect(`/join/${code.toUpperCase()}/play`);
}

export async function submitPollResponse(slideId: string, sessionId: string, choiceIndices: number[]) {
  const token = await getParticipantToken(sessionId);
  if (!token) return;
  if (!(await checkRateLimit(`live-response:${token}`, 30, 60))) return;
  const displayName = await getParticipantDisplayName(sessionId);
  const supabase = await createClient();
  await supabase.from("live_responses").insert({
    live_slide_id: slideId,
    participant_token: token,
    display_name: displayName,
    response: { choices: choiceIndices },
  });
}

export async function submitTextResponse(slideId: string, sessionId: string, text: string) {
  const token = await getParticipantToken(sessionId);
  if (!token || !text.trim()) return;
  if (!(await checkRateLimit(`live-response:${token}`, 30, 60))) return;
  const displayName = await getParticipantDisplayName(sessionId);
  const supabase = await createClient();
  await supabase.from("live_responses").insert({
    live_slide_id: slideId,
    participant_token: token,
    display_name: displayName,
    response: { text: text.trim().slice(0, 280) },
  });
}

export async function submitQuizAnswer(
  slideId: string,
  sessionId: string,
  choiceIndex: number,
  correctIndex: number,
  responseTimeMs: number
) {
  const token = await getParticipantToken(sessionId);
  if (!token) return;
  if (!(await checkRateLimit(`live-response:${token}`, 30, 60))) return;
  const displayName = await getParticipantDisplayName(sessionId);
  const supabase = await createClient();
  await supabase.from("live_responses").insert({
    live_slide_id: slideId,
    participant_token: token,
    display_name: displayName,
    response: { choice: choiceIndex },
    is_correct: choiceIndex === correctIndex,
    response_time_ms: responseTimeMs,
  });
}

export async function submitQuestion(sessionId: string, text: string, anonymous: boolean) {
  const token = await getParticipantToken(sessionId);
  if (!token || !text.trim()) return;
  if (!(await checkRateLimit(`qa-question:${token}`, 10, 60))) return;
  const displayName = anonymous ? null : await getParticipantDisplayName(sessionId);
  const supabase = await createClient();
  await supabase.from("qa_questions").insert({
    session_id: sessionId,
    participant_token: token,
    display_name: displayName,
    text: text.trim().slice(0, 280),
  });
}

export async function upvoteQuestion(questionId: string, sessionId: string) {
  const token = await getParticipantToken(sessionId);
  if (!token) return;
  if (!(await checkRateLimit(`qa-upvote:${token}`, 60, 60))) return;
  const supabase = await createClient();
  await supabase.from("qa_upvotes").insert({ question_id: questionId, participant_token: token });
}
