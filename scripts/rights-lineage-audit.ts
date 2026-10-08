import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { provenanceManifest, type ProvenanceManifest } from "../src/lib/learn/assurance";
import { semanticStableJson } from "./semantic-input";
import type { Entry } from "../src/lib/learn/content";

/**
 * Rights lineage is separate from generation provenance. An AI generator record
 * does NOT grant redistribution rights to its source selection or derived text.
 *
 * This audit tracks current canonical entries and every top-level public/data
 * JSON asset, even when Gate 0 is blocked. A newly licensed *alternative*
 * source never automatically clears inherited or already-published material.
 */
export type RightsLineageEvidence = {
  method: "licensed-copy" | "independent-rebuild";
  artifactSha256: string;
  sourceReference: string;
  evidence: string[];
  reviewedAt: string;
};

export type RightsLineageManifest = {
  schemaVersion: 1;
  scope: string;
  sourceAssignments: {
    entries: Record<string, string>;
    publicData: Record<string, string>;
  };
  clearedEvidence: {
    entries: Record<string, RightsLineageEvidence>;
    publicData: Record<string, RightsLineageEvidence>;
  };
  note?: string;
};

export type RightsLineageAudit = {
  schemaVersion: 1;
  entries: number;
  entriesCleared: number;
  publicData: number;
  publicDataCleared: number;
  structuralIssues: string[];
  blockers: string[];
};

const HASH = /^[a-f0-9]{64}$/;
const TODAY = /^\d{4}-\d{2}-\d{2}$/;

export function auditRightsLineage(
  manifest: RightsLineageManifest,
  provenance: ProvenanceManifest,
  currentEntries: ReadonlyMap<string, string>,
  currentPublicData: ReadonlyMap<string, string>,
): RightsLineageAudit {
  const issues: string[] = [];
  const blockers: string[] = [];
  if (manifest.schemaVersion !== 1 || manifest.scope !== "repository-distributed-a1") {
    issues.push("Incorrect rights lineage schema/scope.");
  }
  if (!manifest.sourceAssignments?.entries || !manifest.sourceAssignments?.publicData ||
      !manifest.clearedEvidence?.entries || !manifest.clearedEvidence?.publicData) {
    issues.push("Missing explicit source assignments or cleared evidence maps.");
    return { schemaVersion: 1, entries: currentEntries.size, entriesCleared: 0,
      publicData: currentPublicData.size, publicDataCleared: 0, structuralIssues: issues, blockers };
  }

  const sources = new Map(provenance.sources.map(s => [s.id, s]));
  if (sources.size !== provenance.sources.length) issues.push("Duplicate source IDs in provenance manifest.");

  function inspect(kind: "entries" | "publicData", current: ReadonlyMap<string, string>): number {
    const assignments = manifest.sourceAssignments[kind];
    const evidence = manifest.clearedEvidence[kind];
    let cleared = 0;
    for (const id of Object.keys(assignments)) {
      if (!current.has(id)) issues.push(kind + ": stale assigned item " + id);
    }
    for (const id of Object.keys(evidence)) {
      if (!current.has(id)) issues.push(kind + ": stale clearance evidence " + id);
    }
    for (const [id, currentHash] of current) {
      const sourceId = assignments[id];
      if (!sourceId) {
        issues.push(kind + ": missing source lineage for " + id);
        blockers.push(kind + ":" + id + ":source-unassigned");
        continue;
      }
      const source = sources.get(sourceId);
      if (!source) {
        issues.push(kind + ": unknown source " + sourceId + " for " + id);
        blockers.push(kind + ":" + id + ":source-unknown");
        continue;
      }
      const proof = evidence[id];
      const sourceReady = source.status === "cleared" &&
        source.redistribution === "allowed" &&
        source.derivatives === "allowed" &&
        source.license !== "UNVERIFIED" &&
        source.evidence.length > 0;
      const validEvidence = !!proof &&
        (proof.method === "licensed-copy" || proof.method === "independent-rebuild") &&
        HASH.test(proof.artifactSha256) &&
        proof.artifactSha256 === currentHash &&
        typeof proof.sourceReference === "string" && proof.sourceReference.trim().length > 0 &&
        Array.isArray(proof.evidence) && proof.evidence.length >= 1 &&
        proof.evidence.every(ref => typeof ref === "string" && ref.trim().length > 0) &&
        TODAY.test(proof.reviewedAt);
      if (sourceReady && validEvidence) {
        cleared++;
      } else {
        const reason = !sourceReady ? "source-rights-unverified"
          : !proof ? "item-evidence-missing"
          : proof.artifactSha256 !== currentHash ? "item-hash-mismatch"
          : "item-evidence-invalid";
        blockers.push(kind + ":" + id + ":" + reason);
      }
    }
    return cleared;
  }

  const entriesCleared = inspect("entries", currentEntries);
  const publicDataCleared = inspect("publicData", currentPublicData);
  return {
    schemaVersion: 1,
    entries: currentEntries.size,
    entriesCleared,
    publicData: currentPublicData.size,
    publicDataCleared,
    structuralIssues: issues,
    blockers,
  };
}

/** Strictly current files; a source change invalidates any old item hash. */
export function loadCurrentRightsAudit(root = process.cwd()): RightsLineageAudit {
  const read = (p: string) => JSON.parse(fs.readFileSync(path.join(root, p), "utf8"));
  const provenance = provenanceManifest.parse(read("content/assurance/provenance.json"));
  const lineage = read("content/assurance/rights-lineage.json") as RightsLineageManifest;
  const entries = new Map<string, string>();
  const entryDir = path.join(root, "content", "pilot", "entries");
  for (const name of fs.readdirSync(entryDir).filter(n => n.endsWith(".json")).sort()) {
    const rows = JSON.parse(fs.readFileSync(path.join(entryDir, name), "utf8")) as Entry[];
    for (const entry of rows) {
      if (!entry.id.startsWith("lex:A1:")) continue;
      if (entries.has(entry.id)) throw new Error("Duplicate A1 rights target: " + entry.id);
      entries.set(entry.id, createHash("sha256").update(semanticStableJson(entry)).digest("hex"));
    }
  }
  const curriculum = read("content/curriculum/A1.json") as {
    units: { entries: { id: string }[] }[];
  };
  const curriculumIds = curriculum.units.flatMap(unit => unit.entries.map(entry => entry.id));
  const structuralIssues: string[] = [];
  if (new Set(curriculumIds).size !== curriculumIds.length) {
    structuralIssues.push("Duplicate A1 curriculum IDs.");
  }
  for (const id of curriculumIds) {
    if (!entries.has(id)) structuralIssues.push("A1 curriculum references an untracked entry " + id);
  }
  for (const id of entries.keys()) {
    if (!curriculumIds.includes(id)) structuralIssues.push("A1 rights target absent from curriculum " + id);
  }

  const publicData = new Map<string, string>();
  const dataDir = path.join(root, "public", "data");
  for (const name of fs.readdirSync(dataDir).filter(n => n.endsWith(".json")).sort()) {
    const filename = path.join(dataDir, name);
    publicData.set("public/data/" + name, createHash("sha256").update(fs.readFileSync(filename)).digest("hex"));
  }
  const audit = auditRightsLineage(lineage, provenance, entries, publicData);
  audit.structuralIssues.push(...structuralIssues);
  return audit;
}
