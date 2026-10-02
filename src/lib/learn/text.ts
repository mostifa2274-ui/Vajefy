import type { LevelId } from "./types";

const LEVELS: LevelId[] = ["A1", "A2", "B1", "B2", "B2x", "C1"];

export function isLevel(value: unknown): value is LevelId {
  return typeof value === "string" && LEVELS.includes(value as LevelId);
}

export function todayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function yesterdayKey(d = new Date()): string {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - 1);
  return todayKey(copy);
}

export function dayNumber(): number {
  const d = new Date();
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
}

export function levelOf(id: string): LevelId | null {
  const match = /^lex:([^:]+):/.exec(id);
  if (!match || !isLevel(match[1])) return null;
  return match[1];
}

export function bareHeadword(word: string): string {
  const stripped = word.replace(/[¹²³⁴⁵⁶⁷⁸⁹]/g, "").replace(/\([^)]*\)/g, " ");
  const first = stripped.split(/[,/]/)[0] ?? "";
  return first
    .replace(/[^A-Za-z' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normEn(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'+ .-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > 2) return 3;
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i]![0] = i;
  for (let j = 0; j < cols; j++) dp[0]![j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[a.length]![b.length]!;
}

/**
 * The data follows the Oxford lists' British spelling; the app speaks and
 * transcribes General American. Both spellings of these headwords are right.
 */
const AMERICAN: Record<string, string> = {
  aluminium: "aluminum",
  analyse: "analyze",
  behaviour: "behavior",
  catalogue: "catalog",
  centre: "center",
  colour: "color",
  coloured: "colored",
  counselling: "counseling",
  defence: "defense",
  dialogue: "dialog",
  endeavour: "endeavor",
  enrol: "enroll",
  favour: "favor",
  favourable: "favorable",
  favourite: "favorite",
  fibre: "fiber",
  flavour: "flavor",
  fulfil: "fulfill",
  grey: "gray",
  harbour: "harbor",
  honour: "honor",
  humour: "humor",
  jewellery: "jewelry",
  kilometre: "kilometer",
  labour: "labor",
  licence: "license",
  litre: "liter",
  metre: "meter",
  mum: "mom",
  neighbour: "neighbor",
  neighbouring: "neighboring",
  offence: "offense",
  practise: "practice",
  programme: "program",
  rumour: "rumor",
  sceptical: "skeptical",
  theatre: "theater",
  traveller: "traveler",
  tyre: "tire",
};

/** Every accepted spelling of a headword: as written, bare, and American. */
export function spellings(word: string): string[] {
  const bare = normEn(bareHeadword(word));
  const american = AMERICAN[bare];
  return [...new Set([normEn(word), bare, american ?? ""].filter(Boolean))];
}

export function gradeSpelling(input: string, word: string): "exact" | "close" | "wrong" {
  const targets = spellings(word);
  const got = normEn(input);
  if (!got) return "wrong";
  if (targets.some((target) => target === got)) return "exact";
  if (targets.some((target) => target.length >= 5 && editDistance(got, target) === 1)) return "close";
  return "wrong";
}

export function bestSpelling(input: string, accepts: string[]): "exact" | "close" | "wrong" {
  let best: "exact" | "close" | "wrong" = "wrong";
  for (const word of accepts) {
    const result = gradeSpelling(input, word);
    if (result === "exact") return "exact";
    if (result === "close") best = "close";
  }
  return best;
}

export function formMatches(input: string, expected: string): boolean {
  const got = normEn(input);
  if (!got) return false;
  return expected
    .split("/")
    .map((part) => normEn(part))
    .filter(Boolean)
    .some((form) => form === got);
}

/**
 * A forgiving key for search: lowercase, Arabic-keyboard letters mapped to
 * Persian (ي→ی, ك→ک), and diacritics, tatweel, bidi marks, ZWNJ and spaces
 * dropped, so «دست‌دوم», «دست دوم» and «دستدوم» all match.
 */
export function searchKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ة/g, "ه")
    .replace(/[أإٱ]/g, "ا")
    .replace(/ؤ/g, "و")
    .replace(/[\u064B-\u065F\u0670\u0640]/g, "")
    .replace(/[\u200B-\u200F\u2066-\u2069\s]/g, "");
}

export function escapeReg(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Regular inflections of a one-word headword (plural / third person, past,
 * -ing), so a cloze can find "begins" or "dollars" in the example. Extra
 * forms that are not real words are harmless: they never occur in a sentence.
 */
export function wordForms(bare: string): string[] {
  const w = bare.toLowerCase();
  if (w.includes(" ") || w.length < 3) return [w];
  const forms = new Set([w]);
  const consonantY = /[^aeiou]y$/.test(w);
  const doubled = /[^aeiou][aeiou][bdgklmnprt]$/.test(w) ? w + w.slice(-1) : null;
  if (/(s|x|z|ch|sh|o)$/.test(w)) forms.add(`${w}es`);
  else if (consonantY) forms.add(`${w.slice(0, -1)}ies`);
  else forms.add(`${w}s`);
  if (w.endsWith("e")) forms.add(`${w}d`);
  else if (consonantY) forms.add(`${w.slice(0, -1)}ied`);
  else forms.add(`${w}ed`);
  if (w.endsWith("ie")) forms.add(`${w.slice(0, -2)}ying`);
  else if (/[^e]e$/.test(w)) forms.add(`${w.slice(0, -1)}ing`);
  else forms.add(`${w}ing`);
  if (doubled) {
    forms.add(`${doubled}ed`);
    forms.add(`${doubled}ing`);
  }
  return [...forms];
}

/** The example with every form of the headword blanked, or null if none occurs. */
export function cloze(example: string, word: string): string | null {
  const bare = bareHeadword(word);
  if (bare.length < 2 || !example) return null;
  const re = new RegExp(`\\b(?:${wordForms(bare).map(escapeReg).join("|")})\\b`, "gi");
  const blanked = example.replace(re, "______");
  return blanked === example ? null : blanked;
}

export function shuffle<T>(list: T[]): T[] {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = copy[i]!;
    const b = copy[j]!;
    copy[i] = b;
    copy[j] = a;
  }
  return copy;
}

export function formatDelay(ms: number, lang: "fa" | "en"): string {
  const min = Math.max(1, Math.round(ms / 60000));
  if (min < 90) {
    return lang === "fa" ? `${new Intl.NumberFormat("fa-IR").format(min)} دقیقه` : `${min} min`;
  }
  const days = Math.max(1, Math.round(ms / 86400000));
  if (days < 45) {
    return lang === "fa" ? `${new Intl.NumberFormat("fa-IR").format(days)} روز` : `${days} d`;
  }
  const months = Math.round(days / 30);
  return lang === "fa" ? `${new Intl.NumberFormat("fa-IR").format(months)} ماه` : `${months} mo`;
}

export const POS_FILTERS = ["اسم", "فعل", "صفت", "قید", "حرف اضافه", "ضمیر", "عدد", "حرف ربط"] as const;
