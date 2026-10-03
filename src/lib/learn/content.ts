import { z } from "zod";

/**
 * Sense-level teaching content for the enhanced pilot. Each sense is its own
 * learning target. The first sense of an entry keeps the entry's existing id,
 * so progress made on the original word carries over; further senses get
 * `<entry id>#<name>` ids, which are stable once published.
 */

const text = z.string().trim().min(1);
const fa = text.refine((value) => !/[كي]/u.test(value), "use Persian ی/ک, not Arabic ي/ك");

export const POS = [
  "noun",
  "verb",
  "adjective",
  "adverb",
  "preposition",
  "conjunction",
  "pronoun",
  "determiner",
  "article",
  "modal",
  "exclamation",
  "number",
  "particle",
] as const;

export const GOALS = ["everyday", "work", "study", "general"] as const;
export type Goal = (typeof GOALS)[number];

const example = z.object({ en: text, fa });

const option = z.object({
  text,
  ok: z.boolean(),
  /** Why this option does or does not fit, in Persian. */
  why: fa,
});

/** A blank in a new sentence: the meaning must be used, not just recognised. */
const cloze = z.object({
  type: z.literal("cloze"),
  id: text,
  /** The sentence with `___` where the answer goes. */
  text: text.refine((value) => value.includes("___"), "a cloze needs ___"),
  answer: text,
  /** Other answers that are also correct, for example contracted forms. */
  accept: z.array(text).default([]),
  fa,
  why: fa,
});

/** Choose the word that fits and see why each option does or does not. */
const choice = z.object({
  type: z.literal("choice"),
  id: text,
  prompt: text,
  options: z.array(option).min(2).max(4).refine((items) => items.filter((item) => item.ok).length === 1, "exactly one option must be correct"),
});

/** From a Persian meaning, write the English in a sentence frame. */
const produce = z.object({
  type: z.literal("produce"),
  id: text,
  /** The Persian sentence to express. */
  prompt: fa,
  /** The English sentence with `___` for the part the learner writes. */
  frame: text.refine((value) => value.includes("___"), "a frame needs ___"),
  answer: text,
  accept: z.array(text).default([]),
  why: fa,
});

export const checkItem = z.discriminatedUnion("type", [cloze, choice, produce]);

export const sense = z.object({
  id: text,
  pos: z.enum(POS),
  /** A short Persian equivalent. */
  gloss: fa,
  /** A precise Persian explanation of this sense. */
  meaning: fa,
  grammar: z.array(z.object({ pattern: text, note: fa })).min(1),
  examples: z.array(example).min(2),
  collocations: z.array(text).min(1),
  /** Register, context or restrictions, in Persian. */
  usage: fa.optional(),
  mistake: z.object({ wrong: text, right: text, why: fa }),
  pronunciation: z.object({
    gb: text,
    us: text,
    /** Stress or sound note in Persian. */
    note: fa.optional(),
  }),
  /** Phonemes for speech generation when spelling alone is ambiguous. */
  tts: z.object({ gb: text, us: text }).partial().optional(),
  check: z.array(checkItem).min(2),
});

export const entry = z.object({
  id: text.regex(/^lex:A1:[a-z0-9-]+$/),
  headword: text,
  goals: z.array(z.enum(GOALS)).min(1),
  senses: z.array(sense).min(1),
});

/** A comparison lesson for words learners confuse. */
export const contrast = z.object({
  id: text.regex(/^contrast:[a-z0-9-]+$/),
  title: text,
  entries: z.array(text).min(2),
  /** What the words share, in Persian. */
  shared: fa,
  /** The decisive difference, in Persian. */
  difference: fa,
  patterns: z.array(example).min(2),
  /** When one cannot replace the other. */
  unnatural: z.array(z.object({ wrong: text, right: text, why: fa })).min(1),
  check: z.array(checkItem).min(2),
});

/** A short dialogue or passage that reuses learned words in a new situation. */
export const scene = z.object({
  id: text.regex(/^scene:[a-z0-9-]+$/),
  title: text,
  titleFa: fa,
  goal: z.enum(GOALS),
  kind: z.enum(["dialogue", "passage"]),
  /** Learning targets the scene revisits. */
  targets: z.array(text).min(2),
  lines: z.array(z.object({ speaker: text.optional(), en: text, fa })).min(3),
  check: z.array(checkItem).min(2),
  /** A short writing task using the targets, checked by the learner against a model. */
  write: z.object({ prompt: fa, model: text, use: z.array(text).min(1) }),
});

export type CheckItem = z.infer<typeof checkItem>;
export type Sense = z.infer<typeof sense>;
export type Entry = z.infer<typeof entry>;
export type Contrast = z.infer<typeof contrast>;
export type Scene = z.infer<typeof scene>;

/** Review state of one entry, valid only for the content version it names. */
export const review = z.object({
  version: text,
  bilingual: z.enum(["pending", "approved", "changes"]),
  pronunciation: z.enum(["pending", "approved", "changes"]),
  reviewer: text.optional(),
  date: text.optional(),
  notes: text.optional(),
});
export type Review = z.infer<typeof review>;

export type PilotSense = Sense & { entry: string; headword: string; version: string; audio?: SenseAudio };
export type SenseAudio = {
  gb?: { word?: string; examples: (string | null)[] };
  us?: { word?: string; examples: (string | null)[] };
};

/** The compiled file the app loads: `public/data/pilot-a1.json`. */
export type Pilot = {
  version: string;
  entries: (Entry & { version: string; order: number; released: boolean; review: Review | null })[];
  contrasts: Contrast[];
  scenes: Scene[];
  audio: Record<string, SenseAudio>;
  /** Every current clip per accent, for downloading pronunciation for offline use. */
  audioPack: Record<"gb" | "us", { files: string[]; bytes: number }>;
};

export function isSenseId(id: string) {
  return id.includes("#");
}

/** The entry a learning target belongs to. */
export function entryIdOf(id: string) {
  const hash = id.indexOf("#");
  return hash < 0 ? id : id.slice(0, hash);
}
