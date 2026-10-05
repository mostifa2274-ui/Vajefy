import {
  ASSESSMENT_MIN_DELAY_DAYS,
  ASSESSMENT_PROTOCOL_ID,
  STUDY_VERSION,
} from "./study";

export const STUDY_CHANNELS = ["draft", "released", "none"] as const;
export type StudyChannel = (typeof STUDY_CHANNELS)[number];

export type StudyProtocolRecord = {
  source: string;
  participant: string;
  version: number;
  contentVersion: string | null;
  channel: string | null;
  build: string | null;
  assessmentProtocol: string | null;
  assessmentMinimumDelayDays: number | null;
  assessmentBankContentVersion: string | null;
};

export type AssessmentEvidence = {
  id: string;
  type: string;
  item?: string;
  context?: {
    session?: string;
    prompt?: string;
    promptId?: string;
    contentVersion?: string;
    responseMs?: number;
  };
  assessment?: {
    part: "meaning" | "use";
    correct?: boolean;
    missing?: true;
    delayDays: number;
  };
};

export type StudyProtocolSummary = {
  exportVersions: number[];
  contentVersions: string[];
  assessmentProtocols: string[];
  builds: string[];
  channels: StudyChannel[];
  enhancedChannels: Exclude<StudyChannel, "none">[];
  participants: number;
  mixedProtocols: boolean;
};

function sorted<T extends string | number>(values: Iterable<T>): T[] {
  return [...new Set(values)].sort((a, b) =>
    String(a).localeCompare(String(b)),
  );
}

/**
 * Validate metadata that determines whether exported learners can be pooled.
 * The two intended study arms may differ by channel (none vs enhanced), but
 * they must share one export/content/assessment protocol by default.
 */
export function validateStudyProtocols(
  records: StudyProtocolRecord[],
  allowMixed = false,
): { errors: string[]; warnings: string[]; summary: StudyProtocolSummary } {
  const errors: string[] = [];
  const warnings: string[] = [];
  const participants = new Map<string, string>();

  for (const record of records) {
    if (!record.participant) {
      errors.push(`${record.source}: study export has no participant code`);
    } else {
      const previous = participants.get(record.participant);
      if (previous) {
        errors.push(
          `duplicate participant ${record.participant}: ${previous} and ${record.source}`,
        );
      } else {
        participants.set(record.participant, record.source);
      }
    }

    if (!Number.isInteger(record.version) || record.version < 1) {
      errors.push(`${record.source}: invalid study export version`);
    } else if (record.version > STUDY_VERSION) {
      errors.push(
        `${record.source}: study export version ${record.version} is newer than supported version ${STUDY_VERSION}`,
      );
    }

    if (!record.contentVersion) {
      errors.push(
        `${record.source}: missing app.contentVersion; the assessment bank cannot be identified`,
      );
    }

    if (
      !record.channel ||
      !STUDY_CHANNELS.includes(record.channel as StudyChannel)
    ) {
      errors.push(
        `${record.source}: invalid or missing content channel ${record.channel ?? "(missing)"}`,
      );
    }

    if (record.version >= 2) {
      if (!record.build) {
        errors.push(`${record.source}: v2 study export is missing app.build`);
      }
      if (record.assessmentProtocol !== ASSESSMENT_PROTOCOL_ID) {
        errors.push(
          `${record.source}: v2 assessment protocol must be ${ASSESSMENT_PROTOCOL_ID}`,
        );
      }
      if (record.assessmentMinimumDelayDays !== ASSESSMENT_MIN_DELAY_DAYS) {
        errors.push(
          `${record.source}: v2 assessment minimum delay must be ${ASSESSMENT_MIN_DELAY_DAYS} days`,
        );
      }
      if (
        !record.assessmentBankContentVersion ||
        record.assessmentBankContentVersion !== record.contentVersion
      ) {
        errors.push(
          `${record.source}: assessment-bank version must match app.contentVersion`,
        );
      }
    }
  }

  const protocolKeys = sorted(
    records.map((record) =>
      [
        record.version,
        record.contentVersion ?? "(missing)",
        record.version >= 2
          ? record.assessmentProtocol ?? "(missing)"
          : "legacy-v1-implicit",
        record.version >= 2
          ? record.assessmentMinimumDelayDays ?? "(missing)"
          : "legacy-v1-implicit-delay",
        record.version >= 2
          ? record.assessmentBankContentVersion ?? "(missing)"
          : record.contentVersion ?? "(missing)",
      ].join("|"),
    ),
  );
  const mixedProtocols = protocolKeys.length > 1;
  if (mixedProtocols) {
    const message =
      "study exports use multiple export/content/assessment protocols; pooled outcomes are not directly comparable";
    if (allowMixed) warnings.push(message);
    else errors.push(`${message}; pass --allow-mixed-protocols only for an explicitly stratified exploratory analysis`);
  }

  const channels = sorted(
    records
      .map((record) => record.channel)
      .filter(
        (channel): channel is StudyChannel =>
          Boolean(channel) &&
          STUDY_CHANNELS.includes(channel as StudyChannel),
      ),
  );
  const enhancedChannels = channels.filter(
    (channel): channel is Exclude<StudyChannel, "none"> => channel !== "none",
  );
  if (enhancedChannels.length > 1) {
    const message =
      "study exports mix draft and released enhanced-content channels";
    if (allowMixed) warnings.push(message);
    else errors.push(`${message}; analyze them separately or pass --allow-mixed-protocols with an explicit justification`);
  }

  return {
    errors,
    warnings,
    summary: {
      exportVersions: sorted(records.map((record) => record.version)),
      contentVersions: sorted(
        records.flatMap((record) =>
          record.contentVersion ? [record.contentVersion] : [],
        ),
      ),
      assessmentProtocols: sorted(
        records.map((record) =>
          record.version >= 2
            ? record.assessmentProtocol ?? "(missing)"
            : "legacy-v1-implicit",
        ),
      ),
      builds: sorted(
        records.flatMap((record) => (record.build ? [record.build] : [])),
      ),
      channels,
      enhancedChannels,
      participants: participants.size,
      mixedProtocols,
    },
  };
}

/**
 * V2 delayed-assessment evidence must identify the exact prompt actually shown.
 * Missing evidence stays version-bound but intentionally has no prompt id.
 */
export function validateAssessmentEvidence(
  source: string,
  events: AssessmentEvidence[],
): string[] {
  const errors: string[] = [];
  for (const event of events) {
    if (event.type !== "assessment" || !event.assessment) continue;
    const label = `${source}: assessment ${event.id}`;
    const item = event.item;
    const context = event.context;

    if (!item) {
      errors.push(`${label} has no item id`);
      continue;
    }
    if (!context?.contentVersion) {
      errors.push(`${label} has no entry content version`);
    }
    if (!context?.session) {
      errors.push(`${label} has no session id`);
    }

    if (event.assessment.missing) {
      if (context?.promptId) {
        errors.push(`${label} is missing evidence but still names a prompt id`);
      }
      continue;
    }

    if (event.assessment.part === "use") {
      if (
        !context?.promptId ||
        !context.promptId.startsWith(`${item}/`) ||
        context.promptId.startsWith("generated:")
      ) {
        errors.push(
          `${label} use evidence must name the exact held-out ${item}/check prompt`,
        );
      }
      if (
        event.assessment.delayDays < ASSESSMENT_MIN_DELAY_DAYS
      ) {
        errors.push(
          `${label} use evidence is only ${event.assessment.delayDays} days delayed; protocol requires at least ${ASSESSMENT_MIN_DELAY_DAYS}`,
        );
      }
    } else if (context?.promptId !== "generated:meaning") {
      errors.push(
        `${label} meaning evidence must identify the generated:meaning prompt`,
      );
    }
  }
  return errors;
}
