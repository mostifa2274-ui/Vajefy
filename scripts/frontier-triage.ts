import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { CheckItem, Entry, Scene } from "../src/lib/learn/content";
import {
  buildFrontierTriage,
  type FrontierTriageFinding,
} from "../src/lib/learn/frontier-triage";

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, "content", "pilot", "entries");
const curriculum = JSON.parse(
  fs.readFileSync(path.join(ROOT, "content", "curriculum", "A1.json"), "utf8"),
) as { units: { id: string; entries: { id: string }[] }[] };

const sourceChecks = new Map<string, readonly CheckItem[]>();
for (const file of fs.readdirSync(SOURCE).filter(file => file.endsWith(".json")).sort()) {
  const entries = JSON.parse(fs.readFileSync(path.join(SOURCE, file), "utf8")) as Entry[];
  for (const entry of entries) {
    for (const sense of entry.senses) {
      if (sourceChecks.has(sense.id)) throw new Error("Duplicate source sense: " + sense.id);
      sourceChecks.set(sense.id, sense.check);
    }
  }
}
const scenes = JSON.parse(
  fs.readFileSync(path.join(ROOT, "content", "pilot", "scenes.json"), "utf8"),
) as Scene[];
for (const scene of scenes) {
  if (sourceChecks.has(scene.id)) throw new Error("Duplicate scene: " + scene.id);
  sourceChecks.set(scene.id, scene.check);
}

const result = spawnSync(
  process.execPath,
  [
    "--experimental-strip-types",
    "--no-warnings",
    "--import",
    "./scripts/ts-test-register.mjs",
    "scripts/content-assurance.ts",
    "--json",
  ],
  { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
if (result.status !== 0) {
  throw new Error("Content assurance exited " + String(result.status) + ": " + result.stderr);
}
const assurance = JSON.parse(result.stdout) as {
  details: FrontierTriageFinding[];
  byCode: Record<string, number>;
};
const report = buildFrontierTriage(
  assurance.details,
  sourceChecks,
  curriculum.units.map(unit => ({
    id: unit.id,
    entryIds: unit.entries.map(entry => entry.id),
  })),
);

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    "A1 support-or-reword triage: " + report.total +
    " findings (" + report.frozenPilot + " frozen Units 1-3; " +
    report.glossCandidates + " structurally glossable; " +
    report.needsReview + " need rewording/review), across " +
    report.tokens.length + " tokens.",
  );
  for (const item of report.tokens.slice(0, 20)) {
    console.log(
      "- " + item.token + ": " + item.occurrences +
      " findings; " + item.glossCandidates + " gloss candidates; " +
      item.needsReview + " review; " + item.frozenPilot + " frozen",
    );
  }
  console.log("Use --json to inspect every exact task. These are not approved Persian translations.");
}
if (process.argv.includes("--check")) {
  const allFrontier =
    (assurance.byCode.FRONTIER_TASK_VOCABULARY ?? 0) +
    (assurance.byCode.FRONTIER_SCENE_VOCABULARY ?? 0);
  if (report.total > allFrontier) throw new Error("Triage exceeds the frontier finding count.");
}
