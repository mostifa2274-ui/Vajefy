import fs from "node:fs";
import path from "node:path";

/**
 * The plan for enhanced content across the whole catalogue: for each level,
 * every entry in exactly one batch (docs/CATALOGUE.md). In A1 the 150 pilot
 * entries come first; everywhere else entries follow in order of usefulness,
 * 100 to a batch. Once written, batches are never reshuffled, because editors
 * and reviewers work through them in order.
 *
 * Each planned entry says what an editor should know before drafting it:
 * flags (several senses, other levels, irregular forms) and the reference
 * notes that already teach something about the word, which the entry must
 * agree with.
 *
 *   node scripts/plan-catalogue.mjs            create the plans, or append new entries
 *   node scripts/plan-catalogue.mjs --check    (CI) the plans cover every level exactly
 */

const ROOT = process.cwd();
const DATA = path.join(ROOT, "public", "data");
const PLANS = path.join(ROOT, "content", "plans");
const BATCH_SIZE = 100;

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const meta = read(path.join(DATA, "meta.json"));
const usefulness = read(path.join(DATA, "usefulness.json"));
const pilot = read(path.join(ROOT, "content", "pilot-a1.json")).entries.map((item) => item.id);
const irregular = new Set(read(path.join(DATA, "irregular.json")).map((row) => row.base.toLowerCase()));

// Homographs carry superscript numbers in the dataset (close¹, close²).
const bare = (headword) => headword.toLowerCase().replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, "").replace(/\s*\(.*?\)\s*/g, "").trim();
const rowsOf = new Map(meta.levels.map((level) => [level.id, read(path.join(DATA, level.file))]));
const levelsOf = new Map();
for (const [level, rows] of rowsOf) {
  for (const row of rows) {
    const key = bare(row.w);
    levelsOf.set(key, [...new Set([...(levelsOf.get(key) ?? []), level])]);
  }
}

// Reference notes by the words they are about.
const STOP = new Set(["a", "an", "the", "to", "of", "in", "on", "at", "for", "with", "by", "from", "up", "out", "off", "into", "sb", "sth", "someone", "something", "one's", "be", "do"]);
const notesAbout = new Map();
const note = (word, id) => {
  const key = word.toLowerCase().trim();
  if (!key || STOP.has(key)) return;
  notesAbout.set(key, [...new Set([...(notesAbout.get(key) ?? []), id])]);
};
const firstWord = (text) => text.toLowerCase().split(/[\s+/]+/)[0] ?? "";
for (const row of read(path.join(DATA, "phrasal.json"))) note(firstWord(row.w), row.id);
for (const row of read(path.join(DATA, "prepositions.json"))) note(firstWord(row.w), row.id);
for (const row of read(path.join(DATA, "verb-patterns.json"))) note(firstWord(row.w), row.id);
for (const row of read(path.join(DATA, "collocations.json"))) for (const word of row.w.split(/\s+/)) note(word, row.id);
for (const row of read(path.join(DATA, "antonyms.json"))) for (const word of [row.a, row.b]) note(word, row.id);
for (const row of read(path.join(DATA, "confusing.json"))) for (const word of row.pair.split("/")) note(word, row.id);
for (const row of read(path.join(DATA, "synonyms.json"))) for (const word of row.group.split("/")) note(word, row.id);
for (const row of read(path.join(DATA, "irregular.json"))) note(row.base, row.id);
for (const row of read(path.join(DATA, "families.json"))) {
  note(row.root, row.id);
  for (const member of row.members) note(member.en.replace(/\s*\(.*?\)\s*/g, ""), row.id);
}
for (const row of read(path.join(DATA, "occupations.json"))) note(row.w, row.id);

/** What an editor should know before drafting an entry. */
function describe(level, id, byId) {
  const row = byId.get(id);
  const flags = [];
  // Several parts of speech in one entry usually means several senses.
  if (/[،,/]/.test(row.pos ?? "")) flags.push("split-senses");
  const key = bare(row.w);
  const others = (levelsOf.get(key) ?? []).filter((other) => other !== level);
  if (others.length) flags.push(`also-${others.join("-")}`);
  if (irregular.has(key)) flags.push("irregular-verb");
  if (/[,/]/.test(row.w)) flags.push("several-forms");
  const refs = [...new Set(key.split(/\s*[,/]\s*/).flatMap((form) => notesAbout.get(form) ?? []))].sort();
  return { id, headword: row.w, ...(flags.length ? { flags } : {}), ...(refs.length ? { refs } : {}) };
}

function build(level, existing) {
  const rows = rowsOf.get(level);
  const byId = new Map(rows.map((row) => [row.id, row]));
  const first = level === "A1" ? pilot : [];
  const placed = new Set(existing ? existing.batches.flatMap((batch) => batch.entries.map((item) => item.id)) : first);
  const batches = existing
    ? existing.batches.map((batch) => ({ ...batch, entries: batch.entries.map((item) => describe(level, item.id, byId)) }))
    : first.length
      ? [{ id: "pilot", entries: first.map((id) => describe(level, id, byId)) }]
      : [];
  const rest = (usefulness[level] ?? []).filter((id) => byId.has(id) && !placed.has(id));
  for (const row of rows) if (!placed.has(row.id) && !rest.includes(row.id)) rest.push(row.id);
  // New entries fill the last batch before a new one starts.
  const last = batches.at(-1);
  if (last && last.id !== "pilot" && last.entries.length < BATCH_SIZE) {
    last.entries.push(...rest.splice(0, BATCH_SIZE - last.entries.length).map((id) => describe(level, id, byId)));
  }
  // Numbering continues after the highest batch; the pilot counts as A1's first.
  let number = Math.max(0, ...batches.map((batch) => (batch.id === "pilot" ? 1 : Number(/^batch-(\d+)$/.exec(batch.id)?.[1] ?? 0)))) + 1;
  while (rest.length) {
    batches.push({ id: `batch-${String(number).padStart(2, "0")}`, entries: rest.splice(0, BATCH_SIZE).map((id) => describe(level, id, byId)) });
    number++;
  }
  return { level, batchSize: BATCH_SIZE, batches };
}

const check = process.argv.includes("--check");
const failures = [];
const summary = [];
for (const { id: level } of meta.levels) {
  const file = path.join(PLANS, `${level}.json`);
  const existing = fs.existsSync(file) ? read(file) : null;
  const byId = new Set(rowsOf.get(level).map((row) => row.id));
  let missing = 0;
  if (existing) {
    // Problems an editor must resolve, as opposed to new entries, which are appended.
    const seen = new Map();
    for (const batch of existing.batches) {
      for (const item of batch.entries) {
        if (seen.has(item.id)) failures.push(`${level}: ${item.id} is in ${seen.get(item.id)} and ${batch.id}`);
        seen.set(item.id, batch.id);
        if (!byId.has(item.id)) failures.push(`${level}: ${item.id} (${batch.id}) is no longer a ${level} entry`);
      }
    }
    if (level === "A1" && (existing.batches[0]?.id !== "pilot" || existing.batches[0].entries.map((item) => item.id).join() !== pilot.join())) {
      failures.push("A1: the first batch must be the pilot, in the order of content/pilot-a1.json");
    }
    missing = [...byId].filter((id) => !seen.has(id)).length;
  }
  if (failures.length) continue;
  const output = `${JSON.stringify(build(level, existing), null, 1)}\n`;
  if (check) {
    if (!existing) failures.push(`content/plans/${level}.json is missing (run node scripts/plan-catalogue.mjs)`);
    else if (missing) failures.push(`${level}: ${missing} entries are in no batch (run node scripts/plan-catalogue.mjs)`);
    else if (fs.readFileSync(file, "utf8") !== output) failures.push(`content/plans/${level}.json is out of date (run node scripts/plan-catalogue.mjs)`);
  } else {
    fs.mkdirSync(PLANS, { recursive: true });
    fs.writeFileSync(file, output);
  }
  const plan = JSON.parse(output);
  const entries = plan.batches.flatMap((batch) => batch.entries);
  summary.push(`${level} ${entries.length} in ${plan.batches.length}, ${entries.filter((item) => item.flags?.includes("split-senses")).length} to split, ${entries.filter((item) => item.refs).length} with notes`);
}

if (failures.length) {
  console.error(`Catalogue plans need an editor's decision:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`Catalogue plans OK (entries in batches, sense splits, entries with reference notes): ${summary.join("; ")}.`);
