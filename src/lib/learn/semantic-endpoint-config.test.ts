import assert from "node:assert/strict";
import test from "node:test";
import { semanticEndpointConfig } from "../../../scripts/semantic-endpoint-config";

test("semantic endpoint preflight accepts generic OpenAI-compatible configuration", () => {
  const config = semanticEndpointConfig("english", {
    SEMANTIC_JUDGE_BASE_URL: "http://localhost:8000/v1",
    SEMANTIC_JUDGE_MODEL: "fixture-model",
    SEMANTIC_JUDGE_MODEL_VERSION: "build-1",
  });
  assert.equal(config.ready, true);
  assert.equal(config.baseUrl, "http://localhost:8000/v1");
  assert.equal(config.model, "fixture-model");
  assert.equal(config.modelVersion, "build-1");
  assert.equal(config.provider, "openai-compatible");
  assert.equal(config.maxTokens, 2400);
  assert.equal(config.jsonResponseFormat, true);
});

test("role-specific semantic endpoint settings override generic settings", () => {
  const config = semanticEndpointConfig("persian", {
    SEMANTIC_JUDGE_BASE_URL: "http://generic/v1",
    SEMANTIC_JUDGE_MODEL: "generic-model",
    SEMANTIC_JUDGE_MODEL_VERSION: "generic-v1",
    SEMANTIC_JUDGE_PERSIAN_BASE_URL: "http://persian/v1",
    SEMANTIC_JUDGE_PERSIAN_MODEL: "persian-model",
    SEMANTIC_JUDGE_PERSIAN_MODEL_VERSION: "persian-v2",
    SEMANTIC_JUDGE_PERSIAN_PROVIDER: "local",
    SEMANTIC_JUDGE_PERSIAN_JSON_RESPONSE_FORMAT: "false",
    SEMANTIC_JUDGE_PERSIAN_MAX_TOKENS: "4096",
    SEMANTIC_JUDGE_PERSIAN_API_KEY: "secret",
  });
  assert.equal(config.ready, true);
  assert.equal(config.baseUrl, "http://persian/v1");
  assert.equal(config.model, "persian-model");
  assert.equal(config.modelVersion, "persian-v2");
  assert.equal(config.provider, "local");
  assert.equal(config.maxTokens, 4096);
  assert.equal(config.jsonResponseFormat, false);
  assert.equal(config.apiKeyPresent, true);
});

test("semantic endpoint preflight fails closed on missing or invalid required config", () => {
  const config = semanticEndpointConfig("adversarial", {
    SEMANTIC_JUDGE_BASE_URL: "http://localhost:8000/v1",
    SEMANTIC_JUDGE_MODEL: "fixture-model",
    SEMANTIC_JUDGE_MAX_TOKENS: "12",
  });
  assert.equal(config.ready, false);
  assert.deepEqual(config.missing, ["MODEL_VERSION", "MAX_TOKENS>=256"]);
  assert.equal(config.maxTokens, 2400);
});
