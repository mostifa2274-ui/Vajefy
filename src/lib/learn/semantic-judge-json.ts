export function parseSemanticJudgeJson(content: string): unknown {
  const trimmed = content.trim();
  if (!trimmed) {
    throw new Error("empty semantic judge content");
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/^\`\`\`(?:json)?\s*\n([\s\S]*?)\n\`\`\`$/i);
    if (!fenced) {
      throw new Error("semantic judge content is not a single JSON value");
    }
    return JSON.parse(fenced[1]!.trim());
  }
}
