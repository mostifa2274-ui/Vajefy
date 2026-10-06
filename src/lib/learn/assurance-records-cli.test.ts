import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "assurance-records.ts");
const REGISTER = path.join(ROOT, "scripts", "ts-test-register.mjs");

const UNVERIFIED = {
  schemaVersion: 1,
  sources: [
    {
      id: "workbook",
      name: "Workbook",
      version: "1",
      source: "attachments/workbook.xlsx",
      license: "UNVERIFIED",
      redistribution: "unverified",
      derivatives: "unverified",
      attribution: "unknown",
      status: "unverified",
      evidence: [],
    },
  ],
};

function sense(id: string, examples: string[]) {
  return {
    id,
    pos: "noun",
    gloss: "گربه",
    meaning: "یک حیوان خانگی",
    grammar: [],
    examples: examples.map((en, index) => ({ en, fa: `جملهٔ ${index + 1}` })),
    mistake: { wrong: "a cats", right: "a cat", why: "بعد از a اسم مفرد می‌آید.", wrongFa: "یک گربه‌ها", rightFa: "یک گربه" },
    check: [],
  };
}

type Workspace = { dir: string; run: (...args: string[]) => { status: number | null; output: string } };

function workspace(senses: ReturnType<typeof sense>[], audio: Record<string, unknown>): Workspace {
  const dir = mkdtempSync(path.join(tmpdir(), "vajefy-records-"));
  mkdirSync(path.join(dir, "content", "pilot", "entries"), { recursive: true });
  mkdirSync(path.join(dir, "content", "compiled"), { recursive: true });
  mkdirSync(path.join(dir, "content", "curriculum"), { recursive: true });
  mkdirSync(path.join(dir, "content", "assurance", "semantic"), { recursive: true });
  const entry = { id: "lex:A1:cat", headword: "cat", senses };
  writeFileSync(path.join(dir, "content", "pilot", "entries", "a.json"), JSON.stringify([entry]));
  writeFileSync(
    path.join(dir, "content", "compiled", "enhanced.json"),
    JSON.stringify({ version: "c1", entries: [{ ...entry, version: "v1", order: 0, prerequisites: [] }], audio }),
  );
  writeFileSync(
    path.join(dir, "content", "curriculum", "A1.json"),
    JSON.stringify({ units: [{ id: "01-introductions", entries: [{ id: "lex:A1:cat" }] }] }),
  );
  writeFileSync(path.join(dir, "content", "assurance", "provenance.json"), JSON.stringify(UNVERIFIED));
  return {
    dir,
    run: (...args) => {
      const result = spawnSync(
        process.execPath,
        ["--experimental-strip-types", "--no-warnings", "--import", REGISTER, SCRIPT, ...args],
        { cwd: dir, encoding: "utf8" },
      );
      return { status: result.status, output: `${result.stdout}${result.stderr}` };
    },
  };
}

type SenseRecord = { targetId: string; sourceHash: string; status: string; criteria: { criterion: string; result: string; evidence?: string[]; reasonCode?: string }[] };

function records(dir: string): SenseRecord[] {
  return JSON.parse(readFileSync(path.join(dir, "content", "assurance", "records", "A1.json"), "utf8")).records;
}

const CLIPS = { gb: { word: "pilot/a.mp3", examples: [] }, us: { word: "pilot/b.mp3", examples: [] } };
const DISTINCT = ["I see a cat.", "Our cat is black and very small.", "Do you have a cat at home?"];

test("a sense that passes every deterministic check stays UNCERTAIN without semantic, audio and rights evidence", () => {
  const space = workspace([sense("lex:A1:cat", DISTINCT)], { "lex:A1:cat": CLIPS });
  try {
    assert.equal(space.run("--write").status, 0);
    const [record] = records(space.dir);
    assert.equal(record.status, "UNCERTAIN");
    const result = Object.fromEntries(record.criteria.map((item) => [item.criterion, `${item.result}${item.reasonCode ? `:${item.reasonCode}` : ""}`]));
    assert.equal(result["provenance.rights"], "UNCERTAIN:gate0-unverified");
    assert.equal(result["structure.examples"], "PASS");
    assert.equal(result["semantic.english"], "UNCERTAIN:semantic-not-run");
    assert.equal(result["semantic.adversarial"], "UNCERTAIN:semantic-not-run");
    assert.equal(result["audio.en-GB"], "UNCERTAIN:audio-not-certified");
  } finally {
    rmSync(space.dir, { recursive: true, force: true });
  }
});

test("deterministic findings and a missing clip make the record FAIL", () => {
  const space = workspace([sense("lex:A1:cat", ["I have a cat.", "I have a dog."])], { "lex:A1:cat": { gb: CLIPS.gb } });
  try {
    assert.equal(space.run("--write").status, 0);
    const [record] = records(space.dir);
    assert.equal(record.status, "FAIL");
    const examples = record.criteria.find((item) => item.criterion === "structure.examples");
    assert.deepEqual(examples?.evidence, ["EXAMPLE_COUNT:1", "EXAMPLE_NEAR_DUPLICATE:1"]);
    const us = record.criteria.find((item) => item.criterion === "audio.en-US");
    assert.equal(`${us?.result}:${us?.reasonCode}`, "FAIL:audio-missing");
  } finally {
    rmSync(space.dir, { recursive: true, force: true });
  }
});

test("records go stale when content changes, and a content change gives a new source hash", () => {
  const space = workspace([sense("lex:A1:cat", DISTINCT)], { "lex:A1:cat": CLIPS });
  try {
    assert.equal(space.run("--write").status, 0);
    assert.equal(space.run("--check").status, 0);
    const before = records(space.dir)[0].sourceHash;

    const compiled = path.join(space.dir, "content", "compiled", "enhanced.json");
    const data = JSON.parse(readFileSync(compiled, "utf8"));
    data.entries[0].senses[0].gloss = "گربهٔ خانگی";
    writeFileSync(compiled, JSON.stringify(data));
    const stale = space.run("--check");
    assert.equal(stale.status, 1);
    assert.match(stale.output, /Run: npm run assurance:records/);

    assert.equal(space.run("--write").status, 0);
    assert.notEqual(records(space.dir)[0].sourceHash, before);
  } finally {
    rmSync(space.dir, { recursive: true, force: true });
  }
});
