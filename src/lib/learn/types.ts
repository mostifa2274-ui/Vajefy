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

export type CardProg = {
  ease: number;
  interval: number;
  due: number;
  reps: number;
  lapses: number;
  state: "learning" | "review";
  step: number;
  /** When the card was last graded (ms). Absent on cards saved before it existed. */
  last?: number;
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
