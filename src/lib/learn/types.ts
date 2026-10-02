export type Lang = "fa" | "en";

export type LevelId = "A1" | "A2" | "B1" | "B2" | "B2x" | "C1";

export type Meta = {
  levels: { id: LevelId; label: string; count: number; file: string }[];
  counts: Record<string, number>;
};

export type LexWord = {
  id: string;
  w: string;
  pr: string;
  ipa: string;
  pos: string;
  fa: string;
  ex: string;
  tr: string;
};

export type PatternItem = {
  id: string;
  w: string;
  pr: string;
  ipa?: string;
  fa: string;
  band: number;
  guide: string;
  ex: string;
  tr: string;
};

export type Antonym = {
  id: string;
  a: string;
  b: string;
  pr: string;
  ipa: string;
  fa: string;
  guide: string;
  band: number;
};

export type PairNote = {
  id: string;
  title: string;
  pr: string;
  ipa: string;
  fa: string;
  guide: string;
  band: number;
  ex: string;
  tr: string;
};

export type Irregular = {
  id: string;
  base: string;
  past: string;
  pp: string;
  pr: string;
  fa: string;
  band: number;
  guide: string;
};

export type Formation = {
  id: string;
  affix: string;
  fa: string;
  samples: string;
  samplesFa: string;
  band: number;
  guide: string;
};

export type Family = {
  id: string;
  root: string;
  members: { en: string; pr: string; fa: string }[];
  band: number;
  guide: string;
  ex: string;
  tr: string;
};

export type StudyFace = {
  id: string;
  level?: string;
  title: string;
  ipa?: string;
  pron?: string;
  pos?: string;
  meaning: string;
  example?: string;
  exampleFa?: string;
  note?: string;
  speak: string;
};

export type RefEntry = {
  id: string;
  title: string;
  subtitle: string;
  kicker: string;
  /** 1 core, 2 middle, 3 upper. */
  band: number;
  blocks: { label: string; text: string; dir: "ltr" | "rtl" }[];
  search: string;
};

export type LibDeckId =
  | "pv"
  | "col"
  | "prep"
  | "vp"
  | "occ"
  | "ant"
  | "conf"
  | "syn"
  | "fam"
  | "wf"
  | "irr";

export type Grade = "again" | "hard" | "good" | "easy";

export type FsrsCardState = {
  model: "fsrs6";
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  state: "new" | "learning" | "review" | "relearning";
  /** Actual time of the previous FSRS review, in ms since epoch. */
  lastReview?: number;
};

export type CardProg = {
  /**
   * Legacy SM-2 ease. Retained for backwards compatibility and for the
   * one-time FSRS bridge of older cards; FSRS-native cards no longer schedule
   * from this value.
   */
  ease: number;
  /** Current scheduled interval in whole days (0 while in short learning steps). */
  interval: number;
  due: number;
  reps: number;
  lapses: number;
  state: "learning" | "review";
  step: number;
  /** When the card was last graded (ms). Absent on cards saved before it existed. */
  last?: number;
  /** Present once a card is scheduled natively by FSRS-6. */
  fsrs?: FsrsCardState;
};

export type ReviewEvent = {
  id: string;
  at: number;
  grade: Grade;
  algorithm: "legacy" | "fsrs6";
  /** Desired recall probability used for this FSRS scheduling decision. */
  targetRetention?: number;
  /** True only on the first FSRS review of an older SM-2 review card. */
  bridged?: boolean;
  elapsedDays: number;
  scheduledDays: number;
  stability?: number;
  difficulty?: number;
};

export type Mcq = {
  kind: "mcq";
  id: string;
  prompt: string;
  promptDir: "ltr" | "rtl";
  hint?: string;
  speak?: string;
  options: { key: string; text: string; dir: "ltr" | "rtl" }[];
  answerKey: string;
  explain?: string;
  reveal?: string;
};

export type TypeQ = {
  kind: "type";
  id: string;
  prompt: string;
  promptDir: "ltr" | "rtl";
  hint?: string;
  answer: string;
  accept: string[];
  explain?: string;
};

export type IrrQ = {
  kind: "irregular";
  id: string;
  base: string;
  fa: string;
  past: string;
  pp: string;
  guide?: string;
};

export type Question = Mcq | TypeQ | IrrQ;
