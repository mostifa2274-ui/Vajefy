import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs";
import { loadCurrentRightsAudit } from "./rights-lineage-audit";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  aggregateAssurance,
  generationManifest,
  machineAssuranceRecord,
  provenanceBlockers,
  provenanceManifest,
  type MachineAssuranceRecord,
} from "../src/lib/learn/assurance";
import type { Pilot } from "../src/lib/learn/content";
import { semanticInputHash, semanticStableJson, semanticTargetInput } from "./semantic-input";

/**
 * Machine Assurance Records (plan §17): one fail-closed record per A1 sense.
 *
 *   (no flag)  print the summary
 *   --write    regenerate content/assurance/records/A1.json
 *   --check    fail when the committed records differ from the content
 *
 * A record is bound to its sense's semantic input hash, the same hash judges
 * sign, so any content change produces a new record and drops earlier
 * evidence. Nothing without evidence passes: missing semantic judgments,
 * uncertified audio and unverified source rights are UNCERTAIN.
 */

type Criterion = MachineAssuranceRecord["criteria"][number];
type Finding = { code: string; where: string };

const ROOT = process.cwd();
const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const REGISTER = path.join(SCRIPTS, "ts-test-register.mjs");
const COMPILED = path.join(ROOT, "content", "compiled", "enhanced.json");
const CURRICULUM = path.join(ROOT, "content", "curriculum", "A1.json");
const PROVENANCE = path.join(ROOT, "content", "assurance", "provenance.json");
const GENERATION = path.join(ROOT, "content", "assurance", "generation.json");
const ENTRY_DIR = path.join(ROOT, "content", "pilot", "entries");
const SEMANTIC_DIR = path.join(ROOT, "content", "assurance", "semantic");
const AUDIO_REPORT = path.join(ROOT, "content", "pilot", "audio-report.json");
const OUTPUT = path.join(ROOT, "content", "assurance", "records", "A1.json");
const ROLES = ["english", "persian", "pedagogical", "adversarial"] as const;

/** Deterministic finding codes, grouped into the record's structure criteria. */
const GROUPS: Record<string, string[]> = {
  "structure.language-fields": [
    "PERSIAN_GLOSS",
    "PERSIAN_MEANING",
    "PERSIAN_GRAMMAR_NOTE",
    "PERSIAN_EXAMPLE",
    "PERSIAN_USAGE",
    "PERSIAN_MISTAKE_WRONG",
    "PERSIAN_MISTAKE_RIGHT",
    "PERSIAN_MISTAKE_WHY",
    "PERSIAN_CHECK_FEEDBACK",
    "PERSIAN_CHECK_FA",
    "PERSIAN_CHECK_PROMPT",
    "PERSIAN_IN_ENGLISH",
    "MALFORMED_UNICODE",
    "BIDI_CONTROL",
    "UNICODE_NOT_NFC",
  ],
  "structure.wrong-right": [
    "MISTAKE_WRONG_FA_MISSING",
    "MISTAKE_RIGHT_FA_MISSING",
    "MISTAKE_FA_IDENTICAL",
    "MISTAKE_EN_IDENTICAL",
  ],
  "structure.curriculum-frontier": ["FRONTIER_TASK_VOCABULARY"],
  "structure.examples": [
    "EXAMPLE_COUNT",
    "DUPLICATE_EXAMPLE_EN",
    "DUPLICATE_EXAMPLE_FA",
    "EXAMPLE_NEAR_DUPLICATE",
    "EXAMPLE_REUSED",
  ],
  "structure.usage": ["USAGE_REQUIRED"],
};

function read<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function runJson<T>(script: string, args: string[]): T {
  const result = spawnSync(
    process.execPath,
    ["--experimental-strip-types", "--no-warnings", "--import", REGISTER, path.join(SCRIPTS, script), ...args, "--json"],
    { cwd: ROOT, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
  );
  if (!result.stdout) {
    console.error(`${script} produced no JSON: ${result.stderr}`);
    process.exit(1);
  }
  return JSON.parse(result.stdout) as T;
}

const pilot = read<Pilot>(COMPILED);
const entries = pilot.entries.filter((entry) => entry.id.startsWith("lex:A1:"));
const unitOf = new Map<string, string>();
for (const unit of read<{ units: { id: string; entries: { id: string }[] }[] }>(CURRICULUM).units) {
  for (const item of unit.entries) unitOf.set(item.id, unit.id);
}

// Deterministic findings, by sense. A finding's location starts with its
// sense id, which never contains a dot.
const audit = runJson<{ details: Finding[] }>("content-assurance.ts", []);
const findingsBySense = new Map<string, Finding[]>();
for (const finding of audit.details) {
  const senseId = finding.where.split(".")[0];
  const list = findingsBySense.get(senseId) ?? [];
  list.push(finding);
  findingsBySense.set(senseId, list);
}
const grouped = new Set(Object.values(GROUPS).flat());
const ungrouped = [...new Set(audit.details.map((finding) => finding.code))].filter(
  (code) => !grouped.has(code) && !code.startsWith("FRONTIER_SCENE"),
);
if (ungrouped.length) {
  console.error(`Finding code(s) with no record criterion: ${ungrouped.join(", ")}. Add them to GROUPS.`);
  process.exit(1);
}
const auditVersion = sha256(fs.readFileSync(path.join(SCRIPTS, "content-assurance.ts"), "utf8")).slice(0, 12);

// Gate 0: every distributed source must be cleared.
const manifest = provenanceManifest.parse(read<unknown>(PROVENANCE));
const rightsBlockers = provenanceBlockers(manifest);
// A source-level licence can never clear items whose inherited lineage or
// exact content evidence has not been individually verified.
const itemRights = loadCurrentRightsAudit();
if (itemRights.structuralIssues.length) {
  throw new Error("A1 rights-lineage inventory is incomplete: " + itemRights.structuralIssues.slice(0, 10).join("; "));
}
if (itemRights.blockers.length && !rightsBlockers.length) {
  rightsBlockers.push("item-level-rights-unverified");
}

// Generation provenance: who or what made each source entry's current content.
const generation = fs.existsSync(GENERATION) ? generationManifest.parse(read<unknown>(GENERATION)) : null;
const sourceHash = new Map<string, string>();
for (const file of fs.readdirSync(ENTRY_DIR).filter((name) => name.endsWith(".json"))) {
  for (const entry of read<{ id: string }[]>(path.join(ENTRY_DIR, file))) {
    sourceHash.set(entry.id, sha256(semanticStableJson(entry)));
  }
}

function generationCriterion(entryId: string): Criterion {
  const record = generation?.entries[entryId];
  const generator = record ? generation?.generators[record.generator] : undefined;
  if (!record || !generator || record.outputHash !== sourceHash.get(entryId)) {
    return { criterion: "provenance.generation", result: "FAIL", evidence: [], reasonCode: "generation-unrecorded" };
  }
  return generator.kind === "unknown"
    ? { criterion: "provenance.generation", result: "UNCERTAIN", evidence: [record.generator], reasonCode: "generation-unknown" }
    : { criterion: "provenance.generation", result: "PASS", evidence: [record.generator], reasonCode: null };
}

// Semantic judgments, per unit with committed evidence.
const semanticByTarget = new Map<string, { status: Criterion["result"]; blockers: string[] }>();
const semanticFiles: Record<string, string> = {};
for (const unit of new Set(unitOf.values())) {
  const file = path.join(SEMANTIC_DIR, `${unit}.json`);
  if (!fs.existsSync(file)) continue;
  semanticFiles[path.relative(ROOT, file)] = sha256(fs.readFileSync(file, "utf8")).slice(0, 12);
  const report = runJson<{ targets: { targetId: string; status: Criterion["result"]; blockers: string[] }[] }>(
    "semantic-assurance.ts",
    ["--unit", unit],
  );
  for (const target of report.targets) semanticByTarget.set(target.targetId, target);
}

// Heuristic audio flags; certification (plan §12) does not exist yet.
const audioFlags = new Map<string, number>();
if (fs.existsSync(AUDIO_REPORT)) {
  for (const flag of read<{ flagged?: { sense: string; accent: string }[] }>(AUDIO_REPORT).flagged ?? []) {
    const key = `${flag.sense}|${flag.accent}`;
    audioFlags.set(key, (audioFlags.get(key) ?? 0) + 1);
  }
}

const derivedFrom = `content:${pilot.version}`;
const records: MachineAssuranceRecord[] = [];
for (const entry of entries) {
  const unit = unitOf.get(entry.id) ?? "unassigned";
  for (const sense of entry.senses) {
    const criteria: Criterion[] = [];
    criteria.push(
      rightsBlockers.length
        ? {
            criterion: "provenance.rights",
            result: "UNCERTAIN",
            evidence: ["content/assurance/provenance.json"],
            reasonCode: "gate0-unverified",
          }
        : {
            criterion: "provenance.rights",
            result: "PASS",
            evidence: [],
            reasonCode: null,
          },
    );
    criteria.push(generationCriterion(entry.id));
    criteria.push({
      criterion: "structure.schema",
      result: "PASS",
      evidence: ["content/compiled/enhanced.json"],
      reasonCode: null,
    });

    const findings = findingsBySense.get(sense.id) ?? [];
    for (const [criterion, codes] of Object.entries(GROUPS)) {
      const hits = findings.filter((finding) => codes.includes(finding.code));
      const counts = new Map<string, number>();
      for (const hit of hits) counts.set(hit.code, (counts.get(hit.code) ?? 0) + 1);
      criteria.push({
        criterion,
        result: hits.length ? "FAIL" : "PASS",
        evidence: [...counts].map(([code, count]) => `${code}:${count}`).sort(),
        reasonCode: hits.length ? [...counts.keys()].sort()[0] : null,
      });
    }

    const semantic = semanticByTarget.get(sense.id);
    for (const role of ROLES) {
      const roleBlockers = semantic?.blockers.filter((blocker) => blocker.includes(role)) ?? [];
      criteria.push(
        semantic
          ? {
              criterion: `semantic.${role}`,
              result: roleBlockers.length && semantic.status === "PASS" ? "UNCERTAIN" : semantic.status,
              evidence: roleBlockers,
              reasonCode: roleBlockers[0] ?? null,
            }
          : {
              criterion: `semantic.${role}`,
              result: "UNCERTAIN",
              evidence: [],
              reasonCode: "semantic-not-run",
            },
      );
    }

    for (const [accent, key] of [["en-GB", "gb"], ["en-US", "us"]] as const) {
      const clip = pilot.audio?.[sense.id]?.[key]?.word;
      const flags = audioFlags.get(`${sense.id}|${key}`) ?? 0;
      criteria.push({
        criterion: `audio.${accent}`,
        result: clip ? "UNCERTAIN" : "FAIL",
        evidence: flags ? [`heuristic-flags:${flags}`] : [],
        reasonCode: clip ? "audio-not-certified" : "audio-missing",
      });
    }

    const record = {
      schemaVersion: 1 as const,
      targetId: sense.id,
      contentVersion: entry.version,
      sourceHash: semanticInputHash(semanticTargetInput(entry, sense, unit)),
      generatedAt: derivedFrom,
      criteria,
      status: aggregateAssurance(criteria),
    };
    machineAssuranceRecord.parse(record);
    records.push({
      ...record,
      // Schema defaults (no evidence, no reason) are left out of the file.
      criteria: criteria.map(({ evidence, reasonCode, ...rest }) => ({
        ...rest,
        ...(evidence.length ? { evidence } : {}),
        ...(reasonCode ? { reasonCode } : {}),
      })) as Criterion[],
    });
  }
}

const byStatus: Record<string, number> = {};
for (const record of records) byStatus[record.status] = (byStatus[record.status] ?? 0) + 1;
const byCriterion: Record<string, Record<string, number>> = {};
for (const record of records) {
  for (const criterion of record.criteria) {
    const counts = (byCriterion[criterion.criterion] ??= {});
    counts[criterion.result] = (counts[criterion.result] ?? 0) + 1;
  }
}

const summary = {
  derivedFrom,
  // Who evaluates each criterion; semantic judges' models and prompt and
  // rubric versions are in the evidence each record's sourceHash binds to.
  evaluators: {
    "provenance.rights": { kind: "deterministic", id: "scripts/assurance-gate.ts", blockers: rightsBlockers },
    "provenance.generation": { kind: "deterministic", id: "scripts/generation-provenance.ts", manifest: "content/assurance/generation.json" },
    "structure.schema": { kind: "deterministic", id: "scripts/build-content.ts" },
    "structure.*": { kind: "deterministic", id: "scripts/content-assurance.ts", version: auditVersion },
    "semantic.*": { kind: "model", id: "scripts/semantic-assurance.ts", evidence: "content/assurance/semantic/<unit>.json" },
    "audio.*": { kind: "audio", id: "content/pilot/audio-report.json", version: "heuristic; certification not built (plan §12)" },
  },
  provenance: sha256(fs.readFileSync(PROVENANCE, "utf8")).slice(0, 12),
  semanticEvidence: semanticFiles,
  records: records.length,
  byStatus,
  byCriterion,
};

// One record per line keeps a content change to a one-line diff per sense.
const text = [
  "{",
  `  "schemaVersion": 1,`,
  `  "summary": ${JSON.stringify(summary)},`,
  `  "records": [`,
  records.map((record) => `    ${JSON.stringify(record)}`).join(",\n"),
  "  ]",
  "}",
  "",
].join("\n");

if (process.argv.includes("--write")) {
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  fs.writeFileSync(OUTPUT, text);
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify(summary, null, 2));
} else {
  console.log(
    `Machine assurance records: ${records.length} A1 sense(s); ${Object.entries(byStatus).map(([status, count]) => `${count} ${status}`).join(", ")}.`,
  );
}

if (process.argv.includes("--check")) {
  const committed = fs.existsSync(OUTPUT) ? fs.readFileSync(OUTPUT, "utf8") : "";
  if (committed !== text) {
    console.error(
      "content/assurance/records/A1.json does not match the content. Run: npm run assurance:records",
    );
    process.exit(1);
  }
}
