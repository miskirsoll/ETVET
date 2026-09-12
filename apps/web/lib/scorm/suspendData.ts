/**
 * Generates the suspend_data encode/decode helpers as plain JS, inlined
 * into the package's player script (no server round-trip at runtime).
 *
 * Format: "v1:<currentLessonIndex>:<statusChars>:<quizScoresCsv>"
 * - statusChars: one character per lesson in flattened course order
 *   ('0' not attempted, '1' completed/passed, '2' failed).
 * - quizScoresCsv: comma-separated integer score (0-100, or -1 for "not
 *   attempted yet") for each QUIZ lesson only, in flattened order among
 *   just the quiz lessons -- needed to compute cmi.core.score.raw, which
 *   the per-lesson status chars alone can't carry.
 *
 * Deliberately does not track in-progress answers within a quiz (the
 * spec's fuller "answered-question IDs" resume fidelity) -- a learner who
 * leaves mid-quiz restarts that lesson's quiz on return. That keeps this
 * trivially well under SCORM 1.2's 4096-character suspend_data limit even
 * for very large courses (a few hundred bytes at most), which was the
 * actual point of the spec's "keep it compact" guidance.
 */
export function generateSuspendDataJs(): string {
  return `
"use strict";

function etvetEncodeSuspendData(state) {
  return (
    "v1:" +
    state.currentLessonIndex +
    ":" +
    state.lessonStatuses.join("") +
    ":" +
    state.quizScores.join(",")
  );
}

function etvetDecodeSuspendData(raw, lessonCount, quizCount) {
  var fallback = {
    currentLessonIndex: 0,
    lessonStatuses: new Array(lessonCount).fill("0"),
    quizScores: new Array(quizCount).fill(-1),
  };
  if (!raw) return fallback;
  var parts = raw.split(":");
  if (parts[0] !== "v1") return fallback;
  var idx = parseInt(parts[1], 10);
  var statuses = (parts[2] || "").split("");
  while (statuses.length < lessonCount) statuses.push("0");
  statuses = statuses.slice(0, lessonCount);
  var scores = (parts[3] || "")
    .split(",")
    .filter(function (s) {
      return s.length > 0;
    })
    .map(function (s) {
      return parseInt(s, 10);
    });
  while (scores.length < quizCount) scores.push(-1);
  scores = scores.slice(0, quizCount);
  return {
    currentLessonIndex: isNaN(idx) ? 0 : idx,
    lessonStatuses: statuses,
    quizScores: scores,
  };
}
`.trim();
}
