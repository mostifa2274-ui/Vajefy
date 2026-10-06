import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  KEYLESS_SEMANTIC_CALIBRATE_WORKFLOW,
  KEYLESS_SEMANTIC_CANDIDATES,
  KEYLESS_SEMANTIC_SMOKE_WORKFLOW,
  KEYLESS_SEMANTIC_WORKFLOWS,
  keylessSemanticCandidate,
  keylessSemanticEventAllowed,
} from "./semantic-gateway-config";

type Candidate = {
  provider: string;
  modelFamily: string;
  model: string;
  modelVersion: string;
  maxTokens: number;
};

type Presets = {
  roles: Record<keyof typeof KEYLESS_SEMANTIC_CANDIDATES, Candidate>;
  candidates: Record<keyof typeof KEYLESS_SEMANTIC_CANDIDATES, Candidate[]>;
};

const presets = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "content", "assurance", "semantic", "keyless-provider-presets.json"),
    "utf8",
  ),
) as Presets;

const roles = Object.keys(KEYLESS_SEMANTIC_CANDIDATES) as Array<keyof typeof KEYLESS_SEMANTIC_CANDIDATES>;

test("the Worker's candidate allowlist matches the assurance presets exactly", () => {
  for (const role of roles) {
    assert.deepEqual(
      KEYLESS_SEMANTIC_CANDIDATES[role].map((item) => ({ ...item })),
      presets.candidates[role].map(({ provider, modelFamily, model, modelVersion, maxTokens }) => ({
        provider,
        modelFamily,
        model,
        modelVersion,
        maxTokens,
      })),
    );
  }
});

test("each role's active judge is one of its allowlisted candidates", () => {
  for (const role of roles) {
    const active = presets.roles[role];
    const allowed = keylessSemanticCandidate(role, active.model);
    assert.ok(allowed, `${role}: ${active.model} is not allowlisted`);
    assert.equal(allowed.modelVersion, active.modelVersion);
    assert.equal(allowed.maxTokens, active.maxTokens);
    assert.equal(allowed.modelFamily, active.modelFamily);
  }
  assert.equal(keylessSemanticCandidate("english", "@cf/openai/gpt-oss-120b"), undefined);
});

test("only the calibration workflow may run on a schedule; only the smoke may use push", () => {
  const judge = KEYLESS_SEMANTIC_WORKFLOWS[1];
  assert.equal(keylessSemanticEventAllowed(KEYLESS_SEMANTIC_CALIBRATE_WORKFLOW, "schedule", "inference"), true);
  assert.equal(keylessSemanticEventAllowed(KEYLESS_SEMANTIC_CALIBRATE_WORKFLOW, "schedule", "status"), true);
  assert.equal(keylessSemanticEventAllowed(judge, "schedule", "inference"), false);
  assert.equal(keylessSemanticEventAllowed(judge, "workflow_dispatch", "inference"), true);
  assert.equal(keylessSemanticEventAllowed(KEYLESS_SEMANTIC_SMOKE_WORKFLOW, "push", "status"), true);
  assert.equal(keylessSemanticEventAllowed(KEYLESS_SEMANTIC_SMOKE_WORKFLOW, "push", "inference"), false);
  assert.equal(keylessSemanticEventAllowed(KEYLESS_SEMANTIC_CALIBRATE_WORKFLOW, "push", "inference"), false);
  for (const event of ["pull_request", "pull_request_target", "repository_dispatch", "workflow_run"]) {
    assert.equal(keylessSemanticEventAllowed(KEYLESS_SEMANTIC_CALIBRATE_WORKFLOW, event, "inference"), false);
  }
});
