import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "generation-provenance.ts");
const REGISTER = path.join(ROOT, "scripts", "ts-test-register.mjs");

test("content changes need a generation record naming a real generator", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "vajefy-generation-"));
  const run = (...args: string[]) => {
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings", "--import", REGISTER, SCRIPT, ...args],
      { cwd: dir, encoding: "utf8" },
    );
    return { status: result.status, output: `${result.stdout}${result.stderr}` };
  };
  try {
    mkdirSync(path.join(dir, "content", "pilot", "entries"), { recursive: true });
    mkdirSync(path.join(dir, "content", "assurance"), { recursive: true });
    const entries = path.join(dir, "content", "pilot", "entries", "a.json");
    const manifestFile = path.join(dir, "content", "assurance", "generation.json");
    writeFileSync(entries, JSON.stringify([{ id: "lex:A1:cat", headword: "cat", senses: [] }, { id: "lex:A1:dog", headword: "dog", senses: [] }]));

    assert.equal(run("--init").status, 0);
    assert.equal(run("--init").status, 1, "init never overwrites a manifest");
    assert.equal(run("--check").status, 0);
    const initial = JSON.parse(readFileSync(manifestFile, "utf8"));
    assert.equal(initial.entries["lex:A1:cat"].generator, "historical-unknown");
    assert.equal(initial.entries["lex:A1:cat"].sourceHash, null);

    // An unrecorded change fails the check and says how to record it.
    writeFileSync(entries, JSON.stringify([{ id: "lex:A1:cat", headword: "cat", senses: [], extra: 1 }, { id: "lex:A1:dog", headword: "dog", senses: [] }]));
    const stale = run("--check");
    assert.equal(stale.status, 1);
    assert.match(stale.output, /lex:A1:cat: content changed since its generation record/);
    assert.match(stale.output, /npm run content:provenance -- --generator <id>/);

    // The change cannot be attributed to an unknown or undefined generator.
    assert.equal(run("--record", "--generator", "historical-unknown").status, 1);
    assert.equal(run("--record", "--generator", "nobody").status, 1);

    const manifest = JSON.parse(readFileSync(manifestFile, "utf8"));
    manifest.generators.editor = { kind: "human", note: "Copy edit", contextKey: "editor:1" };
    writeFileSync(manifestFile, JSON.stringify(manifest));
    const recorded = run("--record", "--generator", "editor");
    assert.equal(recorded.status, 0, recorded.output);
    assert.match(recorded.output, /recorded 1 changed entry as editor/);
    assert.equal(run("--check").status, 0);
    const after = JSON.parse(readFileSync(manifestFile, "utf8"));
    assert.equal(after.entries["lex:A1:cat"].generator, "editor");
    assert.equal(after.entries["lex:A1:cat"].sourceHash, initial.entries["lex:A1:cat"].outputHash);
    assert.equal(after.entries["lex:A1:dog"].generator, "historical-unknown");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
