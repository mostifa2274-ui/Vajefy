import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { Pilot } from "../src/lib/learn/content";
import {
  semanticRubricManifest,
  type SemanticJudgeRole,
} from "../src/lib/learn/assurance";
import {
  semanticInputHash,
  semanticStableJson,
  semanticTargetInput,
} from "./semantic-input";

const ROOT = process.cwd();
const COMPILED = path.join(ROOT, "content", "compiled", "enhanced.json");
const CURRICULUM = path.join(ROOT, "content", "curriculum", "A1.json");
const RUBRICS = path.join(ROOT, "content", "assurance", "semantic-rubrics.json");
const SEMANTIC = path.join(ROOT, "content", "assurance", "semantic");
const PROMPTS = path.join(SEMANTIC, "prompts");
const PACKETS = path.join(SEMANTIC, "packets");

type Curriculum = {
  units: { id: string; entries: { id: string }[] }[];
};

function read<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

function option(flag: string): string | undefined {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

function sha256Text(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const unitId = option("--unit") ?? "01-introductions";
const pilot = read<Pilot>(COMPILED);
const curriculum = read<Curriculum>(CURRICULUM);
const parsedRubrics = semanticRubricManifest.safeParse(read<unknown>(RUBRICS));
if (!parsedRubrics.success) {
  fail(
    `Invalid semantic rubric manifest: ${parsedRubrics.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ")}`,
  );
}
const rubrics = parsedRubrics.data;
const unit = curriculum.units.find((candidate) => candidate.id === unitId);
if (!unit) fail(`Unknown A1 unit: ${unitId}`);

const entryById = new Map(pilot.entries.map((entry) => [entry.id, entry]));
const selectedEntries = unit.entries.map(({ id }) => {
  const entry = entryById.get(id);
  if (!entry) fail(`${unitId}: missing compiled entry ${id}`);
  return entry;
});

const targets = selectedEntries.flatMap((entry) =>
  entry.senses.map((sense) => {
    const input = semanticTargetInput(entry, sense, unitId);
    return {
      targetId: sense.id,
      entryId: entry.id,
      contentVersion: entry.version,
      inputHash: semanticInputHash(input),
      input,
    };
  }),
);

const roles = rubrics.requiredRoles.map((role: SemanticJudgeRole) => {
  const rubric = rubrics.roles.find((candidate) => candidate.role === role);
  if (!rubric) fail(`Missing rubric for ${role}`);
  const promptFile = path.join(PROMPTS, `${rubric.promptVersion}.md`);
  if (!fs.existsSync(promptFile)) {
    fail(`Missing prompt file ${path.relative(ROOT, promptFile)}`);
  }
  const prompt = fs.readFileSync(promptFile, "utf8");
  return {
    role,
    promptVersion: rubric.promptVersion,
    rubricVersion: rubric.rubricVersion,
    criteria: rubric.criteria,
    promptFile: path.relative(ROOT, promptFile).replaceAll("\\", "/"),
    promptHash: sha256Text(prompt),
  };
});

const sourceStateHash = sha256Text(
  semanticStableJson(
    targets.map((target) => [
      target.targetId,
      target.contentVersion,
      target.inputHash,
    ]),
  ),
);

const packet = {
  schemaVersion: 1,
  unitId,
  // Packet identity is scoped to this unit's exact target inputs. A global
  // compiled-build version would invalidate unchanged Unit 1 evidence when
  // later curriculum units are merely reordered.
  generationContextKey: `source-content:${unitId}:${sourceStateHash.slice(0, 20)}`,
  rubricManifest: path.relative(ROOT, RUBRICS).replaceAll("\\", "/"),
  rubricManifestHash: sha256Text(fs.readFileSync(RUBRICS, "utf8")),
  roles,
  targets,
};

const output = `${JSON.stringify(packet, null, 2)}\n`;
const outFile = path.join(PACKETS, `${unitId}.json`);

if (process.argv.includes("--check")) {
  if (!fs.existsSync(outFile) || fs.readFileSync(outFile, "utf8") !== output) {
    fail(
      `${path.relative(ROOT, outFile)} is out of date; run semantic packet generation before judging content`,
    );
  }
} else {
  fs.mkdirSync(PACKETS, { recursive: true });
  fs.writeFileSync(outFile, output);
}

console.log(
  `Semantic judge packet OK: ${unitId}, ${selectedEntries.length} entries / ${targets.length} senses, ${roles.length} isolated judge roles, source ${sourceStateHash.slice(0, 12)}.`,
);
