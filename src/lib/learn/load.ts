import type {
  Antonym,
  Family,
  Formation,
  Irregular,
  LexWord,
  LevelId,
  LibDeckId,
  Meta,
  PairNote,
  PatternItem,
} from "./types";

const cache = new Map<string, Promise<unknown>>();

export function loadJson<T>(file: string): Promise<T> {
  const hit = cache.get(file) as Promise<T> | undefined;
  if (hit) return hit;
  const pending = fetch(`/data/${file}`).then((response) => {
    if (!response.ok) throw new Error(file);
    return response.json() as Promise<T>;
  });
  cache.set(file, pending);
  return pending;
}

export function loadMeta() {
  return loadJson<Meta>("meta.json");
}

const LEVEL_FILE: Record<LevelId, string> = {
  A1: "lex-a1.json",
  A2: "lex-a2.json",
  B1: "lex-b1.json",
  B2: "lex-b2.json",
  B2x: "lex-b2x.json",
  C1: "lex-c1.json",
};

export function loadLevel(level: LevelId) {
  return loadJson<LexWord[]>(LEVEL_FILE[level]);
}

export function loadPatterns(file: string) {
  return loadJson<PatternItem[]>(file);
}

export function loadAntonyms() {
  return loadJson<Antonym[]>("antonyms.json");
}

export function loadIrregular() {
  return loadJson<Irregular[]>("irregular.json");
}

export function loadFamilies() {
  return loadJson<Family[]>("families.json");
}

export function loadFormation() {
  return loadJson<Formation[]>("formation.json");
}

export function loadPairs(file: "confusing.json" | "synonyms.json") {
  return loadJson<
    {
      id: string;
      pair?: string;
      group?: string;
      pr: string;
      ipa: string;
      fa: string;
      guide: string;
      band: number;
      ex: string;
      tr: string;
    }[]
  >(file).then((rows) =>
    rows.map(
      (row): PairNote => ({
        id: row.id,
        title: row.pair ?? row.group ?? "",
        pr: row.pr,
        ipa: row.ipa,
        fa: row.fa,
        guide: row.guide,
        band: row.band,
        ex: row.ex,
        tr: row.tr,
      }),
    ),
  );
}

export const DECK_FILE: Record<LibDeckId, string> = {
  pv: "phrasal.json",
  col: "collocations.json",
  prep: "prepositions.json",
  vp: "verb-patterns.json",
  occ: "occupations.json",
  ant: "antonyms.json",
  conf: "confusing.json",
  syn: "synonyms.json",
  fam: "families.json",
  wf: "formation.json",
  irr: "irregular.json",
};
