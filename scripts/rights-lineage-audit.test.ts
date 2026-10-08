import assert from "node:assert/strict";
import test from "node:test";
import { provenanceManifest } from "../src/lib/learn/assurance";
import {
  auditRightsLineage,
  type RightsLineageManifest,
} from "./rights-lineage-audit";

const HASH = "a".repeat(64);
const CURRENT = new Map([["lex:A1:book", HASH]]);
const PUBLIC = new Map([["public/data/lex-a1.json", HASH]]);
const open = provenanceManifest.parse({
  schemaVersion: 1,
  sources: [{
    id: "source:fictional-open",
    name: "Test licensed source",
    version: "1",
    source: "fixture",
    license: "CC BY 4.0",
    redistribution: "allowed",
    derivatives: "allowed",
    attribution: "required",
    status: "cleared",
    evidence: ["fixture-license"],
  }],
});
const blocked = provenanceManifest.parse({
  schemaVersion: 1,
  sources: [{
    ...open.sources[0],
    license: "UNVERIFIED",
    redistribution: "unverified",
    derivatives: "unverified",
    status: "unverified",
    evidence: [],
  }],
});
function lineage(): RightsLineageManifest {
  return {
    schemaVersion: 1,
    scope: "repository-distributed-a1",
    sourceAssignments: {
      entries: { "lex:A1:book": "source:fictional-open" },
      publicData: { "public/data/lex-a1.json": "source:fictional-open" },
    },
    clearedEvidence: { entries: {}, publicData: {} },
  };
}
const proof = {
  method: "independent-rebuild" as const,
  artifactSha256: HASH,
  sourceReference: "fixture-source-sense-id",
  evidence: ["independent fixture rebuild notes"],
  reviewedAt: "2026-10-08",
};

test("an open source licence alone never cleans a legacy or unreviewed item", () => {
  const a = auditRightsLineage(lineage(), open, CURRENT, PUBLIC);
  assert.equal(a.entriesCleared, 0);
  assert.equal(a.publicDataCleared, 0);
  assert.equal(a.blockers.length, 2);
});

test("unverified original rights still block items even with hash-matching evidence", () => {
  const l = lineage();
  l.clearedEvidence.entries["lex:A1:book"] = proof;
  l.clearedEvidence.publicData["public/data/lex-a1.json"] = proof;
  const a = auditRightsLineage(l, blocked, CURRENT, PUBLIC);
  assert.equal(a.entriesCleared, 0);
  assert.equal(a.publicDataCleared, 0);
  assert.equal(a.blockers.length, 2);
});

test("stale or fabricated empty item evidence cannot clear a source", () => {
  const l = lineage();
  l.clearedEvidence.entries["lex:A1:book"] = { ...proof, artifactSha256: "b".repeat(64) };
  l.clearedEvidence.publicData["public/data/lex-a1.json"] = { ...proof, evidence: [] };
  const a = auditRightsLineage(l, open, CURRENT, PUBLIC);
  assert.equal(a.entriesCleared, 0);
  assert.equal(a.publicDataCleared, 0);
  assert.ok(a.blockers.some(b => b.includes("item-hash-mismatch")));
  assert.ok(a.blockers.some(b => b.includes("item-evidence-invalid")));
});

test("current per-item proof plus independently authorized source can clear an item", () => {
  const l = lineage();
  l.clearedEvidence.entries["lex:A1:book"] = proof;
  l.clearedEvidence.publicData["public/data/lex-a1.json"] = proof;
  const a = auditRightsLineage(l, open, CURRENT, PUBLIC);
  assert.deepEqual(a.blockers, []);
  assert.equal(a.entriesCleared, 1);
  assert.equal(a.publicDataCleared, 1);
});

test("missing or orphaned lineage cannot pass structural checks", () => {
  const l = lineage();
  delete l.sourceAssignments.entries["lex:A1:book"];
  l.sourceAssignments.entries["lex:A1:missing"] = "source:fictional-open";
  const a = auditRightsLineage(l, open, CURRENT, PUBLIC);
  assert.ok(a.structuralIssues.some(issue => issue.includes("stale assigned item")));
  assert.ok(a.structuralIssues.some(issue => issue.includes("missing source lineage")));
  assert.ok(a.blockers.length > 0);
});
