import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { KEYLESS_SEMANTIC_MODELS } from "./semantic-gateway-config";

type Presets = {
  roles: Record<
    keyof typeof KEYLESS_SEMANTIC_MODELS,
    {
      provider: string;
      modelFamily: string;
      model: string;
      modelVersion: string;
      maxTokens: number;
    }
  >;
};

test("Worker keyless model map matches assurance presets exactly", () => {
  const presets = JSON.parse(
    fs.readFileSync(
      path.join(
        process.cwd(),
        "content",
        "assurance",
        "semantic",
        "keyless-provider-presets.json",
      ),
      "utf8",
    ),
  ) as Presets;

  for (const role of Object.keys(KEYLESS_SEMANTIC_MODELS) as Array<
    keyof typeof KEYLESS_SEMANTIC_MODELS
  >) {
    const expected = presets.roles[role];
    const actual = KEYLESS_SEMANTIC_MODELS[role];
    assert.equal(actual.provider, expected.provider);
    assert.equal(actual.modelFamily, expected.modelFamily);
    assert.equal(actual.model, expected.model);
    assert.equal(actual.modelVersion, expected.modelVersion);
    assert.equal(actual.maxTokens, expected.maxTokens);
  }
});
