import type { Contrast, Entry, Goal, Pilot, PilotOrder, Scene, Sense, SenseAudio } from "./content";
import { entryIdOf, orderForGoal } from "./targets";
import { CONTENT_CHANNEL, introducibleIn, type Channel } from "./channel";
import { loadJson } from "./load";
import { levelOf } from "./text";
import type { LevelId } from "./types";

export type PilotEntry = Pilot["entries"][number];

/** Persian part-of-speech labels, matching the original dataset's wording. */
export const POS_FA: Record<Sense["pos"], string> = {
  noun: "اسم",
  verb: "فعل",
  adjective: "صفت",
  adverb: "قید",
  preposition: "حرف اضافه",
  conjunction: "حرف ربط",
  pronoun: "ضمیر",
  determiner: "تعیین‌کننده",
  article: "حرف تعریف",
  modal: "فعل وجهی",
  exclamation: "عبارت ندایی",
  number: "عدد",
  particle: "نشانهٔ مصدر",
};
export type PilotTarget = { sense: Sense; entry: PilotEntry; index: number };

export type PilotIndex = {
  pilot: Pilot;
  /** Every learning target in curriculum order. */
  targets: PilotTarget[];
  bySense: Map<string, PilotTarget>;
  byEntry: Map<string, PilotEntry>;
  contrastsBySense: Map<string, Contrast[]>;
  scenesBySense: Map<string, Scene[]>;
};

let index: Promise<PilotIndex> | null = null;

export function indexPilot(pilot: Pilot): PilotIndex {
  const targets: PilotTarget[] = [];
  const bySense = new Map<string, PilotTarget>();
  const byEntry = new Map<string, PilotEntry>();
  for (const entry of pilot.entries) {
    byEntry.set(entry.id, entry);
    entry.senses.forEach((sense, position) => {
      const target = { sense, entry, index: position };
      targets.push(target);
      bySense.set(sense.id, target);
    });
  }
  const contrastsBySense = new Map<string, Contrast[]>();
  for (const contrast of pilot.contrasts) {
    for (const id of contrast.entries) contrastsBySense.set(id, [...(contrastsBySense.get(id) ?? []), contrast]);
  }
  const scenesBySense = new Map<string, Scene[]>();
  for (const scene of pilot.scenes) {
    for (const id of scene.targets) scenesBySense.set(id, [...(scenesBySense.get(id) ?? []), scene]);
  }
  return { pilot, targets, bySense, byEntry, contrastsBySense, scenesBySense };
}

export function loadPilot(): Promise<PilotIndex> {
  index ??= loadJson<Pilot>("enhanced.json")
    .then(indexPilot)
    .catch((error: unknown) => {
      index = null;
      throw error;
    });
  return index;
}

/** Controlled audio for a sense, for the learner's accent. */
export function senseAudio(audio: Record<string, SenseAudio>, senseId: string, accent: "en-GB" | "en-US") {
  const clips = audio[senseId]?.[accent === "en-US" ? "us" : "gb"];
  const url = (file: string | null | undefined) => (file ? `/audio/${file}` : undefined);
  return { word: url(clips?.word), examples: (clips?.examples ?? []).map(url) };
}

export function pronunciationFor(sense: Sense, accent: "en-GB" | "en-US") {
  return accent === "en-US" ? sense.pronunciation.us : sense.pronunciation.gb;
}

/**
 * The part of the pilot that may be introduced in this build's channel: new
 * targets, Words-page detail, contrasts and scenes. Sense lookups stay
 * complete, so cards a learner already has keep their content.
 */
export function introducible(index: PilotIndex, channel: Channel = CONTENT_CHANNEL): PilotIndex {
  if (channel === "draft") return index;
  const released = (senseId: string) => introducibleIn(channel, index.bySense.get(senseId)?.entry.released ?? false);
  return {
    ...index,
    targets: index.targets.filter((target) => introducibleIn(channel, target.entry.released)),
    byEntry: new Map([...index.byEntry].filter(([, entry]) => introducibleIn(channel, entry.released))),
    pilot: {
      ...index.pilot,
      contrasts: index.pilot.contrasts.filter((contrast) => contrast.entries.every(released)),
      scenes: index.pilot.scenes.filter((scene) => scene.targets.every(released)),
    },
  };
}

/** Pilot targets in the order to introduce them for the learner's goal. */
export function introductionOrder(targets: PilotTarget[], goal: Goal | undefined): PilotTarget[] {
  return orderForGoal(targets, goal, (target) => ({ goals: target.entry.goals, sense: target.index }));
}

/** Targets at one level of the catalogue. */
export function atLevel<T extends { sense: Sense }>(targets: T[], level: LevelId): T[] {
  return targets.filter((target) => levelOf(target.sense.id) === level);
}

/**
 * The guided curriculum for a learner: lessons at their focus level first,
 * then the enhanced content of the other levels, lowest first.
 */
export function focusFirst<T extends { sense: Sense }>(ordered: T[], focus: LevelId): T[] {
  const here = atLevel(ordered, focus);
  return [...here, ...ordered.filter((target) => !here.includes(target))];
}

/**
 * Only the introduction order, a few kilobytes, for screens that need to count
 * upcoming lesson words without loading the whole pilot.
 */
export function loadPilotOrder(): Promise<PilotOrder> {
  return loadJson<PilotOrder>("enhanced-order.json");
}

export function isPilotEntry(index: PilotIndex, id: string): boolean {
  return index.byEntry.has(entryIdOf(id));
}

/** A Review card for a pilot target: the precise sense, its example and its audio. */
export function pilotFace(target: PilotTarget, audio: Record<string, SenseAudio>, accent: "en-GB" | "en-US", pron?: string): StudyFaceLike {
  const { sense, entry } = target;
  const clips = senseAudio(audio, sense.id, accent);
  const grammar = sense.grammar.map((item) => `${item.pattern} — ${item.note}`).join("\n");
  return {
    id: sense.id,
    level: levelLabel(levelOf(sense.id)),
    title: entry.headword,
    ipa: pronunciationFor(sense, accent),
    ...(pron ? { pron } : {}),
    pos: POS_FA[sense.pos],
    meaning: sense.gloss,
    detail: sense.meaning,
    example: sense.examples[0]?.en,
    exampleFa: sense.examples[0]?.fa,
    note: `${grammar}\n✗ ${sense.mistake.wrong}\n✓ ${sense.mistake.right}\n${sense.mistake.why}`,
    speak: entry.headword,
    ...(clips.word ? { clip: clips.word } : {}),
    ...(clips.examples[0] ? { exampleClip: clips.examples[0] } : {}),
    draft: !entry.released,
    version: entry.version,
  };
}

type StudyFaceLike = import("./types").StudyFace;

/** How a level is written: B2x is shown as B2+. */
function levelLabel(level: LevelId | null): string {
  return level === "B2x" ? "B2+" : (level ?? "");
}

export type { Contrast, Entry, Scene, Sense };
