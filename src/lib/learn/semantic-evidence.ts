import type {
  SemanticEvidenceBundle,
  SemanticJudgeRecord,
  SemanticJudgeRole,
} from "./assurance";

export type SemanticPacketReference = {
  schemaVersion: 1;
  unitId: string;
  generationContextKey: string;
  roles: { role: SemanticJudgeRole }[];
  targets: {
    targetId: string;
    contentVersion: string;
    inputHash: string;
  }[];
};

export type SemanticEvidenceValidation = {
  problems: string[];
  judgments: SemanticJudgeRecord[];
  missing: string[];
};

export function validateSemanticEvidenceBundles(
  packet: SemanticPacketReference,
  bundles: SemanticEvidenceBundle[],
  requireComplete = false,
): SemanticEvidenceValidation {
  const problems: string[] = [];
  const judgments: SemanticJudgeRecord[] = [];
  const seenPairs = new Set<string>();
  const expectedRoles = new Set(packet.roles.map((role) => role.role));
  const targetById = new Map(
    packet.targets.map((target) => [target.targetId, target] as const),
  );
  const rolesByContext = new Map<string, Set<SemanticJudgeRole>>();

  for (const [bundleIndex, bundle] of bundles.entries()) {
    const label = `bundle[${bundleIndex}]`;

    if (bundle.unitId !== packet.unitId) {
      problems.push(`${label}:unit-mismatch:${bundle.unitId}`);
    }
    if (bundle.generationContextKey !== packet.generationContextKey) {
      problems.push(`${label}:generation-context-mismatch`);
    }

    const bundleRoles = new Set(bundle.judgments.map((judgment) => judgment.role));
    if (bundleRoles.size !== 1 && bundle.judgments.length > 0) {
      problems.push(
        `${label}:mixed-roles:${[...bundleRoles].sort().join(",")}`,
      );
    }

    for (const judgment of bundle.judgments) {
      const target = targetById.get(judgment.targetId);
      if (!target) {
        problems.push(`${label}:unknown-target:${judgment.targetId}`);
        continue;
      }
      if (!expectedRoles.has(judgment.role)) {
        problems.push(`${label}:unexpected-role:${judgment.role}`);
        continue;
      }
      if (judgment.contentVersion !== target.contentVersion) {
        problems.push(
          `${label}:stale-content-version:${judgment.targetId}:${judgment.role}`,
        );
      }
      if (judgment.inputHash !== target.inputHash) {
        problems.push(
          `${label}:stale-input-hash:${judgment.targetId}:${judgment.role}`,
        );
      }
      if (
        judgment.evaluator.contextIsolationKey === packet.generationContextKey
      ) {
        problems.push(
          `${label}:judge-context-matches-generator:${judgment.targetId}:${judgment.role}`,
        );
      }

      const contextRoles =
        rolesByContext.get(judgment.evaluator.contextIsolationKey) ??
        new Set<SemanticJudgeRole>();
      contextRoles.add(judgment.role);
      rolesByContext.set(judgment.evaluator.contextIsolationKey, contextRoles);

      const pair = `${judgment.targetId}|${judgment.role}`;
      if (seenPairs.has(pair)) {
        problems.push(`${label}:duplicate-target-role:${pair}`);
      } else {
        seenPairs.add(pair);
        judgments.push(judgment);
      }
    }
  }

  for (const [contextKey, roles] of rolesByContext) {
    if (roles.size > 1) {
      problems.push(
        `shared-context-across-roles:${contextKey}:${[...roles]
          .sort()
          .join(",")}`,
      );
    }
  }

  const missing: string[] = [];
  if (requireComplete) {
    for (const target of packet.targets) {
      for (const role of packet.roles) {
        const pair = `${target.targetId}|${role.role}`;
        if (!seenPairs.has(pair)) missing.push(pair);
      }
    }
    if (missing.length) {
      problems.push(`incomplete:${missing.length}`);
    }
  }

  return { problems, judgments, missing };
}
