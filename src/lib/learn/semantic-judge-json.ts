function embeddedJsonObjects(content: string): string[] {
  const candidates: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index]!;

    if (inString) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') inString = false;
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

    if (char === "}") {
      if (depth === 0) continue;
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(content.slice(start, index + 1));
        start = -1;
      }
    }
  }

  return candidates;
}

export function parseSemanticJudgeJson(content: string): unknown {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("empty semantic judge content");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    // Continue with narrowly scoped transport normalizations.
  }

  const fenced = trimmed.match(/^```(?:json)?\s*\n([\s\S]*?)\n```$/i);
  if (fenced) {
    return JSON.parse(fenced[1]!.trim());
  }

  const parsedCandidates: unknown[] = [];
  for (const candidate of embeddedJsonObjects(trimmed)) {
    try {
      parsedCandidates.push(JSON.parse(candidate));
    } catch {
      // Ignore brace-delimited prose fragments that are not valid JSON.
    }
  }

  if (parsedCandidates.length !== 1) {
    throw new Error("semantic judge content does not contain exactly one valid JSON object");
  }

  return parsedCandidates[0];
}
