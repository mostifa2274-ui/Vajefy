import fs from "node:fs";
import path from "node:path";
import { repairCatalog } from "../src/lib/learn/repair-loop";

/**
 * Plan §8 repair catalog must cover every deterministic finding code emitted
 * by the content compiler. A new code fails this check until it is classified
 * as regenerate, deterministic-normalize, or quarantine.
 *
 *   --check   exit non-zero if content-assurance.ts emits an unclassified code
 */

const ROOT = process.cwd();
const ASSURANCE = path.join(ROOT, "scripts", "content-assurance.ts");

function emittedCodes(source: string): string[] {
  const codes = new Set<string>();
  for (const match of source.matchAll(/add\(\s*"([A-Z0-9_]+)"/g)) {
    codes.add(match[1]);
  }
  for (const match of source.matchAll(/needsPersian\([\s\S]*?,\s*"([A-Z0-9_]+)"\s*,?\s*\)/g)) {
    codes.add(match[1]);
  }
  for (const match of source.matchAll(/checkTasks\(\s*"([A-Z0-9_]+)"/g)) {
    codes.add(match[1]);
  }
  return [...codes].sort();
}

const source = fs.readFileSync(ASSURANCE, "utf8");
const emitted = emittedCodes(source);
const catalog = repairCatalog();
const missing = emitted.filter((code) => catalog[code] === undefined);
const extra = Object.keys(catalog)
  .filter((code) => !emitted.includes(code))
  .sort();

if (missing.length || extra.length) {
  if (missing.length) console.error(`unclassified finding codes: ${missing.join(", ")}`);
  if (extra.length) console.error(`catalog codes not emitted by content-assurance: ${extra.join(", ")}`);
  process.exit(1);
}

console.log(
  `Repair loop catalog covers ${emitted.length} deterministic finding codes. No content was rewritten.`,
);
