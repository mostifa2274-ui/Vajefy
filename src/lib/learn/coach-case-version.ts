import { createHash } from "node:crypto";

/**
 * The coach judges only authored text and expected verdicts, not pronunciation.
 * Repacking independently certified MP3s must not invalidate the held-out
 * text evaluation set or force an unrelated generated JSON change.
 */
export type CoachEvaluationCase = {
  id: string;
  split: "dev" | "test";
  source: string;
  senses: readonly string[];
  text: string;
  expect: readonly ("natural" | "needs-change" | "unsure")[];
};

export function coachCaseContentVersion(cases: readonly CoachEvaluationCase[]): string {
  return "coach-text-v1-" + createHash("sha256")
    .update(JSON.stringify(cases))
    .digest("hex")
    .slice(0, 16);
}
