import fs from "node:fs";
import path from "node:path";
import {
  semanticEvidenceBundle,
  type SemanticJudgeRole,
} from "../src/lib/learn/assurance";

const ROOT = process.cwd();

type Packet = {
  schemaVersion: 1;
  unitId: string;
  generationContextKey: string;
  roles: { role: SemanticJudgeRole }[];
  targets: { targetId: string }[];
};

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

const targetIds = new Set(packet.targets.map((target) => target.targetId));
const roleOrder = new Map(
  packet.roles.map((role, index) => [role.role, index] as const),
);
const targetOrder = new Map(
  packet.targets.map((target, index) => [target.targetId, index] as const),
);

const judgments = [];
const seen = new Set<string>();

for (const runFile of runFiles) {
  const parsed = semanticEvidenceBundle.safeParse(read<unknown>(path.resolve(runFile)));
  if (!parsed.success) {
    fail(
      `${runFile} is not a valid semantic evidence bundle: ${parsed.error.issues
        .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
        .join("; ")}`,
    );
  }
  const bundle = parsed.data;
  if (bundle.unitId !== unitId) {
    fail(`${runFile} is for ${bundle.unitId}, expected ${unitId}.`);
  }
  if (bundle.generationContextKey !== packet.generationContextKey) {
    fail(`${runFile} was judged against a different source-generation context.`);
  }

  for (const judgment of bundle.judgments) {
    if (!targetIds.has(judgment.targetId)) {
      fail(`${runFile} contains unknown target ${judgment.targetId}.`);
    }
    if (!roleOrder.has(judgment.role)) {
      fail(`${runFile} contains unexpected role ${judgment.role}.`);
    }
    const key = `${judgment.targetId}|${judgment.role}`;
    if (seen.has(key)) {
      fail(`Duplicate semantic judgment for ${key} across run bundles.`);
    }
    seen.add(key);
    judgments.push(judgment);
  }
}

judgments.sort(
  (left, right) =>
    (targetOrder.get(left.targetId) ?? Number.MAX_SAFE_INTEGER) -
      (targetOrder.get(right.targetId) ?? Number.MAX_SAFE_INTEGER) ||
    (roleOrder.get(left.role) ?? Number.MAX_SAFE_INTEGER) -
      (roleOrder.get(right.role) ?? Number.MAX_SAFE_INTEGER),
);

if (process.argv.includes("--require-complete")) {
  const missing: string[] = [];
  for (const target of packet.targets) {
    for (const role of packet.roles) {
      const key = `${target.targetId}|${role.role}`;
      if (!seen.has(key)) missing.push(key);
    }
  }
  if (missing.length) {
    fail(
      `Cannot create complete semantic evidence: ${missing.length} target/role judgment(s) missing. First: ${missing
        .slice(0, 10)
        .join(", ")}`,
    );
  }
}

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
