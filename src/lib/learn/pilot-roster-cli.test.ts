import assert from "node:assert/strict";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "pilot-roster.ts");
const REGISTER = path.join(ROOT, "scripts", "ts-test-register.mjs");

function run(args: string[]) {
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--no-warnings",
      "--import",
      REGISTER,
      SCRIPT,
      ...args,
    ],
    { cwd: ROOT, encoding: "utf8" },
  );
}

test("pilot roster CLI generates and verifies a seed-fingerprinted balanced manifest", () => {
  const root = mkdtempSync(path.join(os.tmpdir(), "vajefy-pilot-roster-"));
  try {
    const participants = path.join(root, "participants.txt");
    writeFileSync(
      participants,
      ["P-001", "P-002", "P-003", "P-004"].join("\n") + "\n",
    );

    const generated = run([
      "--participants",
      participants,
      "--seed",
      "archived-secret-seed",
      "--enhanced-channel",
      "draft",
      "--minutes",
      "15",
    ]);
    assert.equal(generated.status, 0, generated.stderr);
    assert.doesNotMatch(generated.stdout, /archived-secret-seed/);

    const roster = JSON.parse(generated.stdout) as {
      kind: string;
      version: number;
      seedFingerprint: string;
      protocol: { dailyMinutes: number; enhancedChannel: string };
      assignments: { participant: string; arm: string; channel: string }[];
    };
    assert.equal(roster.kind, "vajefy-pilot-roster");
    assert.equal(roster.version, 1);
    assert.match(roster.seedFingerprint, /^[a-f0-9]{64}$/);
    assert.equal(roster.protocol.dailyMinutes, 15);
    assert.equal(roster.protocol.enhancedChannel, "draft");
    assert.equal(roster.assignments.length, 4);
    assert.equal(
      roster.assignments.filter((row) => row.arm === "enhanced").length,
      2,
    );
    assert.equal(
      roster.assignments.filter((row) => row.arm === "comparison").length,
      2,
    );

    const rosterFile = path.join(root, "roster.json");
    writeFileSync(rosterFile, generated.stdout);

    const checked = run([
      "--check",
      rosterFile,
      "--seed",
      "archived-secret-seed",
    ]);
    assert.equal(checked.status, 0, checked.stderr);
    assert.match(checked.stdout, /Pilot roster OK: 4 participants/);

    const wrongSeed = run([
      "--check",
      rosterFile,
      "--seed",
      "wrong-seed",
    ]);
    assert.notEqual(wrongSeed.status, 0);
    assert.match(wrongSeed.stderr, /does not match the roster fingerprint/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
