import { createHash } from "node:crypto";
import type { Pilot, Sense } from "../src/lib/learn/content";

export type SemanticTargetInput = {
  unitId: string;
  entry: {
    id: string;
    headword: string;
    contentVersion: string;
    order: number;
    prerequisites: string[];
  };
  sense: Sense;
};

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stable(
            (value as Record<string, unknown>)[key],
          )}`,
      )
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

export function semanticTargetInput(
  entry: Pilot["entries"][number],
  sense: Sense,
  unitId: string,
): SemanticTargetInput {
  return {
    unitId,
    entry: {
      id: entry.id,
      headword: entry.headword,
      contentVersion: entry.version,
      order: entry.order,
      prerequisites: [...entry.prerequisites],
    },
    sense,
  };
}

export function semanticInputHash(input: SemanticTargetInput): string {
  return createHash("sha256").update(stable(input)).digest("hex");
}

export function semanticStableJson(value: unknown): string {
  return stable(value);
}
