import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const WORKFLOW = path.join(
  ROOT,
  ".github",
  "workflows",
  "semantic-calibrate.yml",
);

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(WORKFLOW)) {
  fail("Missing .github/workflows/semantic-calibrate.yml");
}

const text = fs.readFileSync(WORKFLOW, "utf8");

const required = [
  "workflow_dispatch:",
  "acknowledge_inference:",
  "github.ref == 'refs/heads/main'",
  "permissions:\n  contents: write\n  id-token: write",
  "SEMANTIC_JUDGE_TRANSPORT: keyless",
  "Keyless no-inference gateway preflight",
  "Run three isolated calibration repeats",
  "Score against pre-registered Vajefy gate",
  "--require-promote",
  "--output \"calibration-report-${ROLE}.json\"",
  "Record qualification only after strict promotion",
  "assurance:semantic:qualification:record",
  "assurance:semantic:qualification:check",
  "Verify only qualification artifacts changed",
  "content/assurance/semantic/calibration/qualified.json",
  "content/assurance/semantic/calibration/results/",
  "git push origin HEAD:main",
  "retention-days: 30",
];

for (const marker of required) {
  if (!text.includes(marker)) {
    fail(`Semantic calibration workflow safety marker missing: ${marker}`);
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
    fail(
      `Semantic calibration workflow contains forbidden automatic trigger: ${pattern}`,
    );
  }
}

if (/secrets\.SEMANTIC_JUDGE_|SEMANTIC_JUDGE_.*API_KEY/.test(text)) {
  fail("Semantic calibration workflow must not reference semantic API-key secrets.");
}

if (!/for REPEAT in 1 2 3;/.test(text)) {
  fail("Semantic calibration workflow must run exactly the three v1 repeats.");
}

if (!/git add content\/assurance\/semantic\/calibration\/qualified\.json/.test(text)) {
  fail("Qualification ledger must be explicitly staged.");
}

if (
  !/git add "content\/assurance\/semantic\/calibration\/results\/\$\{ROLE\}\.json"/.test(
    text,
  )
) {
  fail("Role calibration report must be explicitly staged.");
}

if (/git add\s+[-.]A|git add\s+\./.test(text)) {
  fail("Semantic calibration workflow must never stage the repository broadly.");
}

console.log(
  "Semantic calibration workflow safety: PASS (manual-only, explicit inference acknowledgement, strict promotion, allowlisted writes).",
);
