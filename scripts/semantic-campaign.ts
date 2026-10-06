import fs from "node:fs";
import path from "node:path";
import type { SemanticJudgeRole } from "../src/lib/learn/assurance";
import { estimateSemanticRoleBudget } from "../src/lib/learn/semantic-budget";
import {
  buildSemanticJudgeUserPayload,
  semanticJudgeInputUtf8Bytes,
} from "./semantic-judge-request";

/**
 * Neuron upper bounds for one role's full frozen calibration campaign with
 * one candidate, shared by the budget report and the calibration planner.
 */

export type CampaignPreset = {
  provider: string;
  modelFamily: string;
  model: string;
  modelVersion: string;
  maxTokens: number;
};

export type NeuronRate = {
  inputNeuronsPerMillionTokens: number;
  outputNeuronsPerMillionTokens: number;
  paidBillingRequired: boolean;
};

export type NeuronRates = {
  schemaVersion: 1;
  verifiedAt: string;
  source: string;
  freeDailyAllocationNeurons: number;
  calibrationSafetyCeilingNeurons: number;
  protocolOverheadTokensPerRequest: number;
  currentRates: Record<string, NeuronRate>;
};

type Packet = {
  roles: { role: SemanticJudgeRole; criteria: string[]; promptFile: string }[];
  targets: { targetId: string; input: unknown }[];
};

export type CampaignContext = {
  root: string;
  rates: NeuronRates;
  repeats: number;
  calibrationDir: string;
};

export type CampaignEstimate = {
  model: string;
  modelVersion: string;
  maxOutputTokensPerRequest: number;
  eligible: boolean;
  ineligibleReason?: "missing-rate" | "paid-billing-required" | "over-daily-ceiling";
  rate: NeuronRate | null;
  requestsPerRun: number;
  repeats: number;
  totalRequests: number;
  maxRequestUtf8Bytes: number;
  maxInputTokensUpperBound: number;
  inputTokensUpperBoundTotal: number;
  outputTokensUpperBoundTotal: number;
  /** The most any single request can cost; failed attempts are charged per request sent. */
  maxRequestNeuronsUpperBound: number | null;
  neuronsUpperBound: number | null;
};

const packetCache = new Map<string, { packet: Packet; prompt: string; criteria: string[] }>();

function rolePacket(context: CampaignContext, role: SemanticJudgeRole) {
  const file = path.join(context.calibrationDir, "packets", `${role}.json`);
  const cached = packetCache.get(file);
  if (cached) return cached;
  const packet = JSON.parse(fs.readFileSync(file, "utf8")) as Packet;
  const spec = packet.roles.find((item) => item.role === role);
  if (!spec) throw new Error(`${role}: calibration packet role spec missing.`);
  const prompt = fs.readFileSync(path.join(context.root, spec.promptFile), "utf8");
  const loaded = { packet, prompt, criteria: spec.criteria };
  packetCache.set(file, loaded);
  return loaded;
}

export function estimateCampaign(
  context: CampaignContext,
  role: SemanticJudgeRole,
  preset: CampaignPreset,
): CampaignEstimate {
  const { packet, prompt, criteria } = rolePacket(context, role);
  const requests = packet.targets.map((target) => {
    const utf8Bytes = semanticJudgeInputUtf8Bytes(
      prompt,
      buildSemanticJudgeUserPayload(role, criteria, target.input),
    );
    return {
      utf8Bytes,
      inputTokensUpperBound: utf8Bytes + context.rates.protocolOverheadTokensPerRequest,
    };
  });
  const maxInputTokensUpperBound = Math.max(...requests.map((item) => item.inputTokensUpperBound));
  const base = {
    model: preset.model,
    modelVersion: preset.modelVersion,
    maxOutputTokensPerRequest: preset.maxTokens,
    requestsPerRun: requests.length,
    repeats: context.repeats,
    totalRequests: requests.length * context.repeats,
    maxRequestUtf8Bytes: Math.max(...requests.map((item) => item.utf8Bytes)),
    maxInputTokensUpperBound,
    inputTokensUpperBoundTotal:
      requests.reduce((total, item) => total + item.inputTokensUpperBound, 0) * context.repeats,
    outputTokensUpperBoundTotal: requests.length * preset.maxTokens * context.repeats,
  };

  const rate = context.rates.currentRates[preset.model];
  if (!rate) {
    return {
      ...base,
      eligible: false,
      ineligibleReason: "missing-rate",
      rate: null,
      maxRequestNeuronsUpperBound: null,
      neuronsUpperBound: null,
    };
  }

  const estimate = estimateSemanticRoleBudget(
    requests.map(({ inputTokensUpperBound }) => ({ inputTokensUpperBound })),
    context.repeats,
    preset.maxTokens,
    rate,
  );
  const maxRequestNeuronsUpperBound = Math.ceil(
    (maxInputTokensUpperBound * rate.inputNeuronsPerMillionTokens +
      preset.maxTokens * rate.outputNeuronsPerMillionTokens) /
      1_000_000,
  );
  const ineligibleReason = rate.paidBillingRequired
    ? ("paid-billing-required" as const)
    : estimate.neuronsUpperBound > context.rates.calibrationSafetyCeilingNeurons
      ? ("over-daily-ceiling" as const)
      : undefined;
  return {
    ...base,
    eligible: !ineligibleReason,
    ...(ineligibleReason ? { ineligibleReason } : {}),
    rate,
    maxRequestNeuronsUpperBound,
    neuronsUpperBound: estimate.neuronsUpperBound,
  };
}
