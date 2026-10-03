import fs from "node:fs";
import path from "node:path";
import { review } from "../src/lib/learn/content.ts";

/**
 * Record a bilingual or pronunciation review for enhanced entries, at any
 * level. The record names the content version the reviewer saw, so any later
 * edit to the entry withdraws the approval until it is reviewed again.
 *
 *   npm run content:approve -- --entry lex:A1:bring --bilingual approved --reviewer "Name"
 *   npm run content:approve -- --entry lex:A1:close --pronunciation changes --notes "…"
 *
 * --entry may repeat. Status values: pending, approved, changes.
 */

const ROOT = process.cwd();
const PILOT = path.join(ROOT, "content", "compiled", "enhanced.json");
const LEDGER = path.join(ROOT, "content", "pilot", "review.json");

const args = process.argv.slice(2);
const values = (flag: string) => args.flatMap((arg, index) => (arg === flag && args[index + 1] ? [args[index + 1]!] : []));
const one = (flag: string) => values(flag)[0];

const entries = values("--entry");
const bilingual = one("--bilingual");
const pronunciation = one("--pronunciation");
if (!entries.length || (!bilingual && !pronunciation)) {
  console.error("Usage: --entry <id> [--entry <id>…] [--bilingual status] [--pronunciation status] [--reviewer name] [--notes text]");
  process.exit(1);
}

const compiled = JSON.parse(fs.readFileSync(PILOT, "utf8")) as { entries: { id: string; version: string }[] };
const versions = new Map(compiled.entries.map((entry) => [entry.id, entry.version]));
const ledger = fs.existsSync(LEDGER) ? (JSON.parse(fs.readFileSync(LEDGER, "utf8")) as Record<string, unknown>) : {};
const today = new Date().toISOString().slice(0, 10);

for (const id of entries) {
  const version = versions.get(id);
  if (!version) {
    console.error(`${id}: not an enhanced entry (run npm run content:build first if it is new)`);
    process.exit(1);
  }
  const previous = review.safeParse(ledger[id]);
  // A record for an older version starts again from pending.
  const base = previous.success && previous.data.version === version ? previous.data : { version, bilingual: "pending", pronunciation: "pending" };
  const next = review.parse({
    ...base,
    version,
    ...(bilingual ? { bilingual } : {}),
    ...(pronunciation ? { pronunciation } : {}),
    ...(one("--reviewer") ? { reviewer: one("--reviewer") } : {}),
    ...(one("--notes") ? { notes: one("--notes") } : {}),
    date: today,
  });
  ledger[id] = next;
  console.log(`${id} @ ${version}: bilingual ${next.bilingual}, pronunciation ${next.pronunciation}`);
}

const sorted = Object.fromEntries(Object.entries(ledger).sort(([a], [b]) => a.localeCompare(b)));
fs.writeFileSync(LEDGER, `${JSON.stringify(sorted, null, 1)}\n`);
console.log("Updated content/pilot/review.json; run npm run content:build to release approved entries.");
