import { bandName, type Copy } from "./i18n";
import {
  DECK_FILE,
  loadAntonyms,
  loadFamilies,
  loadFormation,
  loadIrregular,
  loadLevel,
  loadPairs,
  loadPatterns,
} from "./load";
import { bareHeadword, levelOf } from "./text";
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
  RefEntry,
  StudyFace,
} from "./types";

export function lexFace(word: LexWord, label: string): StudyFace {
  const spoken = bareHeadword(word.w) || word.w;
  return {
    id: word.id,
    level: label,
    title: word.w,
    ipa: word.ipa,
    pron: word.pr,
    pos: word.pos,
    meaning: word.fa,
    example: word.ex,
    exampleFa: word.tr,
    speak: spoken,
  };
}

export function patternFace(item: PatternItem, kicker: string, copy: Copy): StudyFace {
  return {
    id: item.id,
    level: `${kicker} · ${bandName(item.band, copy)}`,
    title: item.w,
    ipa: item.ipa,
    pron: item.pr,
    meaning: item.fa,
    example: item.ex,
    exampleFa: item.tr,
    note: item.guide,
    speak: item.w,
  };
}

function block(label: string, text: string, dir: "ltr" | "rtl") {
  return text ? [{ label, text, dir }] : [];
}

export function patternRef(item: PatternItem, kicker: string, copy: Copy): RefEntry {
  return {
    id: item.id,
    title: item.w,
    subtitle: item.fa,
    kicker: `${kicker} · ${bandName(item.band, copy)}`,
    blocks: [
      ...block(copy.pron, item.pr, "rtl"),
      ...block("IPA", item.ipa ?? "", "ltr"),
      ...block(copy.example, item.ex, "ltr"),
      ...block(copy.meaning, item.tr, "rtl"),
      ...block(copy.guide, item.guide, "rtl"),
    ],
    search: `${item.w} ${item.fa} ${item.ex} ${item.guide}`.toLowerCase(),
  };
}

export function antonymFace(item: Antonym): StudyFace {
  return {
    id: item.id,
    title: item.a,
    ipa: item.ipa,
    pron: item.pr,
    meaning: item.b,
    exampleFa: item.fa,
    note: item.guide,
    speak: item.a,
  };
}

export function antonymRef(item: Antonym, copy: Copy): RefEntry {
  return {
    id: item.id,
    title: `${item.a}  /  ${item.b}`,
    subtitle: item.fa,
    kicker: `${copy.antonyms} · ${bandName(item.band, copy)}`,
    blocks: [
      ...block(copy.pron, item.pr, "rtl"),
      ...block("IPA", item.ipa, "ltr"),
      ...block(copy.guide, item.guide, "rtl"),
    ],
    search: `${item.a} ${item.b} ${item.fa} ${item.guide}`.toLowerCase(),
  };
}

export function irregularFace(item: Irregular): StudyFace {
  return {
    id: item.id,
    title: item.base,
    pron: item.pr,
    meaning: item.fa,
    example: `${item.base} → ${item.past} → ${item.pp}`,
    note: item.guide,
    speak: item.base,
  };
}

export function irregularRef(item: Irregular, copy: Copy): RefEntry {
  return {
    id: item.id,
    title: item.base,
    subtitle: item.fa,
    kicker: `${copy.irregular} · ${bandName(item.band, copy)}`,
    blocks: [
      ...block(copy.past, item.past, "ltr"),
      ...block(copy.participle, item.pp, "ltr"),
      ...block(copy.pron, item.pr, "rtl"),
      ...block(copy.guide, item.guide, "rtl"),
    ],
    search: `${item.base} ${item.past} ${item.pp} ${item.fa}`.toLowerCase(),
  };
}

export function pairRef(item: PairNote, kicker: string, copy: Copy): RefEntry {
  return {
    id: item.id,
    title: item.title,
    subtitle: item.fa,
    kicker: `${kicker} · ${bandName(item.band, copy)}`,
    blocks: [
      ...block(copy.pron, item.pr, "rtl"),
      ...block("IPA", item.ipa, "ltr"),
      ...block(copy.guide, item.guide, "rtl"),
      ...block(copy.example, item.ex, "ltr"),
      ...block(copy.meaning, item.tr, "rtl"),
    ],
    search: `${item.title} ${item.fa} ${item.guide} ${item.ex}`.toLowerCase(),
  };
}

export function familyRef(item: Family, copy: Copy): RefEntry {
  const members = item.members
    .map((member) => [member.en, member.pr, member.fa].filter(Boolean).join("  —  "))
    .join("\n");
  return {
    id: item.id,
    title: item.root,
    subtitle: item.members
      .map((member) => member.fa)
      .filter(Boolean)
      .slice(0, 3)
      .join(" · "),
    kicker: `${copy.families} · ${bandName(item.band, copy)}`,
    blocks: [
      ...block(copy.members, members, "ltr"),
      ...block(copy.guide, item.guide, "rtl"),
      ...block(copy.example, item.ex, "ltr"),
      ...block(copy.meaning, item.tr, "rtl"),
    ],
    search: `${item.root} ${members} ${item.guide}`.toLowerCase(),
  };
}

export function formationRef(item: Formation, copy: Copy): RefEntry {
  return {
    id: item.id,
    title: item.affix,
    subtitle: item.fa,
    kicker: `${copy.formation} · ${bandName(item.band, copy)}`,
    blocks: [
      ...block(copy.samples, item.samples, "ltr"),
      ...block(copy.meaning, item.samplesFa, "rtl"),
      ...block(copy.guide, item.guide, "rtl"),
    ],
    search: `${item.affix} ${item.fa} ${item.samples} ${item.guide}`.toLowerCase(),
  };
}

const DECK_COPY: Record<LibDeckId, keyof Copy> = {
  pv: "phrasal",
  col: "collocations",
  prep: "prepositions",
  vp: "patterns",
  occ: "occupations",
  ant: "antonyms",
  conf: "confusing",
  syn: "synonyms",
  fam: "families",
  wf: "formation",
  irr: "irregular",
};

export async function loadDeckEntries(deck: LibDeckId, copy: Copy): Promise<RefEntry[]> {
  const kicker = copy[DECK_COPY[deck]];
  if (deck === "ant") return (await loadAntonyms()).map((item) => antonymRef(item, copy));
  if (deck === "irr") return (await loadIrregular()).map((item) => irregularRef(item, copy));
  if (deck === "fam") return (await loadFamilies()).map((item) => familyRef(item, copy));
  if (deck === "wf") return (await loadFormation()).map((item) => formationRef(item, copy));
  if (deck === "conf") return (await loadPairs("confusing.json")).map((item) => pairRef(item, kicker, copy));
  if (deck === "syn") return (await loadPairs("synonyms.json")).map((item) => pairRef(item, kicker, copy));
  const rows = await loadPatterns(DECK_FILE[deck]);
  return rows.map((item) => patternRef(item, kicker, copy));
}

export async function loadStudyFaces(
  focus: LevelId,
  extraIds: string[],
  meta: Meta,
  copy: Copy,
): Promise<Map<string, StudyFace>> {
  const map = new Map<string, StudyFace>();
  const levels = new Set<LevelId>([focus]);
  const decks = new Set<LibDeckId>();
  for (const id of extraIds) {
    const level = levelOf(id);
    if (level) levels.add(level);
    else {
      const prefix = id.split(":")[0] as LibDeckId;
      if (Object.hasOwn(DECK_FILE, prefix)) decks.add(prefix);
    }
  }

  await Promise.all([
    ...[...levels].map(async (level) => {
      const label = meta.levels.find((item) => item.id === level)?.label ?? level;
      const words = await loadLevel(level);
      for (const word of words) map.set(word.id, lexFace(word, label));
    }),
    ...[...decks].map(async (deck) => {
      const faces = await deckFaces(deck, copy);
      for (const face of faces) map.set(face.id, face);
    }),
  ]);
  return map;
}

async function deckFaces(deck: LibDeckId, copy: Copy): Promise<StudyFace[]> {
  const kicker = copy[DECK_COPY[deck]];
  if (deck === "ant") return (await loadAntonyms()).map(antonymFace);
  if (deck === "irr") return (await loadIrregular()).map(irregularFace);
  if (deck === "conf" || deck === "syn") {
    const file = deck === "conf" ? "confusing.json" : "synonyms.json";
    return (await loadPairs(file)).map((item) => ({
      id: item.id,
      level: kicker,
      title: item.title,
      ipa: item.ipa,
      pron: item.pr,
      meaning: item.fa,
      example: item.ex,
      exampleFa: item.tr,
      note: item.guide,
      speak: item.title.split("/")[0]?.trim() || item.title,
    }));
  }
  if (deck === "fam") {
    return (await loadFamilies()).map((item) => ({
      id: item.id,
      level: kicker,
      title: item.root,
      meaning: item.members
        .map((member) => member.fa)
        .filter(Boolean)
        .join(" · "),
      example: item.members
        .map((member) => member.en)
        .filter(Boolean)
        .join("\n"),
      note: item.guide,
      speak: item.root,
    }));
  }
  if (deck === "wf") {
    return (await loadFormation()).map((item) => ({
      id: item.id,
      level: kicker,
      title: item.affix,
      meaning: item.fa,
      example: item.samples,
      exampleFa: item.samplesFa,
      note: item.guide,
      speak: item.affix.replace(/[^A-Za-z]/g, ""),
    }));
  }
  return (await loadPatterns(DECK_FILE[deck])).map((item) => patternFace(item, kicker, copy));
}
