import { describe, expect, it } from "vitest";
import { pollCounts, textResponses, wordCloudWeights, quizLeaderboard } from "./aggregate";
import type { LiveResponse } from "@/lib/types/db";

function mk(over: Partial<LiveResponse>): LiveResponse {
  return {
    id: "id",
    live_slide_id: "slide1",
    participant_token: "p1",
    display_name: null,
    response: {},
    is_correct: null,
    response_time_ms: null,
    submitted_at: "now",
    ...over,
  };
}

describe("pollCounts", () => {
  it("tallies choices per option index", () => {
    const responses = [
      mk({ response: { choices: [0] } }),
      mk({ response: { choices: [0] } }),
      mk({ response: { choices: [1] } }),
    ];
    expect(pollCounts(responses, 3)).toEqual([2, 1, 0]);
  });

  it("ignores out-of-range choice indices rather than throwing", () => {
    const responses = [mk({ response: { choices: [-1, 5, 0] } })];
    expect(pollCounts(responses, 2)).toEqual([1, 0]);
  });

  it("treats a missing choices field as no vote", () => {
    expect(pollCounts([mk({ response: {} })], 2)).toEqual([0, 0]);
  });
});

describe("textResponses", () => {
  it("extracts non-empty text responses only", () => {
    const responses = [
      mk({ response: { text: "hello" } }),
      mk({ response: { text: "" } }),
      mk({ response: {} }),
    ];
    expect(textResponses(responses)).toEqual(["hello"]);
  });
});

describe("wordCloudWeights", () => {
  it("normalizes case/whitespace and counts duplicates, sorted by count desc", () => {
    const responses = [
      mk({ response: { text: "Agile" } }),
      mk({ response: { text: " agile " } }),
      mk({ response: { text: "Waterfall" } }),
    ];
    expect(wordCloudWeights(responses)).toEqual([
      { word: "agile", count: 2 },
      { word: "waterfall", count: 1 },
    ]);
  });

  it("returns an empty list when there are no responses", () => {
    expect(wordCloudWeights([])).toEqual([]);
  });
});

describe("quizLeaderboard", () => {
  it("ranks by correct count first, then total speed (faster wins ties)", () => {
    const responses = [
      mk({ participant_token: "slow-but-correct", is_correct: true, response_time_ms: 5000 }),
      mk({ participant_token: "fast-and-correct", is_correct: true, response_time_ms: 1000 }),
      mk({ participant_token: "fast-but-wrong", is_correct: false, response_time_ms: 500 }),
    ];
    const board = quizLeaderboard(responses);
    expect(board.map((e) => e.participantToken)).toEqual([
      "fast-and-correct",
      "slow-but-correct",
      "fast-but-wrong",
    ]);
  });

  it("accumulates multiple responses per participant across slides", () => {
    const responses = [
      mk({ participant_token: "p1", is_correct: true, response_time_ms: 1000 }),
      mk({ participant_token: "p1", is_correct: true, response_time_ms: 1000 }),
      mk({ participant_token: "p1", is_correct: false, response_time_ms: 1000 }),
    ];
    const [entry] = quizLeaderboard(responses);
    expect(entry.correctCount).toBe(2);
    expect(entry.totalTimeMs).toBe(3000);
  });
});
