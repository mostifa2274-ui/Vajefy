import fs from "node:fs";
import path from "node:path";
import { parseWorkersAiPricing, type WorkersAiPricing } from "../src/lib/learn/workers-ai-pricing";
import type { NeuronRates } from "./semantic-campaign";

/**
 * Re-verify Workers AI Neuron rates against Cloudflare's pricing page.
 *
 *   --refresh [--source-file <file>] [--github-output]
 *
 * Every candidate judge's rate and paid-billing status is updated from the
 * page; a model the page no longer prices loses its rate and so becomes
 * ineligible. It fails closed, writing nothing, if the page cannot be read or
 * the free daily allocation no longer covers the calibration ceiling.
 * verifiedAt moves only when something changed or it is a week old, so a
 * calm week makes no commits.
 */

const ROOT = process.cwd();
const SEMANTIC = path.join(ROOT, "content", "assurance", "semantic");
const RATES = path.join(SEMANTIC, "workers-ai-neuron-rates.json");
const PRESETS = path.join(SEMANTIC, "keyless-provider-presets.json");
const SOURCES = [
  "https://developers.cloudflare.com/workers-ai/platform/pricing/index.md",
  "https://raw.githubusercontent.com/cloudflare/cloudflare-docs/production/src/content/docs/workers-ai/platform/pricing.mdx",
];
const REVERIFY_DAYS = 7;

function option(flag: string): string | undefined {
  const at = process.argv.indexOf(flag);
  return at >= 0 ? process.argv[at + 1] : undefined;
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

function usable(pricing: WorkersAiPricing): boolean {
  return pricing.freeDailyAllocationNeurons !== null && Object.keys(pricing.rates).length > 0;
}

async function pricingPage(): Promise<{ source: string; pricing: WorkersAiPricing }> {
  const file = option("--source-file");
  if (file) return { source: file, pricing: parseWorkersAiPricing(fs.readFileSync(file, "utf8")) };
  const problems: string[] = [];
  for (const source of SOURCES) {
    try {
      const response = await fetch(source, { headers: { accept: "text/markdown, text/plain" } });
      if (!response.ok) {
        problems.push(`${source}: HTTP ${response.status}`);
        continue;
      }
      const pricing = parseWorkersAiPricing(await response.text());
      if (usable(pricing)) return { source, pricing };
      problems.push(`${source}: no pricing table or free allocation found`);
    } catch (error) {
      problems.push(`${source}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  fail(`Could not read Workers AI pricing:\n${problems.map((problem) => `- ${problem}`).join("\n")}`);
}

async function refresh() {
  const { source, pricing } = await pricingPage();
  if (!usable(pricing)) fail(`${source} has no pricing table or free allocation.`);
  const rates = JSON.parse(fs.readFileSync(RATES, "utf8")) as NeuronRates;
  const presets = JSON.parse(fs.readFileSync(PRESETS, "utf8")) as {
    candidates: Record<string, { model: string }[]>;
  };

  const free = pricing.freeDailyAllocationNeurons!;
  if (free < rates.calibrationSafetyCeilingNeurons) {
    fail(
      `The free daily allocation is now ${free} Neurons, below the ${rates.calibrationSafetyCeilingNeurons}-Neuron calibration ceiling. Calibration stops until the ceiling is lowered.`,
    );
  }

  const tracked = [
    ...new Set([
      ...Object.keys(rates.currentRates),
      ...Object.values(presets.candidates).flatMap((list) => list.map((item) => item.model)),
    ]),
  ].sort();
  const currentRates: NeuronRates["currentRates"] = {};
  const changes: string[] = [];
  for (const model of tracked) {
    const page = pricing.rates[model];
    const before = rates.currentRates[model];
    if (!page) {
      if (before) changes.push(`${model}: no longer priced; removed`);
      continue;
    }
    const after = { ...page, paidBillingRequired: pricing.paidBillingRequired.includes(model) };
    if (JSON.stringify(before) !== JSON.stringify(after)) {
      changes.push(`${model}: ${JSON.stringify(before ?? null)} -> ${JSON.stringify(after)}`);
    }
    currentRates[model] = after;
  }
  if (free !== rates.freeDailyAllocationNeurons) {
    changes.push(`free daily allocation: ${rates.freeDailyAllocationNeurons} -> ${free}`);
  }

  const today = new Date().toISOString().slice(0, 10);
  const age = (Date.parse(`${today}T00:00:00Z`) - Date.parse(`${rates.verifiedAt}T00:00:00Z`)) / 86_400_000;
  const write = changes.length > 0 || !(age >= 0 && age < REVERIFY_DAYS);
  if (write) {
    fs.writeFileSync(
      RATES,
      `${JSON.stringify({ ...rates, verifiedAt: today, freeDailyAllocationNeurons: free, currentRates }, null, 2)}\n`,
    );
  }

  console.log(
    `Workers AI rates re-verified from ${source}: ${changes.length} change(s); ${write ? `verifiedAt ${today}` : `verifiedAt ${rates.verifiedAt} kept`}.`,
  );
  for (const change of changes) console.log(`- ${change}`);
  const output = process.env.GITHUB_OUTPUT;
  if (process.argv.includes("--github-output") && output) {
    fs.appendFileSync(output, `changed=${write}\n`);
  }
}

if (process.argv.includes("--refresh")) await refresh();
else fail("Usage: semantic-rates.ts --refresh [--source-file <file>] [--github-output]");
