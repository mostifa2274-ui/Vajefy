import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { COLLECTIONS, DATA, notesOf, read, ROOT, versionOf } from "./catalogue.ts";

/**
 * Review of the reference notes (phrasal verbs, collocations, confusing
 * words and the rest; docs/CATALOGUE.md#reference-notes). As with enhanced
 * entries, an approval names the content version the reviewer read, so a
 * later edit to the note withdraws it until the note is reviewed again.
 *
 *   npm run content:notes                                    progress per collection
 *   npm run content:notes -- --collection conf               the notes of one collection still to review
 *   npm run content:notes -- approve --note conf:do-make --bilingual approved --reviewer "Name" [--notes "…"]
 *   npm run content:notes -- build [--check]                 compile the reviewed list the app reads
 *
 * --note may repeat. Status values: pending, approved, changes.
 */

const LEDGER = path.join(ROOT, "content", "reference", "review.json");
const OUT = path.join(DATA, "reference-reviewed.json");

const record = z.object({
  version: z.string().min(1),
  bilingual: z.enum(["pending", "approved", "changes"]),
  reviewer: z.string().min(1).optional(),
  date: z.string().min(1).optional(),
  notes: z.string().min(1).optional(),
});
type Record = z.infer<typeof record>;

const args = process.argv.slice(2);
const values = (flag: string) => args.flatMap((arg, index) => (arg === flag && args[index + 1] ? [args[index + 1]!] : []));
const one = (flag: string) => values(flag)[0];
const command = args[0] && !args[0].startsWith("--") ? args[0] : "status";

const notes = new Map(COLLECTIONS.flatMap((collection) => notesOf(collection.file).map((note) => [note.id, { note, collection: collection.prefix }] as const)));
const versions = new Map([...notes].map(([id, { note }]) => [id, versionOf(note)]));
const ledger: { [id: string]: unknown } = fs.existsSync(LEDGER) ? read(LEDGER) : {};

function current(id: string): Record | null {
  const parsed = record.safeParse(ledger[id]);
  return parsed.success && parsed.data.version === versions.get(id) ? parsed.data : null;
}

function compile() {
  const failures: string[] = [];
  for (const [id, value] of Object.entries(ledger)) {
    if (!notes.has(id)) failures.push(`review.json: ${id} is not a reference note`);
    else if (!record.safeParse(value).success) failures.push(`review.json: ${id} has an invalid record`);
  }
  const reviewed = [...notes.keys()].filter((id) => current(id)?.bilingual === "approved").sort();
  return { failures, output: `${JSON.stringify({ version: versionOf(reviewed.map((id) => `${id}@${versions.get(id)}`)), reviewed })}\n` };
}

if (command === "approve") {
  const ids = values("--note");
  const bilingual = one("--bilingual");
  if (!ids.length || !bilingual) {
    console.error("Usage: approve --note <id> [--note <id>…] --bilingual pending|approved|changes [--reviewer name] [--notes text]");
    process.exit(1);
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const id of ids) {
    const version = versions.get(id);
    if (!version) {
      console.error(`${id}: not a reference note`);
      process.exit(1);
    }
    const next = record.parse({
      version,
      bilingual,
      ...(one("--reviewer") ? { reviewer: one("--reviewer") } : {}),
      ...(one("--notes") ? { notes: one("--notes") } : {}),
      date: today,
    });
    ledger[id] = next;
    console.log(`${id} @ ${version}: ${next.bilingual}`);
  }
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, `${JSON.stringify(Object.fromEntries(Object.entries(ledger).sort(([a], [b]) => a.localeCompare(b))), null, 1)}\n`);
  fs.writeFileSync(OUT, compile().output);
  console.log("Updated content/reference/review.json and public/data/reference-reviewed.json.");
} else if (command === "build") {
  const { failures, output } = compile();
  if (failures.length) {
    console.error(`Reference note reviews failed:\n- ${failures.join("\n- ")}`);
    process.exit(1);
  }
  if (args.includes("--check")) {
    if (!fs.existsSync(OUT) || fs.readFileSync(OUT, "utf8") !== output) {
      console.error("public/data/reference-reviewed.json is out of date; run npm run content:notes -- build");
      process.exit(1);
    }
  } else fs.writeFileSync(OUT, output);
  const count = (JSON.parse(output) as { reviewed: string[] }).reviewed.length;
  console.log(`Reference notes OK: ${count} of ${notes.size} reviewed for their current content.`);
} else if (command === "status") {
  const only = one("--collection");
  const rows = COLLECTIONS.filter((collection) => !only || collection.prefix === only).map((collection) => {
    const ids = [...notes].filter(([, value]) => value.collection === collection.prefix).map(([id]) => id);
    return {
      name: `${collection.name} (${collection.prefix})`,
      notes: ids.length,
      approved: ids.filter((id) => current(id)?.bilingual === "approved").length,
      changes: ids.filter((id) => current(id)?.bilingual === "changes").length,
      stale: ids.filter((id) => ledger[id] && !current(id)).length,
      ids,
    };
  });
  const header = ["Collection", "Notes", "Approved", "Changes asked", "Stale approvals"];
  const table = [header, ...rows.map((row) => [row.name, row.notes, row.approved, row.changes, row.stale].map(String))];
  const widths = header.map((_, column) => Math.max(...table.map((line) => line[column]!.length)));
  for (const line of table) console.log(line.map((cell, column) => cell.padEnd(widths[column]!)).join("  "));
  const total = rows.reduce((sum, row) => ({ notes: sum.notes + row.notes, approved: sum.approved + row.approved }), { notes: 0, approved: 0 });
  console.log(`\n${total.approved} of ${total.notes} reference notes reviewed.`);
  if (only) {
    // Essential notes first: band 1 is what most learners meet.
    const waiting = rows[0]!.ids
      .filter((id) => current(id)?.bilingual !== "approved")
      .sort((a, b) => (notes.get(a)!.note.band ?? 9) - (notes.get(b)!.note.band ?? 9));
    if (waiting.length) console.log(`\nTo review next:\n${waiting.slice(0, 15).map((id) => `  ${id}`).join("\n")}`);
  }
} else {
  console.error("Commands: status (default), approve, build");
  process.exit(1);
}
