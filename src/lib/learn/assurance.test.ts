import assert from "node:assert/strict";
import test from "node:test";
import {
  aggregateAssurance,
  machineAssuranceRecord,
  provenanceBlockers,
  provenanceManifest,
} from "./assurance";

test("cleared provenance requires explicit redistribution and derivative rights", () => {
  const parsed = provenanceManifest.safeParse({
    schemaVersion: 1,
    sources: [
      {
        id: "source:test",
        name: "Test",
        version: "1",
        source: "fixture",
        license: "MIT",
        redistribution: "unverified",
        derivatives: "allowed",
        attribution: "required",
        status: "cleared",
        evidence: [],
      },
    ],
  });
  assert.equal(parsed.success, false);
});

test("unverified provenance is structurally valid but blocks release", () => {
  const manifest = provenanceManifest.parse({
    schemaVersion: 1,
    sources: [
      {
        id: "source:test",
        name: "Test",
        version: "1",
        source: "fixture",
        license: "UNVERIFIED",
        redistribution: "unverified",
        derivatives: "unverified",
        attribution: "unknown",
        status: "unverified",
        evidence: [],
      },
    ],
  });
  assert.ok(provenanceBlockers(manifest).length >= 3);
});

test("assurance aggregation fails closed", () => {
  assert.equal(
    aggregateAssurance([
      {
        criterion: "schema",
        result: "PASS",
        evidence: [],
        reasonCode: null,
      },
      {
        criterion: "translation",
        result: "UNCERTAIN",
        evidence: [],
        reasonCode: "low-confidence",
      },
    ]),
    "UNCERTAIN",
  );
});

test("machine assurance records reject empty evidence sets", () => {
  const parsed = machineAssuranceRecord.safeParse({
    schemaVersion: 1,
    targetId: "lex:A1:test",
    contentVersion: "abc123",
    sourceHash: "hash",
    generatedAt: "2026-10-06T00:00:00Z",
    criteria: [],
    status: "PASS",
  });
  assert.equal(parsed.success, false);
});
