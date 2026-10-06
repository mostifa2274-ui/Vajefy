export type SemanticNeuronRate = {
  inputNeuronsPerMillionTokens: number;
  outputNeuronsPerMillionTokens: number;
};

export type SemanticBudgetRequest = {
  inputTokensUpperBound: number;
};

export type SemanticRoleBudget = {
  requestsPerRun: number;
  repeats: number;
  inputTokensUpperBoundTotal: number;
  outputTokensUpperBoundTotal: number;
  neuronsUpperBound: number;
};

export function estimateSemanticRoleBudget(
  requests: SemanticBudgetRequest[],
  repeats: number,
  maxOutputTokens: number,
  rate: SemanticNeuronRate,
): SemanticRoleBudget {
  if (!Number.isInteger(repeats) || repeats < 1) {
    throw new Error("repeats must be a positive integer");
  }
  if (!Number.isInteger(maxOutputTokens) || maxOutputTokens < 1) {
    throw new Error("maxOutputTokens must be a positive integer");
  }

  let perRunNeurons = 0;
  let inputTokensPerRun = 0;

  for (const request of requests) {
    if (
      !Number.isInteger(request.inputTokensUpperBound) ||
      request.inputTokensUpperBound < 1
    ) {
      throw new Error("inputTokensUpperBound must be a positive integer");
    }
    inputTokensPerRun += request.inputTokensUpperBound;
    perRunNeurons += Math.ceil(
      (request.inputTokensUpperBound *
        rate.inputNeuronsPerMillionTokens +
        maxOutputTokens * rate.outputNeuronsPerMillionTokens) /
        1_000_000,
    );
  }

  return {
    requestsPerRun: requests.length,
    repeats,
    inputTokensUpperBoundTotal: inputTokensPerRun * repeats,
    outputTokensUpperBoundTotal:
      requests.length * maxOutputTokens * repeats,
    neuronsUpperBound: perRunNeurons * repeats,
  };
}
