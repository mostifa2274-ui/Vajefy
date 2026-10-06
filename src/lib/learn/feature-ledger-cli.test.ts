import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "feature-ledger.ts");
const REGISTER = path.join(ROOT, "scripts", "ts-test-register.mjs");

function run(rows: string[], routes: string[]) {
  const dir = mkdtempSync(path.join(tmpdir(), "vajefy-features-"));
  try {
    mkdirSync(path.join(dir, "docs"));
    mkdirSync(path.join(dir, "src", "routes"), { recursive: true });
    for (const route of ["__root.tsx", ...routes]) writeFileSync(path.join(dir, "src", "routes", route), "");
    writeFileSync(
      path.join(dir, "docs", "FEATURES.md"),
      [
        "<!-- feature-ledger:start -->",
        "| Feature | Paths | Learning purpose | Success measure | Remove or redesign if | Depends on | Last review | Status |",
        "|---|---|---|---|---|---|---|---|",
        ...rows,
        "<!-- feature-ledger:end -->",
      ].join("\n"),
    );
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings", "--import", REGISTER, SCRIPT, "--check"],
      { cwd: dir, encoding: "utf8" },
    );
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

const today = "| Today | `src/routes/index.tsx` | Next action | Plans finished | No better than Learn | Planner | 2026-10-06 | ACTIVE |";

test("a complete ledger covering every screen passes", () => {
  const { status, output } = run([today], ["index.tsx"]);
  assert.equal(status, 0, output);
  assert.match(output, /1 feature\(s\): 1 ACTIVE; 1 screen\(s\) covered/);
});

test("uncovered screens, missing paths, empty fields and unknown statuses fail", () => {
  const { status, output } = run(
    [
      today,
      "| Sprint | `src/components/sprint-run.tsx` | Speed | — |  | None | 2026-13-40 | RETIRED |",
    ],
    ["index.tsx", "drill.tsx"],
  );
  assert.equal(status, 1);
  assert.match(output, /Sprint: path does not exist: src\/components\/sprint-run.tsx/);
  assert.match(output, /Sprint: Remove or redesign if is empty/);
  assert.match(output, /Sprint: last review "2026-13-40" is not a YYYY-MM-DD date/);
  assert.match(output, /Sprint: status "RETIRED" is not one of ACTIVE, FROZEN, OFF/);
  assert.match(output, /screen src\/routes\/drill.tsx belongs to no feature/);
});
