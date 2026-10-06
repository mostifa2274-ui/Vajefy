import type { SemanticJudgeRole } from "../src/lib/learn/assurance";

export function buildSemanticJudgeUserPayload(
  role: SemanticJudgeRole,
  requiredCriteria: string[],
  target: unknown,
) {
  return {
    task: "Judge the supplied target using every required criterion exactly once.",
    role,
    requiredCriteria,
    target,
  };
}

export function semanticJudgeInputUtf8Bytes(
  systemPrompt: string,
  userPayload: unknown,
): number {
  return Buffer.byteLength(
    systemPrompt + JSON.stringify(userPayload),
    "utf8",
  );
}
