import { z } from "zod";
import { GOALS } from "./targets";

export { GOALS, entryIdOf, headwordOf, isSenseId, orderForGoal, type Goal, type PilotOrder } from "./targets";

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


const example = z.object({ en: text, fa });

const option = z.object({
  text,
  ok: z.boolean(),
  /** Why this option does or does not fit, in Persian. */
  why: fa,
});

const taskSupport = z
  .array(
    z.object({
      /** Exact English word or short phrase visible in the authored task. */
      en: text,
      /** Learner-visible Persian gloss for that support language. */
      fa,
    }),
  )
  .min(1)
  .max(6)
  .optional();

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
  support: taskSupport,
});

/** Choose the word that fits and see why each option does or does not. */
const choice = z.object({
  type: z.literal("choice"),
  id: text,
  prompt: text,
  options: z.array(option).min(2).max(4).refine((items) => items.filter((item) => item.ok).length === 1, "exactly one option must be correct"),
  support: taskSupport,
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
  support: taskSupport,
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
  /** Optional direct Persian translations keyed by the exact collocation text. */
  collocationFa: z.record(text, fa).optional(),
  /** Register, context or restrictions, in Persian. */
  usage: fa.optional(),
  mistake: z.object({
    wrong: text,
    /** Direct Persian translation of the incorrect English example. */
    wrongFa: fa.optional(),
    right: text,
    /** Direct Persian translation of the corrected English example. */
    rightFa: fa.optional(),
    why: fa,
  }),
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
  id: text.regex(/^lex:(A1|A2|B1|B2|B2x|C1):[a-z0-9-]+$/),
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

/**
 * All the compiled content in one file, `content/compiled/enhanced.json`, for
 * scripts, tests and the coach. The app loads it in pieces instead:
 * `PilotCatalogue`, `PilotPart` and `AudioPack`.
 */
export type Pilot = {
  version: string;
  /**
   * Each entry with its content version, course position, curriculum unit (an
   * index into `units`, or null outside a curriculum) and the entries its
   * lessons rely on, from the curriculum.
   */
  entries: (Entry & {
    version: string;
    order: number;
    unit: number | null;
    prerequisites: string[];
    released: boolean;
    review: Review | null;
  })[];
  /** Curriculum units, level by level, in course order. */
  units: CourseUnit[];
  /** The words the learning study measures: its curriculum units' entries, in course order. */
  study: { units: string[]; entries: string[] };
  contrasts: Contrast[];
  scenes: Scene[];
  audio: Record<string, SenseAudio>;
  /** Every current clip per accent, for downloading pronunciation for offline use. */
  audioPack: AudioPack;
};
export type AudioPackVariant = { version: string; files: string[]; bytes: number };
export type AudioPackUnit = CourseUnit & {
  /** Stable 1-based position among units at the same level. */
  number: number;
  accents: Record<"gb" | "us", AudioPackVariant>;
};
/**
 * Versioned pronunciation packs. Each unit/accent variant has its own content
 * identity so a replacement can be staged completely before becoming active.
 */
export type AudioPack = {
  schemaVersion: 2;
  version: string;
  units: AudioPackUnit[];
};
/** A unit of a level's curriculum (content/curriculum/). */
export type CourseUnit = { id: string; level: string; titleEn: string; titleFa: string };

/** An entry as the app needs it for teaching, without its review record. */
export type PilotEntry = Omit<Pilot["entries"][number], "review">;
/** A sense as it is listed: enough to order, count, label and offer it as an option. */
export type ListedSense = Pick<Sense, "id" | "pos" | "gloss">;
export type ListedEntry = Pick<PilotEntry, "id" | "headword" | "goals" | "version" | "released" | "unit"> & { senses: ListedSense[] };

/**
 * `public/data/enhanced/index.json`: every entry listed, with the contrasts
 * and scenes, and which part holds each entry's teaching content.
 */
export type PilotCatalogue = {
  version: string;
  /** Part files under `public/data/`, named by their content. */
  parts: string[];
  /** Curriculum units, which listed entries refer to by index. */
  units: CourseUnit[];
  entries: (ListedEntry & { part: number })[];
  contrasts: Contrast[];
  scenes: Scene[];
};
/** A run of entries in curriculum order, with their audio. */
export type PilotPart = { entries: PilotEntry[]; audio: Record<string, SenseAudio> };
