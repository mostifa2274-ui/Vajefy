import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  semanticJudgeRole,
  semanticRubricManifest,
  type SemanticJudgeRole,
} from "../src/lib/learn/assurance";
import { semanticInputHash, semanticStableJson } from "./semantic-input";

const ROOT = process.cwd();
const BASE = path.join(
  ROOT,
  "content",
  "assurance",
  "semantic",
  "calibration",
  "v1",
);
const CASES = path.join(BASE, "cases.json");
const PACKETS = path.join(BASE, "packets");
const RUBRICS = path.join(ROOT, "content", "assurance", "semantic-rubrics.json");
const PROMPTS = path.join(ROOT, "content", "assurance", "semantic", "prompts");

type CalibrationCase = {
  id: string;
  role: SemanticJudgeRole;
  sourceTargetId: string;
  target: Parameters<typeof semanticInputHash>[0];
};

type CasesFile = {
  schemaVersion: 1;
  calibrationVersion: string;
  cases: CalibrationCase[];
};

function read<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const casesFile = read<CasesFile>(CASES);
const rubricParsed = semanticRubricManifest.safeParse(read<unknown>(RUBRICS));
if (!rubricParsed.success) fail("Semantic rubric manifest is invalid.");
const rubrics = rubricParsed.data;

for (const role of semanticJudgeRole.options) {
  const cases = casesFile.cases.filter((item) => item.role === role);
  if (!cases.length) fail(`No calibration cases for ${role}`);

  const rubric = rubrics.roles.find((item) => item.role === role);
  if (!rubric) fail(`Missing semantic rubric for ${role}`);

  const promptFile = path.join(PROMPTS, `${rubric.promptVersion}.md`);
  if (!fs.existsSync(promptFile)) {
    fail(`Missing semantic prompt: ${path.relative(ROOT, promptFile)}`);
  }
  const promptText = fs.readFileSync(promptFile, "utf8");

  const targets = cases.map((item) => ({
    targetId: item.id,
    entryId: item.sourceTargetId,
    contentVersion: casesFile.calibrationVersion,
    inputHash: semanticInputHash(item.target),
    input: item.target,
  }));

  const sourceHash = hash(
    semanticStableJson(
      targets.map((target) => [target.targetId, target.inputHash]),
    ),
  );

  const packet = {
    schemaVersion: 1,
    unitId: `calibration:${casesFile.calibrationVersion}:${role}`,
    contentBuildVersion: casesFile.calibrationVersion,
    generationContextKey: `calibration:${casesFile.calibrationVersion}:${role}:${sourceHash.slice(0, 20)}`,
    rubricManifest: path.relative(ROOT, RUBRICS).replaceAll("\\", "/"),
    rubricManifestHash: hash(fs.readFileSync(RUBRICS, "utf8")),
    roles: [
      {
        role,
        promptVersion: rubric.promptVersion,
        rubricVersion: rubric.rubricVersion,
        criteria: rubric.criteria,
        promptFile: path.relative(ROOT, promptFile).replaceAll("\\", "/"),
        promptHash: hash(promptText),
      },
    ],
    targets,
  };

  const output = `${JSON.stringify(packet, null, 2)}\n`;
  const outFile = path.join(PACKETS, `${role}.json`);

  if (process.argv.includes("--check")) {
    if (!fs.existsSync(outFile) || fs.readFileSync(outFile, "utf8") !== output) {
      fail(
        `${path.relative(ROOT, outFile)} is out of date; rebuild frozen semantic calibration packets`,
      );
    }
  } else {
    fs.mkdirSync(PACKETS, { recursive: true });
    fs.writeFileSync(outFile, output);
  }

  console.log(
    `Calibration packet OK: ${role}, ${targets.length} target(s), source ${sourceHash.slice(0, 12)}.`,
  );
}
