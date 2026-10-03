import fs from "node:fs";
import path from "node:path";
import type { Pilot } from "../src/lib/learn/content.ts";

/**
 * Where the enhanced A1 content stands, batch by batch, for editors and
 * reviewers:
 *
 *   npm run content:status [-- --batch batch-02]
 *
 * Counts per batch: drafts in progress, entries with content, entries released
 * (both reviews approved for the current content), approvals made stale by a
 * later edit, and senses with complete recorded audio. Then the next entries to
 * draft, with what an editor should know about them.
 */

const ROOT = process.cwd();
const read = <T>(file: string): T => JSON.parse(fs.readFileSync(file, "utf8")) as T;
const option = (flag: string) => {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : undefined;
};

type Plan = { batches: { id: string; entries: { id: string; headword: string; flags?: string[] }[] }[] };
const plan = read<Plan>(path.join(ROOT, "content", "a1-plan.json"));
const pilot = read<Pilot>(path.join(ROOT, "public", "data", "pilot-a1.json"));
const ledgerFile = path.join(ROOT, "content", "pilot", "review.json");
const ledger = fs.existsSync(ledgerFile) ? read<Record<string, { version: string }>>(ledgerFile) : {};
const reportFile = path.join(ROOT, "content", "pilot", "audio-report.json");
const flaggedAudio = new Set(
  fs.existsSync(reportFile) ? read<{ flagged: { sense: string }[] }>(reportFile).flagged.map((item) => item.sense.split("#")[0]!) : [],
);

const compiled = new Map(pilot.entries.map((entry) => [entry.id, entry]));
const drafts = new Set<string>();
const draftDir = path.join(ROOT, "content", "drafts");
if (fs.existsSync(draftDir)) {
  for (const batch of fs.readdirSync(draftDir)) {
    const dir = path.join(draftDir, batch);
    if (!fs.statSync(dir).isDirectory()) continue;
    for (const file of fs.readdirSync(dir)) if (file.endsWith(".json")) drafts.add(`lex:A1:${file.replace(/\.json$/, "")}`);
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

const rows = plan.batches
  .filter((batch) => !option("--batch") || batch.id === option("--batch"))
  .map((batch) => {
    const ids = batch.entries.map((item) => item.id);
    const withContent = ids.filter((id) => compiled.has(id));
    return {
      batch: batch.id,
      entries: ids.length,
      drafting: ids.filter((id) => drafts.has(id) && !compiled.has(id)).length,
      content: withContent.length,
      released: withContent.filter((id) => compiled.get(id)!.released).length,
      stale: withContent.filter((id) => ledger[id] && ledger[id]!.version !== compiled.get(id)!.version).length,
      audio: withContent.filter(audioComplete).length,
      listen: withContent.filter((id) => flaggedAudio.has(id)).length,
    };
  });

const header = ["Batch", "Entries", "Drafting", "Content", "Released", "Stale approvals", "Full audio", "Audio to hear"];
const table = [header, ...rows.map((row) => [row.batch, row.entries, row.drafting, row.content, row.released, row.stale, row.audio, row.listen].map(String))];
const widths = header.map((_, column) => Math.max(...table.map((line) => line[column]!.length)));
for (const line of table) console.log(line.map((cell, column) => cell.padEnd(widths[column]!)).join("  "));

const total = rows.reduce((sum, row) => ({ entries: sum.entries + row.entries, content: sum.content + row.content, released: sum.released + row.released }), { entries: 0, content: 0, released: 0 });
console.log(`\nA1: ${total.content} of ${total.entries} entries have enhanced content; ${total.released} released.`);

const next = plan.batches.flatMap((batch) => batch.entries.map((item) => ({ ...item, batch: batch.id }))).filter((item) => !compiled.has(item.id) && !drafts.has(item.id));
if (next.length) {
  console.log(`\nNext to draft (npm run content:scaffold -- --batch ${next[0]!.batch}):`);
  for (const item of next.slice(0, 10)) console.log(`  ${item.id.padEnd(28)} ${item.headword}${item.flags ? `  [${item.flags.join(", ")}]` : ""}`);
}
const unreviewed = pilot.entries.filter((entry) => !entry.released).length;
if (unreviewed) console.log(`\n${unreviewed} entries with content wait for review (docs/PILOT_CONTENT.md#reviewing).`);
