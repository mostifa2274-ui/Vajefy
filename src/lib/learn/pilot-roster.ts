import { createHash, createHmac } from "node:crypto";
import {
  ASSESSMENT_MIN_DELAY_DAYS,
  ASSESSMENT_PROTOCOL_ID,
  STUDY_VERSION,
  validParticipant,
} from "./study";
import {
  STUDY_CHANNELS,
  type StudyChannel,
} from "./study-protocol";

export const PILOT_ROSTER_KIND = "vajefy-pilot-roster";
export const PILOT_ROSTER_VERSION = 1;

export type PilotArm = "enhanced" | "comparison";

export type PilotRosterAssignment = {
  participant: string;
  arm: PilotArm;
  channel: StudyChannel;
};

export type PilotRoster = {
  kind: typeof PILOT_ROSTER_KIND;
  version: typeof PILOT_ROSTER_VERSION;
  seedFingerprint: string;
  protocol: {
    studyExportVersion: number;
    contentVersion: string;
    enhancedChannel: Exclude<StudyChannel, "none">;
    comparisonChannel: "none";
    dailyMinutes: number;
    assessment: {
      id: typeof ASSESSMENT_PROTOCOL_ID;
      minimumDelayDays: typeof ASSESSMENT_MIN_DELAY_DAYS;
      bankContentVersion: string;
    };
  };
  assignments: PilotRosterAssignment[];
};

export type PilotRosterObservedExport = {
  source: string;
  participant: string;
  version: number;
  contentVersion: string | null;
  channel: string | null;
  assessmentProtocol: string | null;
  assessmentMinimumDelayDays: number | null;
  assessmentBankContentVersion: string | null;
  dailyMinutes: number | null;
};

export type PilotRosterValidationSummary = {
  assigned: number;
  assignedEnhanced: number;
  assignedComparison: number;
  observed: number;
  observedEnhanced: number;
  observedComparison: number;
  missing: number;
  missingEnhanced: number;
  missingComparison: number;
};

export function pilotRosterSeedFingerprint(seed: string): string {
  return createHash("sha256").update(seed, "utf8").digest("hex");
}

function allocationKey(seed: string, participant: string): string {
  return createHmac("sha256", seed)
    .update(`participant\0${participant}`, "utf8")
    .digest("hex");
}

function extraArm(seed: string): PilotArm {
  const byte = createHmac("sha256", seed)
    .update("odd-participant-extra-arm", "utf8")
    .digest()[0]!;
  return byte % 2 === 0 ? "enhanced" : "comparison";
}

function normalizedParticipants(participants: string[]): string[] {
  return participants.map((participant) => participant.trim()).filter(Boolean);
}

export function createPilotRoster(input: {
  participants: string[];
  seed: string;
  contentVersion: string;
  enhancedChannel: Exclude<StudyChannel, "none">;
  dailyMinutes: number;
}): PilotRoster {
  const participants = normalizedParticipants(input.participants);
  const errors: string[] = [];

  if (!input.seed) errors.push("assignment seed is required");
  if (!input.contentVersion.trim()) errors.push("content version is required");
  if (!["draft", "released"].includes(input.enhancedChannel)) {
    errors.push("enhanced channel must be draft or released");
  }
  if (!Number.isInteger(input.dailyMinutes) || input.dailyMinutes < 1 || input.dailyMinutes > 240) {
    errors.push("daily minutes must be an integer from 1 to 240");
  }
  if (participants.length < 2) {
    errors.push("at least two participant codes are required");
  }

  const seen = new Set<string>();
  for (const participant of participants) {
    if (!validParticipant(participant)) {
      errors.push(`invalid participant code ${participant}`);
    }
    if (seen.has(participant)) {
      errors.push(`duplicate participant code ${participant}`);
    }
    seen.add(participant);
  }

  if (errors.length) throw new Error(errors.join("\n"));

  const ordered = participants
    .map((participant) => ({
      participant,
      key: allocationKey(input.seed, participant),
    }))
    .sort((a, b) => a.key.localeCompare(b.key) || a.participant.localeCompare(b.participant))
    .map((row) => row.participant);

  const extra = participants.length % 2 ? extraArm(input.seed) : null;
  const enhancedTarget =
    Math.floor(participants.length / 2) + (extra === "enhanced" ? 1 : 0);

  const assignments = ordered.map((participant, index): PilotRosterAssignment => {
    const arm: PilotArm = index < enhancedTarget ? "enhanced" : "comparison";
    return {
      participant,
      arm,
      channel: arm === "enhanced" ? input.enhancedChannel : "none",
    };
  });

  return {
    kind: PILOT_ROSTER_KIND,
    version: PILOT_ROSTER_VERSION,
    seedFingerprint: pilotRosterSeedFingerprint(input.seed),
    protocol: {
      studyExportVersion: STUDY_VERSION,
      contentVersion: input.contentVersion.trim(),
      enhancedChannel: input.enhancedChannel,
      comparisonChannel: "none",
      dailyMinutes: input.dailyMinutes,
      assessment: {
        id: ASSESSMENT_PROTOCOL_ID,
        minimumDelayDays: ASSESSMENT_MIN_DELAY_DAYS,
        bankContentVersion: input.contentVersion.trim(),
      },
    },
    assignments,
  };
}

export function validatePilotRoster(
  roster: PilotRoster,
  seed?: string,
): string[] {
  const errors: string[] = [];

  if (roster.kind !== PILOT_ROSTER_KIND) {
    errors.push(`roster kind must be ${PILOT_ROSTER_KIND}`);
  }
  if (roster.version !== PILOT_ROSTER_VERSION) {
    errors.push(`roster version must be ${PILOT_ROSTER_VERSION}`);
  }
  if (!/^[a-f0-9]{64}$/.test(roster.seedFingerprint ?? "")) {
    errors.push("roster seed fingerprint must be a SHA-256 hex digest");
  }
  if (
    seed !== undefined &&
    roster.seedFingerprint !== pilotRosterSeedFingerprint(seed)
  ) {
    errors.push("provided assignment seed does not match the roster fingerprint");
  }

  const protocol = roster.protocol;
  if (!protocol || typeof protocol !== "object") {
    errors.push("roster protocol is missing");
    return errors;
  }
  if (protocol.studyExportVersion !== STUDY_VERSION) {
    errors.push(
      `roster study export version must be ${STUDY_VERSION}`,
    );
  }
  if (!protocol.contentVersion) errors.push("roster content version is missing");
  if (!["draft", "released"].includes(protocol.enhancedChannel)) {
    errors.push("roster enhanced channel must be draft or released");
  }
  if (protocol.comparisonChannel !== "none") {
    errors.push("roster comparison channel must be none");
  }
  if (
    !Number.isInteger(protocol.dailyMinutes) ||
    protocol.dailyMinutes < 1 ||
    protocol.dailyMinutes > 240
  ) {
    errors.push("roster daily minutes must be an integer from 1 to 240");
  }
  if (protocol.assessment?.id !== ASSESSMENT_PROTOCOL_ID) {
    errors.push(
      `roster assessment protocol must be ${ASSESSMENT_PROTOCOL_ID}`,
    );
  }
  if (
    protocol.assessment?.minimumDelayDays !== ASSESSMENT_MIN_DELAY_DAYS
  ) {
    errors.push(
      `roster assessment minimum delay must be ${ASSESSMENT_MIN_DELAY_DAYS} days`,
    );
  }
  if (
    protocol.assessment?.bankContentVersion !== protocol.contentVersion
  ) {
    errors.push("roster assessment-bank version must match content version");
  }

  if (!Array.isArray(roster.assignments) || roster.assignments.length < 2) {
    errors.push("roster must contain at least two assignments");
    return errors;
  }

  const seen = new Set<string>();
  let enhanced = 0;
  let comparison = 0;
  for (const assignment of roster.assignments) {
    if (!assignment || typeof assignment !== "object") {
      errors.push("roster assignment must be an object");
      continue;
    }
    if (!validParticipant(assignment.participant ?? "")) {
      errors.push(`invalid roster participant code ${assignment.participant ?? "(missing)"}`);
    }
    if (seen.has(assignment.participant)) {
      errors.push(`duplicate roster participant ${assignment.participant}`);
    }
    seen.add(assignment.participant);

    if (assignment.arm === "enhanced") {
      enhanced += 1;
      if (assignment.channel !== protocol.enhancedChannel) {
        errors.push(
          `${assignment.participant}: enhanced assignment must use channel ${protocol.enhancedChannel}`,
        );
      }
    } else if (assignment.arm === "comparison") {
      comparison += 1;
      if (assignment.channel !== "none") {
        errors.push(
          `${assignment.participant}: comparison assignment must use channel none`,
        );
      }
    } else {
      errors.push(`${assignment.participant}: invalid pilot arm`);
    }

    if (
      !STUDY_CHANNELS.includes(assignment.channel as StudyChannel)
    ) {
      errors.push(
        `${assignment.participant}: invalid roster channel ${assignment.channel}`,
      );
    }
  }

  if (Math.abs(enhanced - comparison) > 1) {
    errors.push(
      `roster arms are not balanced: ${enhanced} enhanced vs ${comparison} comparison`,
    );
  }

  return errors;
}

export function validatePilotRosterEvidence(
  roster: PilotRoster,
  records: PilotRosterObservedExport[],
): {
  errors: string[];
  summary: PilotRosterValidationSummary;
} {
  const errors = validatePilotRoster(roster);
  if (errors.length) {
    return {
      errors,
      summary: {
        assigned: Array.isArray(roster.assignments) ? roster.assignments.length : 0,
        assignedEnhanced: 0,
        assignedComparison: 0,
        observed: 0,
        observedEnhanced: 0,
        observedComparison: 0,
        missing: Array.isArray(roster.assignments) ? roster.assignments.length : 0,
        missingEnhanced: 0,
        missingComparison: 0,
      },
    };
  }
  const assignmentByParticipant = new Map(
    roster.assignments.map((assignment) => [assignment.participant, assignment]),
  );
  const observedParticipants = new Set<string>();
  let observedEnhanced = 0;
  let observedComparison = 0;

  for (const record of records) {
    const assignment = assignmentByParticipant.get(record.participant);
    if (!assignment) {
      errors.push(
        `${record.source}: participant ${record.participant || "(missing)"} is not present in the pilot roster`,
      );
      continue;
    }
    if (observedParticipants.has(record.participant)) {
      continue;
    }
    observedParticipants.add(record.participant);

    if (assignment.arm === "enhanced") observedEnhanced += 1;
    else observedComparison += 1;

    if (record.version !== roster.protocol.studyExportVersion) {
      errors.push(
        `${record.source}: export version ${record.version} does not match roster version ${roster.protocol.studyExportVersion}`,
      );
    }
    if (record.channel !== assignment.channel) {
      errors.push(
        `${record.source}: participant ${record.participant} was assigned to ${assignment.arm}/${assignment.channel} but exported channel ${record.channel ?? "(missing)"}`,
      );
    }
    if (record.contentVersion !== roster.protocol.contentVersion) {
      errors.push(
        `${record.source}: content version ${record.contentVersion ?? "(missing)"} does not match roster ${roster.protocol.contentVersion}`,
      );
    }
    if (
      record.assessmentBankContentVersion !==
      roster.protocol.assessment.bankContentVersion
    ) {
      errors.push(
        `${record.source}: assessment-bank version does not match the roster`,
      );
    }
    if (
      record.assessmentProtocol !== roster.protocol.assessment.id
    ) {
      errors.push(
        `${record.source}: assessment protocol does not match the roster`,
      );
    }
    if (
      record.assessmentMinimumDelayDays !==
      roster.protocol.assessment.minimumDelayDays
    ) {
      errors.push(
        `${record.source}: assessment minimum delay does not match the roster`,
      );
    }
    if (record.dailyMinutes !== roster.protocol.dailyMinutes) {
      errors.push(
        `${record.source}: daily minutes ${record.dailyMinutes ?? "(missing)"} do not match roster ${roster.protocol.dailyMinutes}`,
      );
    }
  }

  const assignedEnhanced = roster.assignments.filter(
    (assignment) => assignment.arm === "enhanced",
  ).length;
  const assignedComparison = roster.assignments.length - assignedEnhanced;
  const missingEnhanced = roster.assignments.filter(
    (assignment) =>
      assignment.arm === "enhanced" &&
      !observedParticipants.has(assignment.participant),
  ).length;
  const missingComparison = roster.assignments.filter(
    (assignment) =>
      assignment.arm === "comparison" &&
      !observedParticipants.has(assignment.participant),
  ).length;

  return {
    errors,
    summary: {
      assigned: roster.assignments.length,
      assignedEnhanced,
      assignedComparison,
      observed: observedParticipants.size,
      observedEnhanced,
      observedComparison,
      missing: roster.assignments.length - observedParticipants.size,
      missingEnhanced,
      missingComparison,
    },
  };
}
