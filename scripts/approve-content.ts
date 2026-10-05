import fs from "node:fs";
import path from "node:path";
import { review } from "../src/lib/learn/content.ts";

/**
 * Record a real bilingual or pronunciation review for enhanced entries.
 *
 * Approved/changes decisions are provenance-sensitive: the reviewer must pass
 * the exact entry@version token shown by content:review-queue plus their name.
 * This prevents a person from accidentally approving content that changed
 * after they inspected it.
 *
 *   npm run content:review-queue
 *   npm run content:approve -- --entry lex:A1:bring@<version> --bilingual approved --reviewer "Name"
 *   npm run content:approve -- --entry lex:A1:close@<version> --pronunciation changes --reviewer "Name" --notes "…"
 *
 * --entry may repeat. Status values: pending, approved, changes.
 * Bare --entry ids are accepted only for pending/reset operations.
 */

const ROOT = process.cwd();
const PILOT = path.join(ROOT, "content", "compiled", "enhanced.json");
const LEDGER = path.join(ROOT, "content", "pilot", "review.json");

const args = process.argv.slice(2);
const values = (flag: string) =>
  args.flatMap((arg, index) =>
    arg === flag && args[index + 1] ? [args[index + 1]!] : [],
  );
const one = (flag: string) => values(flag)[0];

type Selector = {
  raw: string;
  id: string;
  expectedVersion?: string;
};

function parseSelector(raw: string): Selector {
  const at = raw.lastIndexOf("@");
  if (at <= 0 || at === raw.length - 1) return { raw, id: raw };
  return {
    raw,
    id: raw.slice(0, at),
    expectedVersion: raw.slice(at + 1),
  };
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const selectors = values("--entry").map(parseSelector);
const bilingual = one("--bilingual");
const pronunciation = one("--pronunciation");
const reviewer = one("--reviewer");
const notes = one("--notes");
const statuses = new Set(["pending", "approved", "changes"]);

if (!selectors.length || (!bilingual && !pronunciation)) {
  fail(
    "Usage: --entry <id[@version]> [--entry <id[@version]>…] [--bilingual status] [--pronunciation status] [--reviewer name] [--notes text]",
  );
}
if (bilingual && !statuses.has(bilingual)) {
  fail("--bilingual must be one of pending, approved, changes");
}
if (pronunciation && !statuses.has(pronunciation)) {
  fail("--pronunciation must be one of pending, approved, changes");
}

const decisions = [bilingual, pronunciation].filter(Boolean) as string[];
const recordsDecision = decisions.some(
  (status) => status === "approved" || status === "changes",
);
const requestsChanges = decisions.some((status) => status === "changes");

if (recordsDecision && !reviewer) {
  fail("approved/changes decisions require --reviewer <name>");
}
if (requestsChanges && !notes) {
  fail("a changes decision requires --notes explaining what must be corrected");
}

const duplicateIds = selectors
  .map((selector) => selector.id)
  .filter((id, index, all) => all.indexOf(id) !== index);
if (duplicateIds.length) {
  fail(
    `duplicate --entry id(s): ${[...new Set(duplicateIds)].join(", ")}`,
  );
}

const compiled = JSON.parse(fs.readFileSync(PILOT, "utf8")) as {
  entries: { id: string; version: string }[];
};
const versions = new Map(
  compiled.entries.map((entry) => [entry.id, entry.version]),
);

// Preflight every target before mutating the in-memory ledger. The file is
// written only after all selectors and provenance requirements are valid.
for (const selector of selectors) {
  const currentVersion = versions.get(selector.id);
  if (!currentVersion) {
    fail(
      `${selector.id}: not an enhanced entry (run npm run content:build first if it is new)`,
    );
  }
  if (recordsDecision && !selector.expectedVersion) {
    fail(
      `${selector.id}: approved/changes decisions require the exact entry@version token from npm run content:review-queue`,
    );
  }
  if (
    selector.expectedVersion &&
    selector.expectedVersion !== currentVersion
  ) {
    fail(
      `${selector.id}: reviewed version ${selector.expectedVersion} does not match current version ${currentVersion}; review the current entry before recording a decision`,
    );
  }
}

const ledger = fs.existsSync(LEDGER)
  ? (JSON.parse(fs.readFileSync(LEDGER, "utf8")) as Record<string, unknown>)
  : {};
const today = new Date().toISOString().slice(0, 10);

for (const selector of selectors) {
  const id = selector.id;
  const version = versions.get(id)!;
  const previous = review.safeParse(ledger[id]);
  // A record for an older version starts again from pending.
  const base =
    previous.success && previous.data.version === version
      ? previous.data
      : { version, bilingual: "pending", pronunciation: "pending" };
  const next = review.parse({
    ...base,
    version,
    ...(bilingual ? { bilingual } : {}),
    ...(pronunciation ? { pronunciation } : {}),
    ...(reviewer ? { reviewer } : {}),
    ...(notes ? { notes } : {}),
    date: today,
  });
  ledger[id] = next;
  console.log(
    `${id} @ ${version}: bilingual ${next.bilingual}, pronunciation ${next.pronunciation}`,
  );
}

fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
const sorted = Object.fromEntries(
  Object.entries(ledger).sort(([a], [b]) => a.localeCompare(b)),
);
fs.writeFileSync(LEDGER, `${JSON.stringify(sorted, null, 1)}\n`);
console.log(
  "Updated content/pilot/review.json; run npm run content:build to release approved entries.",
);
