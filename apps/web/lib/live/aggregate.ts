import type { LiveResponse } from "@/lib/types/db";

export function pollCounts(responses: LiveResponse[], optionCount: number): number[] {
  const counts = new Array(optionCount).fill(0);
  for (const r of responses) {
    const choices = (r.response.choices as number[] | undefined) ?? [];
    for (const c of choices) {
      if (c >= 0 && c < optionCount) counts[c]++;
    }
  }
  return counts;
}

export function textResponses(responses: LiveResponse[]): string[] {
  return responses
    .map((r) => (r.response.text as string | undefined) ?? "")
    .filter((t) => t.length > 0);
}

export function wordCloudWeights(responses: LiveResponse[]): { word: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const text of textResponses(responses)) {
    const word = text.trim().toLowerCase().slice(0, 40);
    if (!word) continue;
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count);
}

export interface LeaderboardEntry {
  participantToken: string;
  displayName: string | null;
  correctCount: number;
  totalTimeMs: number;
}

/** Ranked by correct answers first, then total speed (faster wins ties). */
export function quizLeaderboard(responses: LiveResponse[]): LeaderboardEntry[] {
  const byParticipant = new Map<string, LeaderboardEntry>();
  for (const r of responses) {
    const entry = byParticipant.get(r.participant_token) ?? {
      participantToken: r.participant_token,
      displayName: r.display_name,
      correctCount: 0,
      totalTimeMs: 0,
    };
    if (r.is_correct) entry.correctCount++;
    entry.totalTimeMs += r.response_time_ms ?? 0;
    byParticipant.set(r.participant_token, entry);
  }
  return [...byParticipant.values()].sort((a, b) => {
    if (b.correctCount !== a.correctCount) return b.correctCount - a.correctCount;
    return a.totalTimeMs - b.totalTimeMs;
  });
}
