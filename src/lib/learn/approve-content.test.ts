import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "approve-content.ts");
const REGISTER = path.join(ROOT, "scripts", "ts-test-register.mjs");
const ENTRY = "lex:A1:review-me";
const VERSION = "version-a";
const LEDGER = path.join("content", "pilot", "review.json");

function writeJson(root: string, relative: string, value: unknown): void {
  const target = path.join(root, relative);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(value, null, 2)}\n`);
}

function fixture(): string {
  const root = mkdtempSync(path.join(tmpdir(), "vajefy-approve-content-"));
  writeJson(root, "content/compiled/enhanced.json", {
    entries: [{ id: ENTRY, version: VERSION }],
  });
  mkdirSync(path.join(root, "content", "pilot"), { recursive: true });
  return root;
}

function run(root: string, args: string[]) {
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
    { cwd: root, encoding: "utf8" },
  );
}

function ledgerExists(root: string): boolean {
  return existsSync(path.join(root, LEDGER));
}

function readLedger(root: string): Record<string, Record<string, string>> {
  return JSON.parse(readFileSync(path.join(root, LEDGER), "utf8")) as Record<
    string,
    Record<string, string>
  >;
}

test("an approval cannot be recorded from a bare entry id", () => {
  const root = fixture();
  try {
    const result = run(root, [
      "--entry",
      ENTRY,
      "--bilingual",
      "approved",
      "--reviewer",
      "Reviewer",
    ]);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /require the exact entry@version token from npm run content:review-queue/,
    );
    assert.equal(ledgerExists(root), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("approved and changes decisions require an explicit reviewer", () => {
  const root = fixture();
  try {
    const result = run(root, [
      "--entry",
      `${ENTRY}@${VERSION}`,
      "--pronunciation",
      "approved",
    ]);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /approved\/changes decisions require --reviewer <name>/,
    );
    assert.equal(ledgerExists(root), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a changes decision requires actionable notes", () => {
  const root = fixture();
  try {
    const result = run(root, [
      "--entry",
      `${ENTRY}@${VERSION}`,
      "--bilingual",
      "changes",
      "--reviewer",
      "Reviewer",
    ]);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /a changes decision requires --notes explaining what must be corrected/,
    );
    assert.equal(ledgerExists(root), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a stale review token fails atomically before the ledger is written", () => {
  const root = fixture();
  try {
    const result = run(root, [
      "--entry",
      `${ENTRY}@older-version`,
      "--bilingual",
      "approved",
      "--reviewer",
      "Reviewer",
    ]);
    assert.notEqual(result.status, 0);
    assert.match(
      result.stderr,
      /reviewed version older-version does not match current version version-a/,
    );
    assert.equal(ledgerExists(root), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an exact reviewed version can be approved and then completed", () => {
  const root = fixture();
  try {
    const bilingual = run(root, [
      "--entry",
      `${ENTRY}@${VERSION}`,
      "--bilingual",
      "approved",
      "--reviewer",
      "Bilingual Reviewer",
    ]);
    assert.equal(bilingual.status, 0, bilingual.stderr);

    let record = readLedger(root)[ENTRY]!;
    assert.equal(record.version, VERSION);
    assert.equal(record.bilingual, "approved");
    assert.equal(record.pronunciation, "pending");
    assert.equal(record.reviewer, "Bilingual Reviewer");
    assert.match(record.date, /^\d{4}-\d{2}-\d{2}$/);

    const pronunciation = run(root, [
      "--entry",
      `${ENTRY}@${VERSION}`,
      "--pronunciation",
      "approved",
      "--reviewer",
      "Pronunciation Reviewer",
    ]);
    assert.equal(pronunciation.status, 0, pronunciation.stderr);

    record = readLedger(root)[ENTRY]!;
    assert.equal(record.version, VERSION);
    assert.equal(record.bilingual, "approved");
    assert.equal(record.pronunciation, "approved");
    assert.equal(record.reviewer, "Pronunciation Reviewer");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("pending/reset operations may use a bare id without fabricating approval", () => {
  const root = fixture();
  try {
    const result = run(root, [
      "--entry",
      ENTRY,
      "--bilingual",
      "pending",
    ]);
    assert.equal(result.status, 0, result.stderr);
    const record = readLedger(root)[ENTRY]!;
    assert.equal(record.version, VERSION);
    assert.equal(record.bilingual, "pending");
    assert.equal(record.pronunciation, "pending");
    assert.equal(record.reviewer, undefined);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
