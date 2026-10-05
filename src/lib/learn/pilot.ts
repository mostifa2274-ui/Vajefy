import type {
  AudioPack,
  Contrast,
  CourseUnit,
  Entry,
  Goal,
  ListedEntry,
  ListedSense,
  Pilot,
  PilotCatalogue,
  PilotEntry,
  PilotOrder,
  PilotPart,
  Scene,
  Sense,
  SenseAudio,
} from "./content";
import { entryIdOf, orderForGoal } from "./targets";
import { CONTENT_CHANNEL, introducibleIn, type Channel } from "./channel";
import { loadJson } from "./load";
import { levelOf } from "./text";
import type { LevelId } from "./types";

export type { PilotEntry };

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
/** A learning target as listed: its word, meaning and part of speech. */
export type PilotTarget = { sense: ListedSense; entry: ListedEntry; index: number };
/** A learning target with everything needed to teach and check it. */
export type TargetContent = { sense: Sense; entry: PilotEntry; index: number };

export type PilotIndex = {
  version: string;
  /** Every learning target in course order. */
  targets: PilotTarget[];
  /** Curriculum units, which entries refer to by index. */
  units: CourseUnit[];
  bySense: Map<string, PilotTarget>;
  byEntry: Map<string, ListedEntry>;
  contrasts: Contrast[];
  scenes: Scene[];
  /**
   * Teaching content and audio of the entries loaded so far: `loadPilot(ids)`
   * resolves once the given targets are here. They only ever grow.
   */
  content: Map<string, TargetContent>;
  entries: Map<string, PilotEntry>;
  audio: Record<string, SenseAudio>;
  /** The part file holding each entry's content. */
  parts: Map<string, string>;
};

function listIndex(
  version: string,
  units: CourseUnit[],
  entries: ListedEntry[],
  contrasts: Contrast[],
  scenes: Scene[],
  parts: Map<string, string>,
): PilotIndex {
  const targets: PilotTarget[] = [];
  const bySense = new Map<string, PilotTarget>();
  const byEntry = new Map<string, ListedEntry>();
  for (const entry of entries) {
    byEntry.set(entry.id, entry);
    entry.senses.forEach((sense, position) => {
      const target = { sense, entry, index: position };
      targets.push(target);
      bySense.set(sense.id, target);
    });
  }
  return { version, targets, units, bySense, byEntry, contrasts, scenes, content: new Map(), entries: new Map(), audio: {}, parts };
}

function addPart(index: PilotIndex, part: PilotPart) {
  for (const entry of part.entries) {
    index.entries.set(entry.id, entry);
    entry.senses.forEach((sense, position) => index.content.set(sense.id, { sense, entry, index: position }));
  }
  Object.assign(index.audio, part.audio);
}

/** An index with all the content loaded, from the single compiled file (scripts and tests). */
export function indexPilot(pilot: Pilot): PilotIndex {
  const index = listIndex(pilot.version, pilot.units, pilot.entries, pilot.contrasts, pilot.scenes, new Map());
  addPart(index, { entries: pilot.entries, audio: pilot.audio });
  return index;
}

let listing: Promise<PilotIndex> | null = null;
/** The index as last loaded: replaced, never changed, when content is added. */
let latest: PilotIndex | null = null;
const loading = new Map<string, Promise<void>>();

/**
 * The enhanced content: every target listed, and the teaching content of at
 * least the given targets (sense or entry ids). Content loads a part at a
 * time and stays loaded. The result is a new object only when content was
 * added, so a screen holding it in state renders again only then.
 */
export function loadPilot(ids: Iterable<string> = []): Promise<PilotIndex> {
  listing ??= loadJson<PilotCatalogue>("enhanced/index.json")
    .then((catalogue) => {
      const parts = new Map(catalogue.entries.map((entry) => [entry.id, catalogue.parts[entry.part]!]));
      latest = listIndex(catalogue.version, catalogue.units, catalogue.entries, catalogue.contrasts, catalogue.scenes, parts);
      return latest;
    })
    .catch((error: unknown) => {
      listing = null;
      throw error;
    });
  const wanted = [...ids];
  return listing.then(async (index) => {
    const files = new Set<string>();
    for (const id of wanted) {
      const file = index.parts.get(entryIdOf(id));
      if (file && !index.entries.has(entryIdOf(id))) files.add(file);
    }
    await Promise.all(
      [...files].map((file) => {
        let pending = loading.get(file);
        if (!pending) {
          pending = loadJson<PilotPart>(file).then((part) => {
            addPart(index, part);
            latest = { ...index };
          });
          // A part that failed is fetched afresh next time.
          pending.catch(() => loading.delete(file));
          loading.set(file, pending);
        }
        return pending;
      }),
    );
    return latest ?? index;
  });
}

/** Whether the content of every given target's entry is loaded (or it has none). */
export function hasContent(index: PilotIndex, ids: readonly string[]): boolean {
  return ids.every((id) => index.entries.has(entryIdOf(id)) || !index.parts.has(entryIdOf(id)));
}

/** Every current clip per accent, for downloading pronunciation for offline use. */
export function loadAudioPack(): Promise<AudioPack> {
  return loadJson<AudioPack>("enhanced/audio-pack.json");
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
    contrasts: index.contrasts.filter((contrast) => contrast.entries.every(released)),
    scenes: index.scenes.filter((scene) => scene.targets.every(released)),
  };
}

/** Pilot targets in the order to introduce them for the learner's goal: the curriculum's, where one is mapped. */
export function introductionOrder(targets: PilotTarget[], goal: Goal | undefined): PilotTarget[] {
  return orderForGoal(targets, goal, (target) => ({ goals: target.entry.goals, sense: target.index, unit: target.entry.unit }));
}

/** The curriculum unit a target belongs to, with its number within its level (1 for a level's first unit). */
export function unitOf(index: Pick<PilotIndex, "units">, target: PilotTarget): (CourseUnit & { number: number }) | null {
  const unit = target.entry.unit === null || target.entry.unit === undefined ? undefined : index.units[target.entry.unit];
  if (!unit) return null;
  return { ...unit, number: index.units.filter((other) => other.level === unit.level).indexOf(unit) + 1 };
}

/** Targets at one level of the catalogue. */
export function atLevel<T extends { sense: { id: string } }>(targets: T[], level: LevelId): T[] {
  return targets.filter((target) => levelOf(target.sense.id) === level);
}

/**
 * The guided curriculum for a learner: lessons at their focus level first,
 * then the enhanced content of the other levels, lowest first.
 */
export function focusFirst<T extends { sense: { id: string } }>(ordered: T[], focus: LevelId): T[] {
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
export function pilotFace(target: TargetContent, audio: Record<string, SenseAudio>, accent: "en-GB" | "en-US", pron?: string): StudyFaceLike {
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
