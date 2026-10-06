import fs from "node:fs";
import path from "node:path";

/**
 * Safety guard for the unattended calibration workflow. It may run on a
 * schedule only while content/assurance/semantic/automation.json authorizes
 * it, must plan before any inference, must stay inside the free allocation,
 * and may commit only the automation's own records.
 */

const ROOT = process.cwd();
const WORKFLOW = path.join(ROOT, ".github", "workflows", "semantic-calibrate.yml");
const AUTOMATION = path.join(ROOT, "content", "assurance", "semantic", "automation.json");
const COMMIT = path.join(ROOT, "scripts", "semantic-calibration-commit.sh");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

if (!fs.existsSync(WORKFLOW)) fail("Missing .github/workflows/semantic-calibrate.yml");
if (!fs.existsSync(COMMIT)) fail("Missing scripts/semantic-calibration-commit.sh");
const text = fs.readFileSync(WORKFLOW, "utf8");
const commit = fs.readFileSync(COMMIT, "utf8");
const automation = JSON.parse(fs.readFileSync(AUTOMATION, "utf8")) as {
  enabled: boolean;
  schedule: string;
  freeAllocationOnly: boolean;
};

// Triggers: the schedule named in automation.json and manual dispatch only.
const on = /^on:\n((?:[ ]{2}.*\n|\n)*)/m.exec(text)?.[1] ?? "";
const triggers = [...on.matchAll(/^ {2}([a-z_]+):/gm)].map((match) => match[1]);
const allowedTriggers = automation.enabled ? ["schedule", "workflow_dispatch"] : ["workflow_dispatch"];
for (const trigger of triggers) {
  if (!allowedTriggers.includes(trigger!)) {
    fail(`Semantic calibration workflow has a forbidden trigger: ${trigger}`);
  }
}
if (!triggers.includes("workflow_dispatch")) fail("Semantic calibration workflow must keep workflow_dispatch.");
const crons = [...on.matchAll(/cron:\s*"([^"]+)"/g)].map((match) => match[1]);
if (triggers.includes("schedule") && (crons.length !== 1 || crons[0] !== automation.schedule)) {
  fail(`The calibration schedule must be exactly automation.json's "${automation.schedule}".`);
}
if (!automation.freeAllocationOnly) fail("Calibration automation must stay on the free allocation.");

const required = [
  "permissions:\n  contents: write\n  id-token: write\n",
  "group: semantic-calibration\n  cancel-in-progress: false",
  "if: ${{ github.ref == 'refs/heads/main' }}",
  "SEMANTIC_JUDGE_TRANSPORT: keyless",
  "assurance:semantic:automation -- plan",
  "assurance:semantic:rates:refresh",
  "assurance:semantic:budget:current",
  "assurance:semantic:keyless:preflight",
  "for REPEAT in 1 2 3;",
  "--attempt-output",
  "assurance:semantic:automation -- reserve",
  "assurance:semantic:automation -- record",
  "scripts/semantic-calibration-commit.sh",
  "retention-days: 30",
];
for (const marker of required) {
  if (!text.includes(marker)) fail(`Semantic calibration workflow safety marker missing: ${marker}`);
}

// Planning, rates and budget come before the gateway preflight. The campaign
// is reserved and pushed to main before inference; recording follows it.
const order = [
  "assurance:semantic:automation -- plan",
  "assurance:semantic:rates:refresh",
  "assurance:semantic:budget:current",
  "assurance:semantic:keyless:preflight",
  "assurance:semantic:automation -- reserve",
  "scripts/semantic-calibration-commit.sh",
  "assurance:semantic:judge",
  "assurance:semantic:automation -- record",
  "scripts/semantic-calibration-commit.sh",
];
let previous = -1;
for (const marker of order) {
  const at = text.indexOf(marker, previous + 1);
  if (at < 0 || at < previous) fail(`Semantic calibration workflow steps are out of order at: ${marker}`);
  previous = at;
}
// Inference runs only for the planner's choice.
const judgeStep = text.slice(text.lastIndexOf("- name:", text.indexOf("assurance:semantic:judge")), text.indexOf("assurance:semantic:judge"));
if (!judgeStep.includes("if: ${{ steps.plan.outputs.action == 'calibrate' }}")) {
  fail("Calibration inference must run only when the planner chose a campaign.");
}
if (!judgeStep.includes("ROLE: ${{ steps.plan.outputs.role }}")) {
  fail("Calibration inference must use the planner's role.");
}
if (/inputs\.role\b(?![^\n]*\|\| 'auto')/.test(text)) {
  fail("The dispatched role may only reach the planner, never inference directly.");
}

if (/secrets\./.test(text)) fail("Semantic calibration workflow must not use repository secrets.");
for (const [name, source] of [["workflow", text], ["commit script", commit]] as const) {
  if (/git add\s+(-A|--all|\.)(\s|$)/m.test(source)) {
    fail(`Semantic calibration ${name} must never stage the repository broadly.`);
  }
  if (/push\s+(-f|--force)/.test(source)) fail(`Semantic calibration ${name} must never force-push.`);
}
if (/git (commit|push)/.test(text)) {
  fail("The calibration workflow commits only through scripts/semantic-calibration-commit.sh.");
}
for (const marker of [
  "npm run -s assurance:semantic:automation:check",
  "npm run -s assurance:semantic:budget:check",
  "npm run -s assurance:semantic:keyless:check",
  "npm run -s assurance:semantic:qualification:check",
  'git diff --name-only)" ]',
  "git push origin HEAD:main",
]) {
  if (!commit.includes(marker)) fail(`Calibration commit script safety marker missing: ${marker}`);
}
const allowlist = [
  "content/assurance/semantic/keyless-provider-presets.json",
  "content/assurance/semantic/workers-ai-neuron-rates.json",
  "content/assurance/semantic/calibration/v1/neuron-budget.json",
  "content/assurance/semantic/calibration/qualified.json",
  "content/assurance/semantic/calibration/rejected.json",
  "content/assurance/semantic/calibration/automation-log.json",
  '"content/assurance/semantic/calibration/results/${ROLE}.json"',
];
const block = /ALLOWED=\(\n([\s\S]*?)\n\s*\)/.exec(commit)?.[1] ?? "";
const staged = block.split("\n").map((line) => line.trim()).filter(Boolean);
if (JSON.stringify(staged) !== JSON.stringify(allowlist)) {
  fail("The calibration commit allowlist changed; only automation records may be committed.");
}

console.log(
  `Semantic calibration workflow safety: PASS (${automation.enabled ? `scheduled "${automation.schedule}" + manual` : "manual only"}; planner-gated free-allocation inference; allowlisted commits).`,
);
