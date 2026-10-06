/**
 * Reads Cloudflare's Workers AI pricing page (its Markdown source) for the
 * numbers calibration depends on: the free daily Neuron allocation, each
 * text model's Neuron rates, and the models that need paid billing.
 */

export type WorkersAiPricing = {
  freeDailyAllocationNeurons: number | null;
  paidBillingRequired: string[];
  rates: Record<string, { inputNeuronsPerMillionTokens: number; outputNeuronsPerMillionTokens: number }>;
};

function number(text: string): number {
  return Number(text.replaceAll(",", ""));
}

export function parseWorkersAiPricing(markdown: string): WorkersAiPricing {
  const free = /\*{0,2}([\d,]+) Neurons per day at no charge/i.exec(markdown);
  const paidLine = markdown.split("\n").find((line) => /require[s]? a paid billing method/i.test(line)) ?? "";
  const paidBillingRequired = [...paidLine.matchAll(/`(@cf\/[^`\s]+)`/g)].map((match) => match[1]!);

  const rates: WorkersAiPricing["rates"] = {};
  for (const line of markdown.split("\n")) {
    const cells = line.split("|").map((cell) => cell.trim());
    const model = cells[1];
    if (!model?.startsWith("@cf/")) continue;
    const neurons = cells.filter(Boolean).at(-1) ?? "";
    // "per M cached input tokens" must not count as the input rate.
    const input = /([\d,.]+) neurons per M input tokens/i.exec(neurons);
    const output = /([\d,.]+) neurons per M output tokens/i.exec(neurons);
    if (!input || !output) continue;
    rates[model] = {
      inputNeuronsPerMillionTokens: number(input[1]!),
      outputNeuronsPerMillionTokens: number(output[1]!),
    };
  }

  return {
    freeDailyAllocationNeurons: free ? number(free[1]!) : null,
    paidBillingRequired,
    rates,
  };
}
