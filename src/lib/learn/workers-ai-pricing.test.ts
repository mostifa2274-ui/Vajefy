import assert from "node:assert/strict";
import test from "node:test";
import { parseWorkersAiPricing } from "./workers-ai-pricing";

const PAGE = `
Our free allocation allows anyone to use a total of **10,000 Neurons per day at no charge**. To use more than 10,000 Neurons per day, you need to sign up.

Some models require a paid billing method. This applies to \`@cf/moonshotai/kimi-k2.6\` and \`@cf/zai-org/glm-5.3\`. You can access these models with either plan.

| Model                                        | Price in Tokens                                            | Price in Neurons                                                         |
| -------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------ |
| @cf/qwen/qwen3-30b-a3b-fp8                   | $0.051 per M input tokens <br/> $0.335 per M output tokens | 4625 neurons per M input tokens <br/> 30475 neurons per M output tokens  |
| @cf/moonshotai/kimi-k2.5                     | $0.600 per M input tokens <br/> $0.100 per M cached input tokens <br/> $3.000 per M output tokens | 54545 neurons per M input tokens <br/> 9091 neurons per M cached input tokens <br/> 272727 neurons per M output tokens |
| @cf/baai/bge-m3                              | $0.012 per M input tokens                                  | 1075 neurons per M input tokens                                          |
| @cf/deepgram/aura-1                          | $0.015 per 1k characters input <br/>                       | 1,363.64 neurons per 1k characters input <br/>                           |
`;

test("the pricing page yields the free allocation, text-model rates and paid-only models", () => {
  const pricing = parseWorkersAiPricing(PAGE);
  assert.equal(pricing.freeDailyAllocationNeurons, 10000);
  assert.deepEqual(pricing.paidBillingRequired, ["@cf/moonshotai/kimi-k2.6", "@cf/zai-org/glm-5.3"]);
  assert.deepEqual(pricing.rates, {
    "@cf/qwen/qwen3-30b-a3b-fp8": { inputNeuronsPerMillionTokens: 4625, outputNeuronsPerMillionTokens: 30475 },
    // The cached-input rate is not the input rate.
    "@cf/moonshotai/kimi-k2.5": { inputNeuronsPerMillionTokens: 54545, outputNeuronsPerMillionTokens: 272727 },
  });
});

test("a page without the expected wording yields nothing to trust", () => {
  const pricing = parseWorkersAiPricing("<html><body>Pricing</body></html>");
  assert.equal(pricing.freeDailyAllocationNeurons, null);
  assert.deepEqual(pricing.rates, {});
  assert.deepEqual(pricing.paidBillingRequired, []);
});
