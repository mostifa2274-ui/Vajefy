import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
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

const sourcePrefix = "content/rights-staging/ngsl-1.2";
function sourceFixture(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vajefy-ngsl-source-"));
  fs.mkdirSync(path.join(root, sourcePrefix), { recursive: true });
  for (const file of [
    "core.csv", "CC-BY-SA-4.0-LICENSE.txt",
    "independent-first-900-selection.json", "independent-first-20-drafts.json",
  ]) {
    fs.copyFileSync(path.join(process.cwd(), sourcePrefix, file), path.join(root, sourcePrefix, file));
  }
  return root;
}

function isolatedCli(root: string, script: string, ...args: string[]) {
  return spawnSync(process.execPath, [
    "--experimental-strip-types", "--no-warnings",
    "--import", path.join(process.cwd(), "scripts/ts-test-register.mjs"),
    path.join(process.cwd(), "scripts/rights", script), ...args,
  ], { cwd: root, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
}

test("standalone packet export verifies source and licence bytes before producing evidence", t => {
  const root = sourceFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const intact = isolatedCli(root, "ngsl-review-packets.ts", "--json", "--limit", "1");
  assert.equal(intact.status, 0, intact.stderr);
  for (const file of ["core.csv", "CC-BY-SA-4.0-LICENSE.txt"]) {
    const target = path.join(root, sourcePrefix, file);
    const original = fs.readFileSync(target);
    fs.appendFileSync(target, "\nchanged upstream bytes\n");
    for (const script of [
      "ngsl-review-packets.ts", "check-independent-ngsl-drafts.ts",
      "independent-ngsl-a1-selection.ts",
    ]) {
      const run = isolatedCli(root, script, "--json");
      assert.notEqual(run.status, 0, script + " accepted a changed " + file);
      assert.match(run.stderr, /Pinned upstream NGSL file changed/);
      assert.equal(run.stdout, "", "no packet or success output may precede source validation");
    }
    fs.writeFileSync(target, original);
  }
});

test("self-consistent forged selection and draft cannot authenticate each other", t => {
  const root = sourceFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const selectionPath = path.join(root, sourcePrefix, "independent-first-900-selection.json");
  const batchPath = path.join(root, sourcePrefix, "independent-first-20-drafts.json");
  const selection = JSON.parse(fs.readFileSync(selectionPath, "utf8"));
  const batch = JSON.parse(fs.readFileSync(batchPath, "utf8"));
  selection.entries[0].lemma = "forged-source-lemma";
  batch.lessons[0].lemma = "forged-source-lemma";
  fs.writeFileSync(selectionPath, JSON.stringify(selection, null, 2) + "\n");
  fs.writeFileSync(batchPath, JSON.stringify(batch, null, 2) + "\n");
  const run = isolatedCli(root, "ngsl-review-packets.ts", "--json");
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /selection is stale or implies false approval/);
  assert.equal(run.stdout, "");
});

test("packet source references cannot be replaced with manifest-supplied pins", t => {
  const root = sourceFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const selectionPath = path.join(root, sourcePrefix, "independent-first-900-selection.json");
  const original = fs.readFileSync(selectionPath, "utf8");
  for (const field of ["coreGitBlobSha", "licenseGitBlobSha", "upstreamUrl", "licensePath"]) {
    const selection = JSON.parse(original);
    selection.source[field] = "forged-reference";
    fs.writeFileSync(selectionPath, JSON.stringify(selection, null, 2) + "\n");
    const run = isolatedCli(root, "ngsl-review-packets.ts", "--json");
    assert.notEqual(run.status, 0, "accepted forged " + field);
    assert.match(run.stderr, /selection is stale or implies false approval/);
    assert.equal(run.stdout, "");
  }
});
