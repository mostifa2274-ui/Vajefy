import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  generationManifest,
  HISTORICAL_GENERATOR,
  type GenerationManifest,
} from "../src/lib/learn/assurance";
import type { Entry } from "../src/lib/learn/content";
import { semanticStableJson } from "./semantic-input";

/**
 * Generation provenance (plan §18) for A1 source entries.
 *
 *   --check                     fail unless every entry's current content is recorded
 *   --record --generator <id>   record the changed entries as made by <id>
 *            [--entry <id> ...] limit the record to these entries
 *   --init                      create the manifest, recording existing content
 *                               as historical-unknown (only when none exists)
 *
 * Define a generator in content/assurance/generation.json before recording:
 * a model (provider, model id and version, prompt version, parameters), an
 * agent session, or a human editor. Unknown is only for content that existed
 * before provenance was kept.
 */

const ROOT = process.cwd();
const ENTRY_DIR = path.join(ROOT, "content", "pilot", "entries");
const FILE = path.join(ROOT, "content", "assurance", "generation.json");

function options(flag: string): string[] {
  return process.argv.flatMap((value, index) =>
    process.argv[index - 1] === flag ? [value] : [],
  );
}

function hash(entry: Entry): string {
  return createHash("sha256").update(semanticStableJson(entry)).digest("hex");
}

const entries = new Map<string, Entry>();
for (const file of fs.readdirSync(ENTRY_DIR).filter((name) => name.endsWith(".json")).sort()) {
  for (const entry of JSON.parse(fs.readFileSync(path.join(ENTRY_DIR, file), "utf8")) as Entry[]) {
    if (entry.id.startsWith("lex:A1:")) entries.set(entry.id, entry);
  }
}

function write(manifest: GenerationManifest) {
  const sorted = Object.fromEntries(Object.entries(manifest.entries).sort(([a], [b]) => a.localeCompare(b)));
  // One entry per line keeps a content change to a one-line diff.
  const lines = Object.entries(sorted).map(([id, record]) => `    ${JSON.stringify(id)}: ${JSON.stringify(record)}`);
  fs.writeFileSync(
    FILE,
    [
      "{",
      `  "schemaVersion": 1,`,
      `  "generators": ${JSON.stringify(manifest.generators, null, 2).replace(/\n/g, "\n  ")},`,
      `  "entries": {`,
      lines.join(",\n"),
      "  }",
      "}",
      "",
    ].join("\n"),
  );
}

const today = new Date().toISOString().slice(0, 10);

if (process.argv.includes("--init")) {
  if (fs.existsSync(FILE)) {
    console.error("content/assurance/generation.json already exists; --init only creates it.");
    process.exit(1);
  }
  write({
    schemaVersion: 1,
    generators: {
      [HISTORICAL_GENERATOR]: {
        kind: "unknown",
        note: "Authored before generation provenance was kept; the generator, prompt and parameters were not recorded.",
        contextKey: "source-authoring:historical-unknown",
      },
    },
    entries: Object.fromEntries(
      [...entries].map(([id, entry]) => [
        id,
        { generator: HISTORICAL_GENERATOR, recordedAt: today, sourceHash: null, outputHash: hash(entry) },
      ]),
    ),
  });
}

const parsed = generationManifest.safeParse(JSON.parse(fs.readFileSync(FILE, "utf8")));
if (!parsed.success) {
  console.error("content/assurance/generation.json is invalid:");
  for (const issue of parsed.error.issues) console.error(`- ${issue.path.join(".")}: ${issue.message}`);
  process.exit(1);
}
const manifest = parsed.data;

if (process.argv.includes("--record")) {
  const generator = options("--generator")[0];
  if (!generator || !manifest.generators[generator]) {
    console.error(`--record needs --generator <id> naming a generator in content/assurance/generation.json.`);
    process.exit(1);
  }
  if (manifest.generators[generator].kind === "unknown") {
    console.error("A change must name the model, agent session or person that made it, not an unknown generator.");
    process.exit(1);
  }
  const only = new Set(options("--entry"));
  let recorded = 0;
  for (const [id, entry] of entries) {
    if (only.size && !only.has(id)) continue;
    const current = hash(entry);
    const previous = manifest.entries[id];
    if (previous?.outputHash === current) continue;
    manifest.entries[id] = {
      generator,
      recordedAt: today,
      sourceHash: previous?.outputHash ?? null,
      outputHash: current,
    };
    recorded += 1;
  }
  for (const id of Object.keys(manifest.entries)) {
    if (!entries.has(id)) delete manifest.entries[id];
  }
  write(manifest);
  console.log(`Generation provenance: recorded ${recorded} changed entr${recorded === 1 ? "y" : "ies"} as ${generator}.`);
}

const problems: string[] = [];
for (const [id, entry] of entries) {
  const record = manifest.entries[id];
  if (!record) problems.push(`${id}: no generation record`);
  else if (record.outputHash !== hash(entry)) problems.push(`${id}: content changed since its generation record`);
}
for (const id of Object.keys(manifest.entries)) {
  if (!entries.has(id)) problems.push(`${id}: recorded but no longer an A1 entry`);
}

const byKind: Record<string, number> = {};
for (const record of Object.values(manifest.entries)) {
  const kind = manifest.generators[record.generator]?.kind ?? "missing";
  byKind[kind] = (byKind[kind] ?? 0) + 1;
}
console.log(
  `Generation provenance: ${entries.size} A1 entr${entries.size === 1 ? "y" : "ies"}; ${Object.entries(byKind).map(([kind, count]) => `${count} ${kind}`).join(", ")}.`,
);
for (const problem of problems.slice(0, 20)) console.error(`! ${problem}`);
if (problems.length > 20) console.error(`! ... and ${problems.length - 20} more`);
if (process.argv.includes("--check") && problems.length) {
  console.error(
    "Record who or what made the change: define the generator in content/assurance/generation.json, then run npm run content:provenance -- --generator <id>.",
  );
  process.exit(1);
}
