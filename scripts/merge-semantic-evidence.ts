import fs from "node:fs";
import path from "node:path";
import {
  semanticEvidenceBundle,
  type SemanticEvidenceBundle,
  type SemanticJudgeRole,
} from "../src/lib/learn/assurance";
import {
  validateSemanticEvidenceBundles,
  type SemanticPacketReference,
} from "../src/lib/learn/semantic-evidence";

const ROOT = process.cwd();

type Packet = SemanticPacketReference;

function option(flag: string): string | undefined {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

function options(flag: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < process.argv.length; index += 1) {
    if (process.argv[index] === flag && process.argv[index + 1]) {
      values.push(process.argv[index + 1]!);
    }
  }
  return values;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function read<T>(file: string): T {
  return JSON.parse(fs.readFileSync(file, "utf8")) as T;
}

const unitId = option("--unit") ?? "01-introductions";
const packetPath =
  option("--packet") ??
  path.join(
    ROOT,
    "content",
    "assurance",
    "semantic",
    "packets",
    `${unitId}.json`,
  );
const outputPath =
  option("--output") ??
  path.join(ROOT, "content", "assurance", "semantic", `${unitId}.json`);
const runFiles = options("--run");
if (!runFiles.length) {
  fail(
    "Provide independently generated role bundles with repeated --run <file> arguments.",
  );
}

const packet = read<Packet>(path.resolve(packetPath));
if (packet.schemaVersion !== 1 || packet.unitId !== unitId) {
  fail(`Semantic packet does not match requested unit ${unitId}.`);
}

const bundles: SemanticEvidenceBundle[] = [];

for (const runFile of runFiles) {
  const parsed = semanticEvidenceBundle.safeParse(read<unknown>(path.resolve(runFile)));
  if (!parsed.success) {
    fail(
      `${runFile} is not a valid semantic evidence bundle: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  bundles.push(parsed.data);
}

const validation = validateSemanticEvidenceBundles(
  packet,
  bundles,
  process.argv.includes("--require-complete"),
);
if (validation.problems.length) {
  fail(
    `Semantic evidence merge rejected:\n- ${validation.problems.join("\n- ")}${validation.missing.length ? `\nMissing examples: ${validation.missing.slice(0, 10).join(", ")}` : ""}`,
  );
}

const judgments = validation.judgments;
const roleOrder = new Map(
  packet.roles.map((role, index) => [role.role, index] as const),
);
const targetOrder = new Map(
  packet.targets.map((target, index) => [target.targetId, index] as const),
);

judgments.sort(
  (left, right) =>
    (targetOrder.get(left.targetId) ?? Number.MAX_SAFE_INTEGER) -
      (targetOrder.get(right.targetId) ?? Number.MAX_SAFE_INTEGER) ||
    (roleOrder.get(left.role) ?? Number.MAX_SAFE_INTEGER) -
      (roleOrder.get(right.role) ?? Number.MAX_SAFE_INTEGER),
);

const merged = semanticEvidenceBundle.parse({
  schemaVersion: 1,
  unitId,
  generationContextKey: packet.generationContextKey,
  judgments,
});

const fullOutput = path.resolve(outputPath);
fs.mkdirSync(path.dirname(fullOutput), { recursive: true });
fs.writeFileSync(fullOutput, `${JSON.stringify(merged, null, 2)}\n`);
console.log(
  `Merged semantic evidence: ${judgments.length} judgments from ${runFiles.length} isolated run bundle(s) -> ${fullOutput}.`,
);
