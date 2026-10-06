import type { CheckItem, Pilot } from "./content";

/**
 * How learner-facing English resolves to A1 entries: tokens, contractions,
 * common inflections and headword aliases. Shared by the calibration audit
 * (scripts/a1-calibration.ts) and the course-wide curriculum-frontier check
 * (scripts/content-assurance.ts), so both judge a word the same way.
 */

const CONTRACTIONS: Record<string, string[]> = {
  "i'm": ["i", "be"],
  "you're": ["you", "be"],
  "he's": ["he", "be"],
  "she's": ["she", "be"],
  "it's": ["it", "be"],
  "we're": ["we", "be"],
  "they're": ["they", "be"],
  "that's": ["that", "be"],
  "what's": ["what", "be"],
  "who's": ["who", "be"],
  "where's": ["where", "be"],
  "how's": ["how", "be"],
  "isn't": ["be", "not"],
  "aren't": ["be", "not"],
  "wasn't": ["be", "not"],
  "weren't": ["be", "not"],
  "don't": ["do", "not"],
  "doesn't": ["do", "not"],
  "didn't": ["do", "not"],
  "can't": ["can", "not"],
  "couldn't": ["could", "not"],
  "won't": ["will", "not"],
  "wouldn't": ["would", "not"],
  "haven't": ["have", "not"],
  "hasn't": ["have", "not"],
  "hadn't": ["have", "not"],
  "i've": ["i", "have"],
  "you've": ["you", "have"],
  "we've": ["we", "have"],
  "they've": ["they", "have"],
  "i'll": ["i", "will"],
  "you'll": ["you", "will"],
  "he'll": ["he", "will"],
  "she'll": ["she", "will"],
  "we'll": ["we", "will"],
  "they'll": ["they", "will"],
};

const IRREGULAR: Record<string, string> = {
  am: "be",
  is: "be",
  are: "be",
  was: "be",
  were: "be",
  been: "be",
  being: "be",
  has: "have",
  had: "have",
  having: "have",
  does: "do",
  did: "do",
  done: "do",
  doing: "do",
  goes: "go",
  went: "go",
  gone: "go",
  going: "go",
  people: "person",
  children: "child",
  men: "man",
  women: "woman",
  feet: "foot",
  teeth: "tooth",
  mice: "mouse",
};

export function englishTokens(value: string): string[] {
  return value.match(/[A-Za-z]+(?:[-'’][A-Za-z]+)*/g) ?? [];
}

export function authoredTaskText(item: CheckItem): string {
  if (item.type === "cloze") return item.text;
  if (item.type === "produce") return item.frame;
  return [item.prompt, ...item.options.map((option) => option.text)].join(" ");
}

export function normalizedTokens(value: string): string[] {
  return englishTokens(value).map((token) =>
    token.toLowerCase().replaceAll("’", "'"),
  );
}

export function containsTokenSequence(haystack: string[], needle: string[]): boolean {
  if (!needle.length || needle.length > haystack.length) return false;
  return haystack.some((_, start) =>
    needle.every((token, offset) => haystack[start + offset] === token),
  );
}

export function headwordAliases(headword: string): string[] {
  const normalized = headword.toLowerCase().replaceAll("’", "'").trim();
  // Some catalogue headwords carry sense labels, e.g.
  // "like (find sb/sth pleasant)". Slash characters inside those labels are
  // not lexical variants and must not make us discard the actual headword.
  const withoutSenseLabel = normalized.replace(/\s*\([^)]*\)\s*$/, "").trim();
  return withoutSenseLabel
    .split(/\s*[,/;]\s*/)
    .map((part) => part.trim())
    .filter((part) => /^[a-z]+(?:[-'][a-z]+)*$/.test(part));
}

export function buildHeadwordIndex(
  entries: readonly Pick<Pilot["entries"][number], "id" | "headword">[],
): Map<string, string> {
  const index = new Map<string, string>();
  for (const entry of entries) {
    for (const alias of headwordAliases(entry.headword)) {
      if (!index.has(alias)) index.set(alias, entry.id);
    }
  }
  return index;
}

export function lexicalForms(raw: string): string[] {
  const token = raw.toLowerCase().replaceAll("’", "'");
  const contraction = CONTRACTIONS[token];
  if (contraction) return contraction;
  if (token.endsWith("'s") && token.length > 2) return [token.slice(0, -2)];
  if (token.endsWith("'re") && token.length > 3)
    return [token.slice(0, -3), "be"];
  if (token.endsWith("'ve") && token.length > 3)
    return [token.slice(0, -3), "have"];
  if (token.endsWith("'ll") && token.length > 3)
    return [token.slice(0, -3), "will"];
  return [token];
}

export function morphologyCandidates(
  form: string,
  irregularForms?: ReadonlyMap<string, string>,
): string[] {
  const candidates = [form];
  const irregular = IRREGULAR[form] ?? irregularForms?.get(form);
  if (irregular) candidates.push(irregular);
  if (form.endsWith("ies") && form.length > 3)
    candidates.push(`${form.slice(0, -3)}y`);
  if (form.endsWith("es") && form.length > 2)
    candidates.push(form.slice(0, -2));
  if (form.endsWith("s") && form.length > 1)
    candidates.push(form.slice(0, -1));
  if (form.endsWith("ied") && form.length > 3)
    candidates.push(`${form.slice(0, -3)}y`);
  if (form.endsWith("ed") && form.length > 2) {
    const stem = form.slice(0, -2);
    candidates.push(stem, `${stem}e`);
    if (
      stem.length > 2 &&
      stem.at(-1) === stem.at(-2)
    )
      candidates.push(stem.slice(0, -1));
  }
  if (form.endsWith("ing") && form.length > 3) {
    const stem = form.slice(0, -3);
    candidates.push(stem, `${stem}e`);
    if (
      stem.length > 2 &&
      stem.at(-1) === stem.at(-2)
    )
      candidates.push(stem.slice(0, -1));
  }
  return [...new Set(candidates)];
}

export function resolveA1Entry(
  form: string,
  headwordIndex: Map<string, string>,
  irregularForms?: ReadonlyMap<string, string>,
): string | undefined {
  for (const candidate of morphologyCandidates(form, irregularForms)) {
    const id = headwordIndex.get(candidate);
    if (id) return id;
  }
  return undefined;
}
