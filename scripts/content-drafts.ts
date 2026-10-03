import fs from "node:fs";
import path from "node:path";
import { entry, type Entry, type Sense } from "../src/lib/learn/content.ts";

/**
 * Drafting enhanced entries, batch by batch.
 *
 *   npm run content:scaffold -- --batch batch-02 [--limit 10]   start drafts from the dataset
 *   npm run content:drafts [-- --batch batch-02]                what each draft still needs
 *   npm run content:promote -- --entry lex:A1:her               move a finished draft into the content
 *
 * Drafts live in content/drafts/<batch>/ and are not compiled into the app.
 * A scaffold copies what the dataset already knows (headword, gloss, IPA, the
 * existing example) and leaves the teaching content empty. When a sense split
 * is likely, it starts one sense per part of speech. Promotion validates the
 * whole entry, adds it to content/pilot/entries/<batch>.json and removes the
 * draft; the entry then goes through bilingual and pronunciation review like
 * every other.
 */

const ROOT = process.cwd();
const DRAFTS = path.join(ROOT, "content", "drafts");
const ENTRIES = path.join(ROOT, "content", "pilot", "entries");

type Row = { id: string; w: string; pos?: string; ipa?: string; fa: string; ex: string; tr: string };
type Plan = { batches: { id: string; entries: { id: string; headword: string; flags?: string[] }[] }[] };

const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;
const args = process.argv.slice(2);
const command = args[0];
const option = (flag: string) => {
  const at = args.indexOf(flag);
  return at >= 0 ? args[at + 1] : undefined;
};

const plan = read<Plan>(path.join(ROOT, "content", "a1-plan.json"));
const rows = new Map(read<Row[]>(path.join(ROOT, "public", "data", "lex-a1.json")).map((row) => [row.id, row]));
const batchOf = new Map(plan.batches.flatMap((batch) => batch.entries.map((item) => [item.id, batch.id] as const)));

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

const slug = (id: string) => id.replace(/^lex:A1:/, "");
const draftFile = (batch: string, id: string) => path.join(DRAFTS, batch, `${slug(id)}.json`);

function scaffold(row: Row, flags: string[]) {
  const parts = [...new Set((row.pos ?? "").split(/[،,/]/).map((part) => POS[part.trim()]).filter(Boolean))] as Sense["pos"][];
  const kinds = parts.length ? parts : (["noun"] as Sense["pos"][]);
  const ipa = row.ipa ?? "";
  return {
    id: row.id,
    headword: row.w,
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
      todo: [
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

function draftsIn(batch?: string): { batch: string; file: string }[] {
  if (!fs.existsSync(DRAFTS)) return [];
  const batches = batch ? [batch] : fs.readdirSync(DRAFTS).filter((name) => fs.statSync(path.join(DRAFTS, name)).isDirectory());
  return batches.flatMap((name) => {
    const dir = path.join(DRAFTS, name);
    if (!fs.existsSync(dir)) return [];
    return fs
      .readdirSync(dir)
      .filter((file) => file.endsWith(".json"))
      .sort()
      .map((file) => ({ batch: name, file: path.join(dir, file) }));
  });
}

if (command === "scaffold") {
  const batch = option("--batch");
  const target = plan.batches.find((item) => item.id === batch);
  if (!target) {
    console.error(`Usage: --batch <id> [--limit n]. Batches: ${plan.batches.map((item) => item.id).join(", ")}`);
    process.exit(1);
  }
  const limit = Number(option("--limit") ?? target.entries.length);
  const done = compiled();
  let written = 0;
  for (const item of target.entries) {
    if (written >= limit) break;
    const file = draftFile(target.id, item.id);
    if (done.has(item.id) || fs.existsSync(file)) continue;
    const row = rows.get(item.id);
    if (!row) continue;
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, `${JSON.stringify(scaffold(row, item.flags ?? []), null, 2)}\n`);
    written++;
  }
  console.log(`Scaffolded ${written} draft(s) in content/drafts/${target.id}/.`);
} else if (command === "check") {
  const drafts = draftsIn(option("--batch"));
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
  if (!id || !batch) {
    console.error("Usage: --entry <lex:A1:id> (an entry in content/a1-plan.json)");
    process.exit(1);
  }
  const file = draftFile(batch, id);
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
  const target = path.join(ENTRIES, `${batch}.json`);
  const list = fs.existsSync(target) ? read<Entry[]>(target) : [];
  list.push(content as Entry);
  fs.writeFileSync(target, `${JSON.stringify(list, null, 2)}\n`);
  fs.rmSync(file);
  console.log(`Promoted ${id} to content/pilot/entries/${batch}.json. Next: npm run content:build, generate audio (docs/AUDIO.md), then review.`);
} else {
  console.error("Commands: scaffold, check, promote");
  process.exit(1);
}
