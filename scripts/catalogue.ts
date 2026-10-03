import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/** Shared by the content scripts: the levels, their entries and their plans (docs/CATALOGUE.md). */

export const ROOT = process.cwd();
export const DATA = path.join(ROOT, "public", "data");
export const LEVELS = ["A1", "A2", "B1", "B2", "B2x", "C1"] as const;
export type Level = (typeof LEVELS)[number];

export type Row = { id: string; w: string; pos?: string; ipa?: string; pr?: string; fa: string; ex: string; tr: string };
export type PlanItem = { id: string; headword: string; flags?: string[]; refs?: string[] };
export type Plan = { level: Level; batchSize: number; batches: { id: string; entries: PlanItem[] }[] };

export const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;

const meta = read<{ levels: { id: Level; file: string }[] }>(path.join(DATA, "meta.json"));

export function isLevel(value: string | undefined): value is Level {
  return LEVELS.includes(value as Level);
}

/** The level an entry or sense id belongs to: lex:A2:ability#noun → A2. */
export function levelOfId(id: string): Level | null {
  const level = /^lex:([A-Za-z0-9]+):/.exec(id)?.[1];
  return isLevel(level) ? level : null;
}

/** The part of an entry id after its level, used for draft file names. */
export function slugOf(id: string): string {
  return id.replace(/^lex:[A-Za-z0-9]+:/, "").replace(/#.*$/, "");
}

const rowCache = new Map<Level, Row[]>();
export function rowsOf(level: Level): Row[] {
  let rows = rowCache.get(level);
  if (!rows) {
    const file = meta.levels.find((item) => item.id === level)!.file;
    rows = read<Row[]>(path.join(DATA, file));
    rowCache.set(level, rows);
  }
  return rows;
}

export function planOf(level: Level): Plan {
  return read<Plan>(path.join(ROOT, "content", "plans", `${level}.json`));
}

/** Every planned entry's position in the curriculum: level by level, batch by batch. */
export function catalogueOrder(): Map<string, number> {
  const order = new Map<string, number>();
  for (const level of LEVELS) {
    for (const batch of planOf(level).batches) for (const item of batch.entries) order.set(item.id, order.size);
  }
  return order;
}

/** The batch each planned entry is in. */
export function batchOf(): Map<string, string> {
  return new Map(LEVELS.flatMap((level) => planOf(level).batches.flatMap((batch) => batch.entries.map((item) => [item.id, batch.id] as const))));
}

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/** A content version: the hash of an entry's or a note's content, independent of key order. */
export function versionOf(value: unknown): string {
  return createHash("sha256").update(stable(value)).digest("hex").slice(0, 12);
}

/** The reference collections, by id prefix and file. */
export const COLLECTIONS = [
  { prefix: "pv", file: "phrasal.json", name: "Phrasal verbs" },
  { prefix: "col", file: "collocations.json", name: "Collocations" },
  { prefix: "prep", file: "prepositions.json", name: "Prepositions" },
  { prefix: "vp", file: "verb-patterns.json", name: "Verb patterns" },
  { prefix: "conf", file: "confusing.json", name: "Confusing words" },
  { prefix: "syn", file: "synonyms.json", name: "Synonyms" },
  { prefix: "ant", file: "antonyms.json", name: "Antonyms" },
  { prefix: "irr", file: "irregular.json", name: "Irregular verbs" },
  { prefix: "fam", file: "families.json", name: "Word families" },
  { prefix: "wf", file: "formation.json", name: "Word formation" },
  { prefix: "occ", file: "occupations.json", name: "Occupations" },
] as const;

export type Note = { id: string; band?: number } & Record<string, unknown>;

export function notesOf(file: string): Note[] {
  return read<Note[]>(path.join(DATA, file));
}
