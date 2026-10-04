import path from "node:path";
import { DATA, LEVELS, read, type Level } from "./catalogue.ts";

/**
 * Words and their levels, for the authoring checks and the catalogue audit:
 * the lowest level that teaches each word, and the dictionary forms a word in
 * a sentence may stand for (left → leave, children → child, don't → do).
 */

// The lowest level at which each word form is taught.
export const levelOf = new Map<string, Level>();
const meta = read<{ levels: { id: Level; file: string }[] }>(path.join(DATA, "meta.json"));
for (const level of meta.levels) {
  for (const row of read<{ w: string }[]>(path.join(DATA, level.file))) {
    const forms = row.w
      .toLowerCase()
      // Sentences are matched with a straight apostrophe (o’clock → o'clock).
      .replace(/’/g, "'")
      // Homographs carry superscript numbers in the dataset (close¹, close²).
      .replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, "")
      .replace(/\(.*?\)/g, "")
      .split(/[,/]/)
      .map((form) => form.trim())
      .filter(Boolean);
    for (const form of forms) {
      for (const word of form.split(/\s+/)) {
        const known = levelOf.get(word);
        if (!known || LEVELS.indexOf(level.id) < LEVELS.indexOf(known)) levelOf.set(word, level.id);
      }
    }
  }
}
export const irregular = new Map<string, string>();
for (const row of read<{ base: string; past: string; pp: string }[]>(path.join(DATA, "irregular.json"))) {
  for (const form of `${row.past}/${row.pp}`.toLowerCase().split("/")) irregular.set(form.trim(), row.base.toLowerCase());
}
for (const [form, base] of Object.entries({
  is: "be", am: "be", are: "be", has: "have", these: "this", those: "that",
  children: "child", men: "man", women: "woman", people: "person", feet: "foot", teeth: "tooth", mice: "mouse",
  ca: "can", wo: "will", sha: "shall",
  // Irregular verbs the irregular-verb collection does not (yet) include.
  awoke: "awake", awoken: "awake", dwelt: "dwell", flung: "fling", forsook: "forsake", forsaken: "forsake",
  ground: "grind", knelt: "kneel", leant: "lean", leapt: "leap", misled: "mislead", overtook: "overtake",
  overtaken: "overtake", shrank: "shrink", shrunk: "shrink", slung: "sling", spat: "spit", stung: "sting",
  stank: "stink", stunk: "stink", strove: "strive", striven: "strive", swollen: "swell", trod: "tread",
  trodden: "tread", upheld: "uphold", wove: "weave", woven: "weave", wept: "weep", withheld: "withhold",
  withstood: "withstand", wrung: "wring",
})) {
  irregular.set(form, base);
}

const CONTRACTED: Record<string, string> = { "'d": "would", "'ll": "will", "'re": "are", "'m": "am", "'ve": "have", "'s": "is" };

/** Possible dictionary forms of a word, by simple English inflection rules. */
export function basesOf(token: string): Set<string> {
  // Accents are dropped: café is listed as cafe.
  const word = token.toLowerCase().replace("’", "'").normalize("NFD").replace(/\p{M}/gu, "");
  const candidates = new Set([word]);
  // doesn't → does → do, isn't → is → be.
  if (word.endsWith("n't")) for (const base of basesOf(word.slice(0, -3))) candidates.add(base);
  const apostrophe = word.indexOf("'");
  if (apostrophe > 0) {
    candidates.add(word.slice(0, apostrophe));
    const tail = CONTRACTED[word.slice(apostrophe)];
    if (tail) candidates.add(tail);
  }
  const base = irregular.get(word);
  if (base) candidates.add(base);
  const strip = (suffix: string, add = "") => word.endsWith(suffix) && word.length > suffix.length + 1 && candidates.add(word.slice(0, -suffix.length) + add);
  strip("s");
  strip("es");
  strip("ies", "y");
  strip("ed");
  strip("ed", "e");
  strip("d");
  strip("ied", "y");
  strip("ing");
  strip("ing", "e");
  strip("er");
  strip("er", "e");
  strip("est");
  strip("est", "e");
  strip("ly");
  strip("'s");
  if (/(bb|dd|gg|ll|mm|nn|pp|rr|tt)(ed|ing|er|est)$/.test(word)) candidates.add(word.replace(/(.)\1(ed|ing|er|est)$/, "$1"));
  for (const candidate of [...candidates]) {
    const irregularBase = irregular.get(candidate);
    if (irregularBase) candidates.add(irregularBase);
  }
  return candidates;
}

/** The lowest level that teaches any dictionary form of the word. */
export function lookup(word: string): Level | null {
  let best: Level | null = null;
  for (const candidate of basesOf(word)) {
    const level = levelOf.get(candidate);
    if (level && (!best || LEVELS.indexOf(level) < LEVELS.indexOf(best))) best = level;
  }
  return best;
}

