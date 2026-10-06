import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "check-semantic-calibrate-workflow.ts");
const REGISTER = path.join(ROOT, "scripts", "ts-test-register.mjs");
const WORKFLOW = path.join(".github", "workflows", "semantic-calibrate.yml");
const COMMIT = path.join("scripts", "semantic-calibration-commit.sh");
const AUTOMATION = path.join("content", "assurance", "semantic", "automation.json");

function check(edit: { workflow?: (text: string) => string; commit?: (text: string) => string; enabled?: boolean }) {
  const dir = mkdtempSync(path.join(tmpdir(), "vajefy-calibrate-guard-"));
  try {
    for (const file of [WORKFLOW, COMMIT, AUTOMATION]) {
      mkdirSync(path.join(dir, path.dirname(file)), { recursive: true });
      cpSync(path.join(ROOT, file), path.join(dir, file));
    }
    const write = (file: string, change?: (text: string) => string) => {
      if (change) writeFileSync(path.join(dir, file), change(readFileSync(path.join(dir, file), "utf8")));
    };
    write(WORKFLOW, edit.workflow);
    write(COMMIT, edit.commit);
    if (edit.enabled === false) {
      write(AUTOMATION, (text) => text.replace('"enabled": true', '"enabled": false'));
    }
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings", "--import", REGISTER, SCRIPT],
      { cwd: dir, encoding: "utf8" },
    );
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("the committed calibration workflow passes its guard", () => {
  const result = check({});
  assert.equal(result.status, 0, result.output);
});

test("the guard rejects other triggers, a schedule the owner did not authorize, and a changed cron", () => {
  assert.match(check({ workflow: (text) => text.replace("on:\n", "on:\n  push:\n    branches: [main]\n") }).output, /forbidden trigger: push/);
  assert.match(check({ workflow: (text) => text.replace("on:\n", "on:\n  repository_dispatch:\n") }).output, /forbidden trigger: repository_dispatch/);
  assert.match(check({ enabled: false }).output, /forbidden trigger: schedule/);
  assert.match(check({ workflow: (text) => text.replace('"17 */6 * * *"', '"*/5 * * * *"') }).output, /calibration schedule must be exactly/);
});

test("the guard requires the reservation before inference and allowlisted commits", () => {
  const noReserve = check({
    workflow: (text) => text.replace("npm run assurance:semantic:automation -- reserve", "echo skip-reserve"),
  });
  assert.equal(noReserve.status, 1);
  assert.match(noReserve.output, /marker missing: assurance:semantic:automation -- reserve/);

  const broad = check({ commit: (text) => text.replace('git add -- "$FILE"', "git add -A") });
  assert.match(broad.output, /never stage the repository broadly/);

  const widened = check({
    commit: (text) => text.replace("  content/assurance/semantic/calibration/rejected.json\n", "  content/assurance/semantic/calibration/rejected.json\n  content/pilot/entries\n"),
  });
  assert.match(widened.output, /commit allowlist changed/);

  const direct = check({ workflow: (text) => text.replace("          scripts/semantic-calibration-commit.sh \"$ROLE\" \\\n            \"Semantic calibration: ${ROLE:-rates}", "          git push origin HEAD:main\n          scripts/semantic-calibration-commit.sh \"$ROLE\" \\\n            \"Semantic calibration: ${ROLE:-rates}") });
  assert.match(direct.output, /commits only through scripts\/semantic-calibration-commit.sh/);

  const secrets = check({ workflow: (text) => text.replace("SEMANTIC_JUDGE_TRANSPORT: keyless", "SEMANTIC_JUDGE_TRANSPORT: keyless\n      KEY: ${{ secrets.SOME_KEY }}") });
  assert.match(secrets.output, /must not use repository secrets/);
});
