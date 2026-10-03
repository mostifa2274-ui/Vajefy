import fs from "node:fs";
import path from "node:path";

/**
 * The plan for extending the enhanced content across all of A1: every A1 entry
 * in exactly one batch. The 150 pilot entries come first; the rest follow in
 * order of usefulness, 100 to a batch. Once written, batches are never
 * reshuffled, because editors and reviewers work through them in order. Run
 * with --check (CI) to verify the plan still covers A1 exactly; run without
 * arguments to create it, or to append A1 entries that are new to the data.
 */

const ROOT = process.cwd();
const DATA = path.join(ROOT, "public", "data");
const PLAN = path.join(ROOT, "content", "a1-plan.json");
const BATCH_SIZE = 100;

const read = (file) => JSON.parse(fs.readFileSync(file, "utf8"));
const a1 = read(path.join(DATA, "lex-a1.json"));
const byId = new Map(a1.map((row) => [row.id, row]));
const pilot = read(path.join(ROOT, "content", "pilot-a1.json")).entries.map((item) => item.id);
const usefulness = read(path.join(DATA, "usefulness.json")).A1;
const irregular = new Set(read(path.join(DATA, "irregular.json")).map((row) => row.base.toLowerCase()));

// Homographs carry superscript numbers in the dataset (close¹, close²).
const bare = (headword) => headword.toLowerCase().replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]/g, "").replace(/\s*\(.*?\)\s*/g, "").trim();
const elsewhere = new Map();
for (const level of read(path.join(DATA, "meta.json")).levels) {
  if (level.id === "A1") continue;
  for (const row of read(path.join(DATA, level.file))) {
    const key = bare(row.w);
    elsewhere.set(key, [...new Set([...(elsewhere.get(key) ?? []), level.id])]);
  }
}

/** What an editor should know before drafting an entry. */
function describe(id) {
  const row = byId.get(id);
  const flags = [];
  // Several parts of speech in one entry usually means several senses.
  if (/[،,/]/.test(row.pos ?? "")) flags.push("split-senses");
  const key = bare(row.w);
  if (elsewhere.has(key)) flags.push(`also-${elsewhere.get(key).join("-")}`);
  if (irregular.has(key)) flags.push("irregular-verb");
  if (/[,/]/.test(row.w)) flags.push("several-forms");
  return { id, headword: row.w, ...(flags.length ? { flags } : {}) };
}

function build(existing) {
  const placed = new Set(existing ? existing.batches.flatMap((batch) => batch.entries.map((item) => item.id)) : []);
  const batches = existing ? existing.batches.map((batch) => ({ ...batch, entries: batch.entries.map((item) => describe(item.id)) })) : [{ id: "pilot", entries: pilot.map(describe) }];
  if (!existing) pilot.forEach((id) => placed.add(id));
  const rest = usefulness.filter((id) => byId.has(id) && !placed.has(id));
  for (const id of a1.map((row) => row.id)) if (!placed.has(id) && !rest.includes(id)) rest.push(id);
  let number = batches.length + 1;
  // New entries fill the last batch before a new one starts.
  const last = batches.at(-1);
  if (last && last.id !== "pilot" && last.entries.length < BATCH_SIZE) {
    last.entries.push(...rest.splice(0, BATCH_SIZE - last.entries.length).map(describe));
  }
  while (rest.length) {
    batches.push({ id: `batch-${String(number).padStart(2, "0")}`, entries: rest.splice(0, BATCH_SIZE).map(describe) });
    number++;
  }
  return { level: "A1", batchSize: BATCH_SIZE, batches };
}

const existing = fs.existsSync(PLAN) ? read(PLAN) : null;
// Problems an editor must resolve, as opposed to new entries, which are appended.
const failures = [];
let missing = [];
if (existing) {
  const seen = new Map();
  for (const batch of existing.batches) {
    for (const item of batch.entries) {
      if (seen.has(item.id)) failures.push(`${item.id} is in ${seen.get(item.id)} and ${batch.id}`);
      seen.set(item.id, batch.id);
      if (!byId.has(item.id)) failures.push(`${item.id} (${batch.id}) is no longer an A1 entry`);
    }
  }
  const pilotBatch = existing.batches[0];
  if (pilotBatch?.id !== "pilot" || pilotBatch.entries.map((item) => item.id).join() !== pilot.join()) {
    failures.push("the first batch must be the pilot, in the order of content/pilot-a1.json");
  }
  missing = a1.filter((row) => !seen.has(row.id)).map((row) => row.id);
}

if (failures.length && existing) {
  console.error(`A1 plan has problems that need an editor's decision:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
const output = `${JSON.stringify(build(existing), null, 1)}\n`;
if (process.argv.includes("--check")) {
  if (!existing) failures.push("content/a1-plan.json is missing (run node scripts/plan-a1.mjs)");
  else if (missing.length) failures.push(`${missing.length} A1 entries are in no batch (run node scripts/plan-a1.mjs): ${missing.slice(0, 5).join(", ")}`);
  else if (fs.readFileSync(PLAN, "utf8") !== output) failures.push("content/a1-plan.json is out of date (run node scripts/plan-a1.mjs)");
  if (failures.length) {
    console.error(`A1 plan failed:\n- ${failures.join("\n- ")}`);
    process.exit(1);
  }
} else {
  fs.writeFileSync(PLAN, output);
}
const plan = JSON.parse(output);
const flagged = plan.batches.flatMap((batch) => batch.entries).filter((item) => item.flags?.includes("split-senses")).length;
console.log(`A1 plan OK: ${plan.batches.reduce((sum, batch) => sum + batch.entries.length, 0)} entries in ${plan.batches.length} batches; ${flagged} need a sense split.`);
