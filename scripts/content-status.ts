import fs from "node:fs";
import path from "node:path";
import type { Pilot } from "../src/lib/learn/content.ts";
import { isLevel, LEVELS, planOf, read, ROOT, type Level } from "./catalogue.ts";

/**
 * Where the enhanced content stands across the catalogue, for editors and
 * reviewers (docs/CATALOGUE.md):
 *
 *   npm run content:status                     every level, one line each
 *   npm run content:status -- --level A2       one level, batch by batch
 *   npm run content:status -- --level A1 --batch batch-02
 *
 * Counts: drafts in progress, entries with content, entries released (both
 * reviews approved for the current content), approvals made stale by a later
 * edit, and entries whose every sense has complete recorded audio. Then the
 * next entries to draft, with what an editor should know about them. The
 * reference notes' review status is reported by `npm run content:notes`.
 */

const option = (flag: string) => {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : undefined;
};
const levelOption = option("--level");
if (levelOption !== undefined && !isLevel(levelOption)) {
  console.error(`--level must be one of ${LEVELS.join(", ")}`);
  process.exit(1);
}

const pilot = read<Pilot>(path.join(ROOT, "content", "compiled", "enhanced.json"));
const ledgerFile = path.join(ROOT, "content", "pilot", "review.json");
const ledger = fs.existsSync(ledgerFile) ? read<Record<string, { version: string }>>(ledgerFile) : {};
const reportFile = path.join(ROOT, "content", "pilot", "audio-report.json");
const flaggedAudio = new Set(
  fs.existsSync(reportFile) ? read<{ flagged: { sense: string }[] }>(reportFile).flagged.map((item) => item.sense.split("#")[0]!) : [],
);

const compiled = new Map(pilot.entries.map((entry) => [entry.id, entry]));
const drafts = new Set<string>();
for (const level of LEVELS) {
  const root = path.join(ROOT, "content", "drafts", level);
  if (!fs.existsSync(root)) continue;
  for (const batch of fs.readdirSync(root)) {
    const dir = path.join(root, batch);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) if (file.endsWith(".json")) drafts.add(`lex:${level}:${file.replace(/\.json$/, "")}`);
  }
}

/** Every sense of the entry has its word and examples recorded in both accents. */
function audioComplete(id: string): boolean {
  const entry = compiled.get(id);
  if (!entry) return false;
  return entry.senses.every((sense) => {
    const clips = pilot.audio[sense.id];
    return (["gb", "us"] as const).every((accent) => clips?.[accent]?.word && clips[accent]!.examples.length === sense.examples.length && clips[accent]!.examples.every(Boolean));
  });
}

function count(name: string, ids: string[]) {
  const withContent = ids.filter((id) => compiled.has(id));
  return {
    name,
    entries: ids.length,
    drafting: ids.filter((id) => drafts.has(id) && !compiled.has(id)).length,
    content: withContent.length,
    released: withContent.filter((id) => compiled.get(id)!.released).length,
    stale: withContent.filter((id) => ledger[id] && ledger[id]!.version !== compiled.get(id)!.version).length,
    audio: withContent.filter(audioComplete).length,
    listen: withContent.filter((id) => flaggedAudio.has(id)).length,
  };
}

const levels: Level[] = levelOption ? [levelOption] : [...LEVELS];
const rows = levelOption
  ? planOf(levelOption)
      .batches.filter((batch) => !option("--batch") || batch.id === option("--batch"))
      .map((batch) => count(batch.id, batch.entries.map((item) => item.id)))
  : levels.map((level) => count(level, planOf(level).batches.flatMap((batch) => batch.entries.map((item) => item.id))));

const header = [levelOption ? "Batch" : "Level", "Entries", "Drafting", "Content", "Released", "Stale approvals", "Full audio", "Audio to hear"];
const table = [header, ...rows.map((row) => [row.name, row.entries, row.drafting, row.content, row.released, row.stale, row.audio, row.listen].map(String))];
const widths = header.map((_, column) => Math.max(...table.map((line) => line[column]!.length)));
for (const line of table) console.log(line.map((cell, column) => cell.padEnd(widths[column]!)).join("  "));

const total = rows.reduce((sum, row) => ({ entries: sum.entries + row.entries, content: sum.content + row.content, released: sum.released + row.released }), { entries: 0, content: 0, released: 0 });
console.log(`\n${levelOption ?? "Catalogue"}: ${total.content} of ${total.entries} entries have enhanced content; ${total.released} released.`);

// The next entries to draft: the first level, in curriculum order, with planned entries left.
for (const level of levels) {
  const next = planOf(level)
    .batches.filter((batch) => !option("--batch") || batch.id === option("--batch"))
    .flatMap((batch) => batch.entries.map((item) => ({ ...item, batch: batch.id })))
    .filter((item) => !compiled.has(item.id) && !drafts.has(item.id));
  if (!next.length) continue;
  console.log(`\nNext to draft (npm run content:scaffold -- --level ${level} --batch ${next[0]!.batch}):`);
  for (const item of next.slice(0, 10)) {
    const about = [...(item.flags ?? []), ...(item.refs?.length ? [`${item.refs.length} note${item.refs.length > 1 ? "s" : ""}`] : [])];
    console.log(`  ${item.id.padEnd(30)} ${item.headword}${about.length ? `  [${about.join(", ")}]` : ""}`);
  }
  break;
}
const unreviewed = pilot.entries.filter((entry) => !entry.released).length;
if (unreviewed) console.log(`\n${unreviewed} entries with content wait for review (docs/PILOT_CONTENT.md#reviewing).`);
