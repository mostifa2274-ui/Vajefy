import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const ROOT = process.cwd();
const SCRIPT = path.join(ROOT, "scripts", "semantic-rates.ts");
const REGISTER = path.join(ROOT, "scripts", "ts-test-register.mjs");
const SEMANTIC = path.join("content", "assurance", "semantic");
const RATES = path.join(SEMANTIC, "workers-ai-neuron-rates.json");

// The pricing page still lists Kimi K2.5 at its old, free-plan rate.
const PAGE = `
Our free allocation allows anyone to use a total of **10,000 Neurons per day at no charge**.

Some models require a paid billing method. This applies to \`@cf/moonshotai/kimi-k2.6\`. You can access these models with either plan.

| Model | Price in Tokens | Price in Neurons |
| ----- | --------------- | ---------------- |
| @cf/moonshotai/kimi-k2.5 | $0.600 per M input tokens <br/> $3.000 per M output tokens | 54545 neurons per M input tokens <br/> 272727 neurons per M output tokens |
| @cf/moonshotai/kimi-k2.6 | $0.950 per M input tokens <br/> $4.000 per M output tokens | 86364 neurons per M input tokens <br/> 363636 neurons per M output tokens |
| @cf/qwen/qwen3-30b-a3b-fp8 | $0.051 per M input tokens <br/> $0.335 per M output tokens | 4625 neurons per M input tokens <br/> 30475 neurons per M output tokens |
`;

function refresh(servedBy: Record<string, unknown> | undefined) {
  const dir = mkdtempSync(path.join(tmpdir(), "vajefy-rates-"));
  try {
    cpSync(path.join(ROOT, SEMANTIC), path.join(dir, SEMANTIC), { recursive: true });
    const rates = JSON.parse(readFileSync(path.join(dir, RATES), "utf8")) as Record<string, unknown>;
    if (servedBy) rates.servedBy = servedBy;
    else delete rates.servedBy;
    writeFileSync(path.join(dir, RATES), JSON.stringify(rates));
    writeFileSync(path.join(dir, "pricing.md"), PAGE);
    const result = spawnSync(
      process.execPath,
      ["--experimental-strip-types", "--no-warnings", "--import", REGISTER, SCRIPT, "--refresh", "--source-file", "pricing.md"],
      { cwd: dir, encoding: "utf8" },
    );
    assert.equal(result.status, 0, `${result.stdout}${result.stderr}`);
    return (JSON.parse(readFileSync(path.join(dir, RATES), "utf8")) as { currentRates: Record<string, unknown> }).currentRates;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("a model Cloudflare serves with another model takes that model's rate and paid-billing status", () => {
  const rates = refresh({
    "@cf/moonshotai/kimi-k2.5": { model: "@cf/moonshotai/kimi-k2.6", since: "2026-05-30", source: "changelog" },
  });
  assert.deepEqual(rates["@cf/moonshotai/kimi-k2.5"], {
    inputNeuronsPerMillionTokens: 86364,
    outputNeuronsPerMillionTokens: 363636,
    paidBillingRequired: true,
  });
  // Other models keep their own listing.
  assert.deepEqual(rates["@cf/qwen/qwen3-30b-a3b-fp8"], {
    inputNeuronsPerMillionTokens: 4625,
    outputNeuronsPerMillionTokens: 30475,
    paidBillingRequired: false,
  });
});

test("without an alias, a model keeps the rate the page lists for its own name", () => {
  const rates = refresh(undefined);
  assert.deepEqual(rates["@cf/moonshotai/kimi-k2.5"], {
    inputNeuronsPerMillionTokens: 54545,
    outputNeuronsPerMillionTokens: 272727,
    paidBillingRequired: false,
  });
});
