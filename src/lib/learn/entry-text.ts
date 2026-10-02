import { DECK_FILE } from "./load";
import type { LevelId, LibDeckId } from "./types";

/** The fields of an entry that the explain prompt is built from. */
export type EntryText = { word: string; meaning: string; example: string; pos: string };

type Row = Record<string, unknown>;

const LEVELS: LevelId[] = ["A1", "A2", "B1", "B2", "B2x", "C1"];

function text(value: unknown): string {
  // Strip the Unicode bidi isolates the source data wraps inline English in.
  return typeof value === "string" ? value.replace(/[⁦-⁩]/g, "").trim() : "";
}

/** Which data file holds an entry id such as `lex:A1:about` or `irr:be`. */
export function entryFile(id: string): string | null {
  const [prefix, level] = id.split(":");
  if (prefix === "lex") {
    return LEVELS.includes(level as LevelId) ? `lex-${level!.toLowerCase()}.json` : null;
  }
  return prefix && Object.hasOwn(DECK_FILE, prefix) ? DECK_FILE[prefix as LibDeckId] : null;
}

export function entryText(id: string, row: Row): EntryText | null {
  const prefix = id.split(":")[0];
  let entry: EntryText;
  switch (prefix) {
    case "lex":
      entry = { word: text(row.w), meaning: text(row.fa), example: text(row.ex), pos: text(row.pos) };
      break;
    case "ant":
      entry = { word: text(row.a), meaning: `${text(row.fa)} (opposite: ${text(row.b)})`, example: "", pos: "" };
      break;
    case "irr":
      entry = {
        word: text(row.base),
        meaning: text(row.fa),
        example: `${text(row.base)} → ${text(row.past)} → ${text(row.pp)}`,
        pos: "verb",
      };
      break;
    case "conf":
      entry = { word: text(row.pair), meaning: text(row.guide), example: text(row.ex), pos: "" };
      break;
    case "syn":
      entry = { word: text(row.group), meaning: text(row.fa), example: text(row.ex), pos: "" };
      break;
    case "fam": {
      const members = Array.isArray(row.members) ? (row.members as Row[]) : [];
      entry = {
        word: text(row.root),
        meaning: members.map((member) => `${text(member.en)}: ${text(member.fa)}`).join("; "),
        example: text(row.ex),
        pos: "",
      };
      break;
    }
    case "wf":
      entry = { word: text(row.affix), meaning: text(row.fa), example: text(row.samples), pos: "" };
      break;
    default:
      entry = { word: text(row.w), meaning: text(row.fa), example: text(row.ex), pos: "" };
  }
  return entry.word && entry.meaning ? entry : null;
}
