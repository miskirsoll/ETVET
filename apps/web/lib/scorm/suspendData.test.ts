import { describe, expect, it } from "vitest";
import vm from "node:vm";
import { generateSuspendDataJs } from "./suspendData";

// generateSuspendDataJs() returns a *string* of JS meant to be embedded in
// the exported package's player script and run in a browser, not called
// directly from TypeScript -- so the only faithful way to test it is to
// actually execute that generated source, the same way the SCORM package
// itself will, rather than re-implementing the encode/decode logic here.
function loadSuspendDataModule() {
  const context: Record<string, unknown> = {};
  vm.createContext(context);
  vm.runInContext(
    generateSuspendDataJs() + "\nthis.__encode = etvetEncodeSuspendData; this.__decode = etvetDecodeSuspendData;",
    context
  );
  return {
    encode: context.__encode as (state: {
      currentLessonIndex: number;
      lessonStatuses: string[];
      quizScores: number[];
    }) => string,
    decode: context.__decode as (
      raw: string,
      lessonCount: number,
      quizCount: number
    ) => { currentLessonIndex: number; lessonStatuses: string[]; quizScores: number[] },
  };
}

describe("suspend_data encode/decode (generated JS, executed via vm)", () => {
  it("round-trips a typical in-progress state", () => {
    const { encode, decode } = loadSuspendDataModule();
    const state = { currentLessonIndex: 2, lessonStatuses: ["1", "2", "0"], quizScores: [80, -1] };
    const raw = encode(state);
    expect(raw).toBe("v1:2:120:80,-1");
    expect(decode(raw, 3, 2)).toEqual(state);
  });

  it("decode falls back to a fresh state for empty/missing suspend_data", () => {
    const { decode } = loadSuspendDataModule();
    expect(decode("", 3, 2)).toEqual({
      currentLessonIndex: 0,
      lessonStatuses: ["0", "0", "0"],
      quizScores: [-1, -1],
    });
  });

  it("decode falls back to a fresh state for an unrecognized version tag", () => {
    const { decode } = loadSuspendDataModule();
    expect(decode("v2:5:111:100", 3, 1)).toEqual({
      currentLessonIndex: 0,
      lessonStatuses: ["0", "0", "0"],
      quizScores: [-1],
    });
  });

  it("pads a short status/score string up to the current course's lesson/quiz count", () => {
    // Simulates a course the author has added lessons/quizzes to since a
    // learner's last visit -- their old suspend_data is shorter than the
    // current lessonCount/quizCount.
    const { decode } = loadSuspendDataModule();
    const result = decode("v1:0:1:90", 4, 3);
    expect(result.lessonStatuses).toEqual(["1", "0", "0", "0"]);
    expect(result.quizScores).toEqual([90, -1, -1]);
  });

  it("truncates a longer status/score string down to the current counts", () => {
    // Simulates the author removing lessons/quizzes -- old suspend_data is
    // longer than what the current course now has.
    const { decode } = loadSuspendDataModule();
    const result = decode("v1:0:11100:80,70,60", 2, 1);
    expect(result.lessonStatuses).toEqual(["1", "1"]);
    expect(result.quizScores).toEqual([80]);
  });
});
