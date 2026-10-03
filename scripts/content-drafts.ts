import fs from "node:fs";
import path from "node:path";
import { entry, headwordOf, type Entry, type Sense } from "../src/lib/learn/content.ts";
import { batchOf as plannedBatches, isLevel, LEVELS, levelOfId, planOf, read, ROOT, rowsOf, slugOf, type Level, type PlanItem, type Row } from "./catalogue.ts";

/**
 * Drafting enhanced entries, level by level and batch by batch
 * (docs/CATALOGUE.md).
 *
 *   npm run content:scaffold -- --level A2 --batch batch-01 [--limit 10]   start drafts from the dataset
 *   npm run content:drafts [-- --level A2] [-- --batch batch-01]           what each draft still needs
 *   npm run content:promote -- --entry lex:A2:ability                      move a finished draft into the content
 *
 * --level defaults to A1. Drafts live in content/drafts/<level>/<batch>/ and
 * are not compiled into the app. A scaffold copies what the dataset already
 * knows (headword, gloss, IPA, the existing example) and leaves the teaching
 * content empty. When a sense split is likely, it starts one sense per part
 * of speech. Promotion validates the whole entry, adds it to
 * content/pilot/entries/<level>-<batch>.json and removes the draft; the entry
 * then goes through bilingual and pronunciation review like every other.
 */

const DRAFTS = path.join(ROOT, "content", "drafts");
const ENTRIES = path.join(ROOT, "content", "pilot", "entries");

const args = process.argv.slice(2);
const command = args[0];
const option = (flag: string) => {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
};
const levelOption = option("--level") ?? "A1";
if (!isLevel(levelOption)) {
  console.error(`--level must be one of ${LEVELS.join(", ")}`);
  process.exit(1);
}
const level: Level = levelOption;
const plan = planOf(level);
const rows = new Map(rowsOf(level).map((row): [string, Row] => [row.id, row]));
const batchOf = plannedBatches();

const POS: Record<string, Sense["pos"]> = {
  اسم: "noun",
  فعل: "verb",
  "فعل کمکی": "verb",
  "فعل وجهی": "modal",
  صفت: "adjective",
  قید: "adverb",
  ضمیر: "pronoun",
  "حرف اضافه": "preposition",
  "حرف ربط": "conjunction",
  عدد: "number",
  "تعیین‌کننده": "determiner",
  "عبارت ندایی": "exclamation",
  "حرف تعریف معین": "article",
  "حرف تعریف نامعین": "article",
  "نشانهٔ مصدر": "particle",
};

/** Ids of entries that already have compiled content. */
function compiled(): Set<string> {
  const ids = new Set<string>();
  for (const file of fs.readdirSync(ENTRIES).filter((name) => name.endsWith(".json"))) {
    for (const row of read<{ id: string }[]>(path.join(ENTRIES, file))) ids.add(row.id);
  }
  return ids;
}

const draftFile = (draftLevel: Level, batch: string, id: string) => path.join(DRAFTS, draftLevel, batch, `${slugOf(id)}.json`);

function scaffold(row: Row, item: PlanItem) {
  const flags = item.flags ?? [];
  const parts = [...new Set((row.pos ?? "").split(/[،,/]/).map((part) => POS[part.trim()]).filter(Boolean))] as Sense["pos"][];
  const kinds = parts.length ? parts : (["noun"] as Sense["pos"][]);
  const ipa = row.ipa ?? "";
  return {
    id: row.id,
    headword: headwordOf(row.w),
    goals: ["general"],
    senses: kinds.map((pos, index) => ({
      id: index === 0 ? row.id : `${row.id}#${pos}`,
      pos,
      gloss: index === 0 ? row.fa.split("؛")[0]!.trim() : "",
      meaning: "",
      grammar: [],
      // The dataset's example is a starting point; teaching needs two.
      examples: index === 0 ? [{ en: row.ex, fa: row.tr }] : [],
      collocations: [],
      mistake: { wrong: "", right: "", why: "" },
      pronunciation: { gb: ipa, us: ipa },
      check: [],
    })),
    _draft: {
      source: { pos: row.pos ?? "", gloss: row.fa },
      flags,
      ...(item.refs ? { notes: item.refs } : {}),
      todo: [
        ...(item.refs ? ["Read the reference notes listed in `notes` (Words → Reference): where one is about this sense, the entry must agree with it, or the note is corrected too."] : []),
        "Confirm the senses: split or merge them so each is one learning target.",
        "Write a precise Persian meaning, grammar patterns, a second natural example, collocations, a usage note where needed, and a common mistake.",
        "The dataset's IPA is copied to both accents: give each accent its own, and phonemes in `tts` when spelling alone is ambiguous.",
        "Write at least two checks in new sentences (cloze, choice or produce), never the teaching examples.",
        "Choose goals: everyday, work, study or general.",
      ],
    },
  };
}

function issues(value: unknown): string[] {
  const { _draft, ...content } = value as Record<string, unknown>;
  void _draft;
  const parsed = entry.safeParse(content);
  return parsed.success ? [] : parsed.error.issues.map((issue) => `${issue.path.join(".") || "entry"}: ${issue.message}`);
}

function draftsIn(levels: readonly Level[], batch?: string): { batch: string; file: string }[] {
  return levels.flatMap((draftLevel) => {
    const root = path.join(DRAFTS, draftLevel);
    if (!fs.existsSync(root)) return [];
    const batches = batch ? [batch] : fs.readdirSync(root).filter((name) => fs.statSync(path.join(root, name)).isDirectory());
    return batches.flatMap((name) => {
      const dir = path.join(root, name);
      if (!fs.existsSync(dir)) return [];
      return fs
        .readdirSync(dir)
        .filter((file) => file.endsWith(".json"))
        .sort()
        .map((file) => ({ batch: `${draftLevel}/${name}`, file: path.join(dir, file) }));
    });
  });
}

if (command === "scaffold") {
  const batch = option("--batch");
  const target = plan.batches.find((item) => item.id === batch);
  if (!target) {
    console.error(`Usage: [--level ${level}] --batch <id> [--limit n]. ${level} batches: ${plan.batches.map((item) => item.id).join(", ")}`);
    process.exit(1);
  }
  const limit = Number(option("--limit") ?? target.entries.length);
  const done = compiled();
  let written = 0;
  for (const item of target.entries) {
    if (written >= limit) break;
    const file = draftFile(level, target.id, item.id);
    if (done.has(item.id) || fs.existsSync(file)) continue;
    const row = rows.get(item.id);
    if (!row) continue;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(scaffold(row, item), null, 2)}\n`);
    written++;
  }
  console.log(`Scaffolded ${written} draft(s) in content/drafts/${level}/${target.id}/.`);
} else if (command === "check") {
  const drafts = draftsIn(option("--level") ? [level] : LEVELS, option("--batch"));
  let ready = 0;
  for (const { batch, file } of drafts) {
    const problems = issues(read(file));
    if (!problems.length) ready++;
    console.log(`${problems.length ? "✗" : "✓"} ${batch}/${path.basename(file)}${problems.length ? `: ${problems.length} to do` : ": ready to promote"}`);
    for (const problem of problems.slice(0, 8)) console.log(`    ${problem}`);
    if (problems.length > 8) console.log(`    … and ${problems.length - 8} more`);
  }
  console.log(`${ready} of ${drafts.length} draft(s) ready.`);
} else if (command === "promote") {
  const id = option("--entry");
  const batch = id ? batchOf.get(id) : undefined;
  const entryLevel = id ? levelOfId(id) : null;
  if (!id || !batch || !entryLevel) {
    console.error("Usage: --entry <lex:LEVEL:id> (an entry in content/plans/<LEVEL>.json)");
    process.exit(1);
  }
  const file = draftFile(entryLevel, batch, id);
  if (!fs.existsSync(file)) {
    console.error(`No draft at ${path.relative(ROOT, file)}`);
    process.exit(1);
  }
  const { _draft, ...content } = read<Record<string, unknown>>(file);
  void _draft;
  const parsed = entry.safeParse(content);
  if (!parsed.success) {
    console.error(`${id} is not ready:\n- ${parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("\n- ")}`);
    process.exit(1);
  }
  if (compiled().has(id)) {
    console.error(`${id} already has content; edit it in content/pilot/entries/ instead.`);
    process.exit(1);
  }
  const name = `${entryLevel}-${batch}.json`;
  const target = path.join(ENTRIES, name);
  const list = fs.existsSync(target) ? read<Entry[]>(target) : [];
  list.push(content as Entry);
  fs.writeFileSync(target, `${JSON.stringify(list, null, 2)}\n`);
  fs.rmSync(file);
  console.log(`Promoted ${id} to content/pilot/entries/${name}. Next: npm run content:build, generate audio (docs/AUDIO.md), then review.`);
} else {
  console.error("Commands: scaffold, check, promote");
  process.exit(1);
}
