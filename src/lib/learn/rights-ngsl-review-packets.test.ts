import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

function packetCli(...args: string[]) {
  return spawnSync(
    process.execPath,
    [
      "--experimental-strip-types", "--no-warnings",
      "--import", "./scripts/ts-test-register.mjs",
      "scripts/rights/ngsl-review-packets.ts", ...args,
    ],
    { cwd: process.cwd(), encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
  );
}

test("source-pinned independent review packet never carries fabricated clearance", () => {
  const run = packetCli("--json", "--from", "241", "--limit", "1");
  assert.equal(run.status, 0, run.stderr);
  const result = JSON.parse(run.stdout);
  assert.equal(result.status, "STAGING_REVIEW_PACKETS_ONLY_NOT_PUBLIC_RELEASE");
  assert.equal(result.sourceCandidates, 900);
  assert.ok(result.authorOnlyDrafts >= 280);
  assert.equal(result.independentReviewPassed, 0);
  assert.equal(result.rightsCleared, 0);
  assert.equal(result.publicRelease, 0);
  assert.equal(result.packetCount, 1);
  const item = result.packets[0];
  assert.equal(item.source.selectionId, "ngsl:freq:0241");
  assert.equal(item.source.lemma, "lead");
  assert.equal(item.source.sourceRank, 241);
  assert.equal(item.source.license, "CC BY-SA 4.0");
  assert.match(item.draftSha256, /^[a-f0-9]{64}$/);
  assert.equal(item.explicitReleaseApproval, false);
  assert.deepEqual(Object.values(item.requiredIndependentReviews), [
    "PENDING", "PENDING", "PENDING", "PENDING", "PENDING",
  ]);
});

test("review-packet integrity mode refuses a partial window", () => {
  const run = packetCli("--check", "--from", "241", "--limit", "1");
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /Integrity --check must cover every staged independent lesson/);
});

test("review-packet exporter rejects nonpositive/out-of-range ranks", () => {
  const zero = packetCli("--json", "--from", "0", "--limit", "1");
  assert.notEqual(zero.status, 0);
  assert.match(zero.stderr, /--from expects a positive integer/);
  const missing = packetCli("--json", "--from", "901", "--limit", "1");
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /outside staged source ranks/);
});
