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
const MEDIA = new Map([["public/audio", HASH], ["public/site-art", HASH]]);
const CURATED = new Map([["scene:test", HASH]]);
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
      curatedContent: { "scene:test": "source:fictional-open" },
      mediaGroups: { "public/audio": ["source:fictional-open"], "public/site-art": ["source:fictional-open"] },
    },
    clearedEvidence: { entries: {}, publicData: {}, curatedContent: {}, mediaGroups: {} },
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
  const a = auditRightsLineage(lineage(), open, CURRENT, PUBLIC, MEDIA, CURATED);
  assert.equal(a.entriesCleared, 0);
  assert.equal(a.publicDataCleared, 0);
  assert.equal(a.blockers.length, 5);
});

test("unverified original rights still block items even with hash-matching evidence", () => {
  const l = lineage();
  l.clearedEvidence.entries["lex:A1:book"] = proof;
  l.clearedEvidence.publicData["public/data/lex-a1.json"] = proof;
  const a = auditRightsLineage(l, blocked, CURRENT, PUBLIC, MEDIA, CURATED);
  assert.equal(a.entriesCleared, 0);
  assert.equal(a.publicDataCleared, 0);
  assert.equal(a.blockers.length, 5);
});

test("stale or fabricated empty item evidence cannot clear a source", () => {
  const l = lineage();
  l.clearedEvidence.entries["lex:A1:book"] = { ...proof, artifactSha256: "b".repeat(64) };
  l.clearedEvidence.publicData["public/data/lex-a1.json"] = { ...proof, evidence: [] };
  const a = auditRightsLineage(l, open, CURRENT, PUBLIC, MEDIA, CURATED);
  assert.equal(a.entriesCleared, 0);
  assert.equal(a.publicDataCleared, 0);
  assert.ok(a.blockers.some(b => b.includes("item-hash-mismatch")));
  assert.ok(a.blockers.some(b => b.includes("item-evidence-invalid")));
});

test("current per-item proof plus independently authorized source can clear an item", () => {
  const l = lineage();
  l.clearedEvidence.entries["lex:A1:book"] = proof;
  l.clearedEvidence.publicData["public/data/lex-a1.json"] = proof;
  const a = auditRightsLineage(l, open, CURRENT, PUBLIC, MEDIA, CURATED);
  l.clearedEvidence.curatedContent["scene:test"] = proof;
  l.clearedEvidence.mediaGroups["public/audio"] = proof;
  l.clearedEvidence.mediaGroups["public/site-art"] = proof;
  const withMedia = auditRightsLineage(l, open, CURRENT, PUBLIC, MEDIA, CURATED);
  assert.deepEqual(withMedia.blockers, []);
  assert.equal(a.entriesCleared, 1);
  assert.equal(a.publicDataCleared, 1);
});

test("missing or orphaned lineage cannot pass structural checks", () => {
  const l = lineage();
  delete l.sourceAssignments.entries["lex:A1:book"];
  l.sourceAssignments.entries["lex:A1:missing"] = "source:fictional-open";
  const a = auditRightsLineage(l, open, CURRENT, PUBLIC, MEDIA, CURATED);
  assert.ok(a.structuralIssues.some(issue => issue.includes("stale assigned item")));
  assert.ok(a.structuralIssues.some(issue => issue.includes("missing source lineage")));
  assert.ok(a.blockers.length > 0);
});

test("unlisted generated lesson JSON is a Gate 0 structural error, not inherited clearance", () => {
  const l = lineage();
  const expanded = new Map(PUBLIC);
  expanded.set("public/data/enhanced/new-lesson.json", HASH);
  const report = auditRightsLineage(l, open, CURRENT, expanded, MEDIA, CURATED);
  assert.ok(report.structuralIssues.some(issue =>
    issue.includes("publicData: missing source lineage for public/data/enhanced/new-lesson.json")));
  assert.ok(report.blockers.some(issue => issue.includes("source-unassigned")));
});

test("scenes and contrasts require individual upstream lineage and SHA-bound evidence", () => {
  const l = lineage();
  delete l.sourceAssignments.curatedContent["scene:test"];
  const report = auditRightsLineage(l, open, CURRENT, PUBLIC, MEDIA, CURATED);
  assert.equal(report.curatedContent, 1);
  assert.equal(report.curatedContentCleared, 0);
  assert.ok(report.structuralIssues.some(issue => issue.includes("curatedContent: missing source lineage")));
  l.sourceAssignments.curatedContent["scene:test"] = "source:fictional-open";
  l.clearedEvidence.curatedContent["scene:test"] = { ...proof, artifactSha256: "b".repeat(64) };
  const changed = auditRightsLineage(l, open, CURRENT, PUBLIC, MEDIA, CURATED);
  assert.ok(changed.blockers.some(issue => issue.includes("curatedContent:scene:test:item-hash-mismatch")));
});
