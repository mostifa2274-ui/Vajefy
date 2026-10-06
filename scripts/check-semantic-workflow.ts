import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WORKFLOW = path.join(ROOT, ".github", "workflows", "semantic-judge.yml");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(WORKFLOW)) {
  fail("Missing .github/workflows/semantic-judge.yml");
}

const text = fs.readFileSync(WORKFLOW, "utf8");

const required = [
  "workflow_dispatch:",
  "acknowledge_inference:",
  "if: ${{ inputs.acknowledge_inference }}",
  "permissions:\n  contents: read",
  "Apply verified zero-cost provider defaults",
  "No-inference role preflight",
  "Run isolated semantic judge",
  "Upload structured role evidence",
];

for (const marker of required) {
  if (!text.includes(marker)) {
    fail(`Semantic judge workflow safety marker missing: ${marker}`);
  }
}

const forbiddenTriggers = [
  /^\s*push\s*:/m,
  /^\s*pull_request\s*:/m,
  /^\s*pull_request_target\s*:/m,
  /^\s*schedule\s*:/m,
  /^\s*workflow_run\s*:/m,
];

for (const pattern of forbiddenTriggers) {
  if (pattern.test(text)) {
    fail(`Semantic judge workflow contains forbidden automatic trigger: ${pattern}`);
  }
}

if (/contents:\s*write/.test(text)) {
  fail("Semantic judge workflow must never have contents: write permission.");
}

if (!/retention-days:\s*30/.test(text)) {
  fail("Semantic judge evidence artifact retention must remain explicit.");
}

console.log(
  "Semantic judge workflow safety: PASS (manual dispatch only, explicit acknowledgement, read-only repository permission).",
);
