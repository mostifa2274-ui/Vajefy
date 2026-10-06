export function parseSemanticJudgeJson(content: string): unknown {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("empty semantic judge content");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
    if (!fenced) {
      throw new Error("semantic judge content is not a single JSON value");
    }
    return JSON.parse(fenced[1]!.trim());
  }
}


function hasCriteriaPayload(value: unknown): value is { criteria: unknown[] } {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Array.isArray((value as Record<string, unknown>).criteria)
  );
}

function topLevelJsonObjects(content: string): string[] {
  const objects: string[] = [];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]!;
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === "{") {
      if (depth === 0) start = index;
      depth += 1;
      continue;
    }

    if (char === "}" && depth > 0) {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        objects.push(content.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return objects;
}

/**
 * Transport-only normalization for model output.
 *
 * The evidence parser remains strict. This helper accepts wrappers/prose only
 * when there is exactly one unique JSON object containing a criteria array.
 * Duplicate identical representations collapse; conflicting payloads fail.
 */
export function canonicalizeSemanticJudgeContent(
  content: string,
): string | null {
  const trimmed = content.trim();
  if (!trimmed) return null;

  try {
    const parsed = parseSemanticJudgeJson(trimmed);
    if (hasCriteriaPayload(parsed)) return JSON.stringify(parsed);
  } catch {
    // Continue to bounded transport normalization.
  }

  const candidates: string[] = [];
  for (const objectText of topLevelJsonObjects(trimmed)) {
    try {
      const parsed = JSON.parse(objectText) as unknown;
      if (hasCriteriaPayload(parsed)) {
        candidates.push(JSON.stringify(parsed));
      }
    } catch {
      // Ignore malformed brace spans.
    }
  }

  const unique = [...new Set(candidates)];
  return unique.length === 1 ? unique[0]! : null;
}
