import fs from "node:fs";
import path from "node:path";
import type { Pilot } from "../src/lib/learn/content.ts";
import {
  createPilotRoster,
  pilotRosterSeedFingerprint,
  validatePilotRoster,
  type PilotRoster,
} from "../src/lib/learn/pilot-roster.ts";

const ROOT = process.cwd();
const COMPILED = path.join(ROOT, "content", "compiled", "enhanced.json");

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

function readParticipants(file: string): string[] {
  if (!fs.existsSync(file)) fail(`participant-code file does not exist: ${file}`);
  const raw = fs.readFileSync(file, "utf8").trim();
  if (!raw) return [];
  if (raw.startsWith("[")) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      fail(`participant-code JSON is invalid: ${file}`);
    }
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== "string")) {
      fail("participant-code JSON must be an array of strings");
    }
    return parsed;
  }
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
}

function readRoster(file: string): PilotRoster {
  if (!fs.existsSync(file)) fail(`roster file does not exist: ${file}`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as PilotRoster;
  } catch {
    fail(`roster JSON is invalid: ${file}`);
  }
}

function printSummary(roster: PilotRoster): void {
  const enhanced = roster.assignments.filter(
    (assignment) => assignment.arm === "enhanced",
  ).length;
  const comparison = roster.assignments.length - enhanced;
  console.log(
    [
      `Pilot roster OK: ${roster.assignments.length} participants`,
      `${enhanced} enhanced / ${comparison} comparison`,
      `content ${roster.protocol.contentVersion}`,
      `enhanced channel ${roster.protocol.enhancedChannel}`,
      `${roster.protocol.dailyMinutes} minutes/day`,
      `seed fingerprint ${roster.seedFingerprint}`,
    ].join("; "),
  );
}

const checkFile = option("--check");
if (checkFile) {
  const roster = readRoster(checkFile);
  const seed = option("--seed");
  const errors = validatePilotRoster(roster, seed);
  if (errors.length) {
    fail(
      [
        "Pilot roster validation failed:",
        ...errors.map((error) => `- ${error}`),
      ].join("\n"),
    );
  }
  printSummary(roster);
  process.exit(0);
}

const participantFile = option("--participants");
const seed = option("--seed");
const enhancedChannel = option("--enhanced-channel");
const minutesRaw = option("--minutes");
const output = option("--out");

if (!participantFile || !seed || !enhancedChannel || !minutesRaw) {
  fail(
    [
      "Usage:",
      "  npm run study:roster -- --participants codes.txt --seed <secret> --enhanced-channel draft|released --minutes <n> [--out roster.json]",
      "  npm run study:roster -- --check roster.json [--seed <secret>]",
    ].join("\n"),
  );
}
if (enhancedChannel !== "draft" && enhancedChannel !== "released") {
  fail("--enhanced-channel must be draft or released");
}
const dailyMinutes = Number(minutesRaw);
if (!Number.isInteger(dailyMinutes)) fail("--minutes must be an integer");

const pilot = JSON.parse(fs.readFileSync(COMPILED, "utf8")) as Pilot;
if (!pilot.version) fail("compiled enhanced content has no version");

let roster: PilotRoster;
try {
  roster = createPilotRoster({
    participants: readParticipants(participantFile),
    seed,
    contentVersion: pilot.version,
    enhancedChannel,
    dailyMinutes,
  });
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const errors = validatePilotRoster(roster, seed);
if (errors.length) {
  fail(
    [
      "Generated pilot roster is invalid:",
      ...errors.map((error) => `- ${error}`),
    ].join("\n"),
  );
}

const json = `${JSON.stringify(roster, null, 2)}\n`;
if (output) {
  fs.writeFileSync(output, json);
  console.log(`Wrote ${output}`);
  printSummary(roster);
} else {
  process.stdout.write(json);
}

if (has("--fingerprint-only")) {
  console.error(
    `Seed fingerprint: ${pilotRosterSeedFingerprint(seed)}`,
  );
}
