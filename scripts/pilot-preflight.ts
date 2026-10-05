import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import type { Pilot, PilotSelectionProvenance } from "../src/lib/learn/content.ts";
import {
  evaluatePilotPreflight,
  type PilotPreflightPhase,
} from "../src/lib/learn/pilot-preflight.ts";
import type { PilotRoster } from "../src/lib/learn/pilot-roster.ts";
import { versionOf } from "./catalogue.ts";

const ROOT = process.cwd();
const COMPILED = path.join(ROOT, "content", "compiled", "enhanced.json");
const SELECTION = path.join(ROOT, "content", "pilot-a1.json");

function option(flag: string): string | undefined {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

function has(flag: string): boolean {
  return process.argv.includes(flag);
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function readJson<T>(file: string): T {
  if (!fs.existsSync(file)) fail(`file does not exist: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    fail(`invalid JSON: ${file}`);
  }
}

const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const validation = spawnSync(npm, ["run", "--silent", "validate:data"], {
  cwd: ROOT,
  encoding: "utf8",
});
if (validation.error) {
  fail(`could not run machine validation: ${validation.error.message}`);
}
if (validation.status !== 0) {
  if (validation.stdout.trim()) console.error(validation.stdout.trim());
  if (validation.stderr.trim()) console.error(validation.stderr.trim());
  fail("pilot preflight stopped because validate:data failed");
}

const phaseRaw = option("--phase");
if (phaseRaw !== "usability" && phaseRaw !== "learning") {
  fail(
    "Usage: npm run study:preflight -- --phase usability|learning [--roster pilot-roster.json] [--seed <private-seed>] [--json]",
  );
}
const phase = phaseRaw as PilotPreflightPhase;
const rosterPath = option("--roster");
const seed = option("--seed");
if (phase === "usability" && rosterPath) {
  fail("--roster is only used for --phase learning");
}
if (seed && !rosterPath) {
  fail("--seed requires --roster");
}

const pilot = readJson<Pilot>(COMPILED);
const selection = readJson<{
  version: number;
  level: string;
  entries: { id: string; group: string }[];
}>(SELECTION);

if (!Number.isInteger(selection.version) || selection.version < 1) {
  fail("content/pilot-a1.json must have a positive integer version");
}
if (selection.level !== "A1") {
  fail("content/pilot-a1.json must have level A1");
}
if (selection.entries.length !== 150) {
  fail(
    `content/pilot-a1.json must contain exactly 150 entries; found ${selection.entries.length}`,
  );
}
const duplicateSelectionIds = selection.entries
  .map((entry) => entry.id)
  .filter((id, index, all) => all.indexOf(id) !== index);
if (duplicateSelectionIds.length) {
  fail(
    `content/pilot-a1.json contains duplicate id(s): ${[
      ...new Set(duplicateSelectionIds),
    ].join(", ")}`,
  );
}

const expectedProvenance: PilotSelectionProvenance = {
  version: selection.version,
  level: "A1",
  entries: selection.entries.length,
  fingerprint: versionOf({
    version: selection.version,
    level: selection.level,
    entries: selection.entries.map(({ id, group }) => ({ id, group })),
  }),
};

let roster: PilotRoster | null = null;
if (rosterPath) {
  roster = readJson<PilotRoster>(path.resolve(ROOT, rosterPath));
}

const report = evaluatePilotPreflight({
  phase,
  pilot,
  selection: {
    ids: selection.entries.map((entry) => entry.id),
    provenance: expectedProvenance,
  },
  roster,
  ...(seed ? { seed } : {}),
});

if (has("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const s = report.summary;
  console.log(
    [
      `Pilot preflight — ${phase}`,
      `content ${report.generatedFrom.contentVersion}`,
      `selection ${report.generatedFrom.pilotSelection.entries} entries / ${report.generatedFrom.pilotSelection.fingerprint}`,
      `machine-ready ${s.machineReadyEntries}/${s.selectedEntries}`,
      `human-approved ${s.fullyApprovedEntries}/${s.selectedEntries}`,
      `released ${s.releasedEntries}/${s.selectedEntries}`,
      s.rosterParticipants == null
        ? "roster n/a"
        : `roster ${s.rosterParticipants} (enhanced ${s.enhancedRosterParticipants}; comparison ${s.comparisonRosterParticipants})`,
      report.ready ? "READY" : `BLOCKED: ${report.blockers.join("; ")}`,
    ].join("\n"),
  );
  if (report.nextActions.length) {
    console.log(`Next evidence actions: ${report.nextActions.join(", ")}`);
  }
}

if (!report.ready) process.exit(1);
