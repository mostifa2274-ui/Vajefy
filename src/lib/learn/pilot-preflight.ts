import type {
  Pilot,
  PilotSelectionProvenance,
  Review,
} from "./content";
import {
  validatePilotRoster,
  type PilotRoster,
} from "./pilot-roster";

export const LEARNING_PILOT_MIN_PARTICIPANTS = 20;
export const LEARNING_PILOT_MAX_PARTICIPANTS = 40;

export type PilotPreflightPhase = "usability" | "learning";

export type PilotPreflightSelection = {
  ids: string[];
  provenance: PilotSelectionProvenance;
};

export type PilotPreflightInput = {
  phase: PilotPreflightPhase;
  pilot: Pilot;
  selection: PilotPreflightSelection;
  roster?: PilotRoster | null;
  seed?: string;
};

export type PilotPreflightReport = {
  phase: PilotPreflightPhase;
  ready: boolean;
  generatedFrom: {
    contentVersion: string;
    pilotSelection: PilotSelectionProvenance;
  };
  summary: {
    selectedEntries: number;
    presentEntries: number;
    machineReadyEntries: number;
    bilingualApprovedEntries: number;
    pronunciationApprovedEntries: number;
    fullyApprovedEntries: number;
    releasedEntries: number;
    rosterParticipants: number | null;
    enhancedRosterParticipants: number | null;
    comparisonRosterParticipants: number | null;
  };
  blockers: string[];
  nextActions: string[];
  evidenceBoundary: {
    usability: string;
    learning: string;
    humanReview: string;
    effectiveness: string;
  };
};

function currentApproval(
  review: Review | null,
  version: string,
  dimension: "bilingual" | "pronunciation",
): boolean {
  return Boolean(review && review.version === version && review[dimension] === "approved");
}

function audioComplete(
  pilot: Pilot,
  entry: Pilot["entries"][number],
): boolean {
  return entry.senses.every((sense) =>
    (["gb", "us"] as const).every((accent) => {
      const clips = pilot.audio[sense.id]?.[accent];
      return Boolean(
        clips?.word &&
          clips.examples.length === sense.examples.length &&
          clips.examples.every(Boolean),
      );
    }),
  );
}

function machineReady(
  pilot: Pilot,
  entry: Pilot["entries"][number],
): boolean {
  return (
    entry.senses.length > 0 &&
    entry.senses.every((sense) => sense.check.length >= 3) &&
    audioComplete(pilot, entry)
  );
}

function sameSelection(
  actual: PilotSelectionProvenance,
  expected: PilotSelectionProvenance,
): boolean {
  return (
    actual.version === expected.version &&
    actual.level === expected.level &&
    actual.entries === expected.entries &&
    actual.fingerprint === expected.fingerprint
  );
}

export function evaluatePilotPreflight(
  input: PilotPreflightInput,
): PilotPreflightReport {
  const blockers: string[] = [];
  const nextActions: string[] = [];
  const selectedIds = input.selection.ids;
  const uniqueIds = new Set(selectedIds);
  const byId = new Map(input.pilot.entries.map((entry) => [entry.id, entry]));

  if (selectedIds.length !== input.selection.provenance.entries) {
    blockers.push(
      `pilot-selection-count:${selectedIds.length}/${input.selection.provenance.entries}`,
    );
  }
  if (uniqueIds.size !== selectedIds.length) {
    blockers.push(
      `pilot-selection-duplicates:${selectedIds.length - uniqueIds.size}`,
    );
  }
  if (!sameSelection(input.pilot.pilotSelection, input.selection.provenance)) {
    blockers.push("pilot-selection-provenance-mismatch");
  }

  const selectedEntries = selectedIds.flatMap((id) => {
    const entry = byId.get(id);
    return entry ? [entry] : [];
  });
  const missingEntries = selectedIds.filter((id) => !byId.has(id));
  if (missingEntries.length) {
    blockers.push(`missing-enhanced-content:${missingEntries.length}`);
  }

  const machineReadyEntries = selectedEntries.filter((entry) =>
    machineReady(input.pilot, entry),
  ).length;
  const bilingualApprovedEntries = selectedEntries.filter((entry) =>
    currentApproval(entry.review, entry.version, "bilingual"),
  ).length;
  const pronunciationApprovedEntries = selectedEntries.filter((entry) =>
    currentApproval(entry.review, entry.version, "pronunciation"),
  ).length;
  const fullyApprovedEntries = selectedEntries.filter(
    (entry) =>
      currentApproval(entry.review, entry.version, "bilingual") &&
      currentApproval(entry.review, entry.version, "pronunciation"),
  ).length;
  const releasedEntries = selectedEntries.filter((entry) => entry.released)
    .length;

  if (machineReadyEntries !== selectedIds.length) {
    blockers.push(
      `machine-readiness:${machineReadyEntries}/${selectedIds.length}`,
    );
    nextActions.push("restore-machine-ready-pilot-content");
  }

  let rosterParticipants: number | null = null;
  let enhancedRosterParticipants: number | null = null;
  let comparisonRosterParticipants: number | null = null;

  if (input.phase === "learning") {
    if (bilingualApprovedEntries !== selectedIds.length) {
      blockers.push(
        `bilingual-review:${selectedIds.length - bilingualApprovedEntries}`,
      );
      nextActions.push("complete-bilingual-review");
    }
    if (pronunciationApprovedEntries !== selectedIds.length) {
      blockers.push(
        `pronunciation-review:${
          selectedIds.length - pronunciationApprovedEntries
        }`,
      );
      nextActions.push("complete-pronunciation-review");
    }
    if (fullyApprovedEntries !== selectedIds.length) {
      nextActions.push("rebuild-released-content-after-review");
    }
    if (releasedEntries !== selectedIds.length) {
      blockers.push(
        `released-pilot-content:${releasedEntries}/${selectedIds.length}`,
      );
      nextActions.push("rebuild-released-content-after-review");
    }

    if (!input.roster) {
      blockers.push("pilot-roster-missing");
      nextActions.push("generate-version-bound-pilot-roster");
    } else {
      const rosterErrors = validatePilotRoster(input.roster, input.seed);
      blockers.push(...rosterErrors.map((error) => `pilot-roster:${error}`));

      const assignments = Array.isArray(input.roster.assignments)
        ? input.roster.assignments
        : [];
      rosterParticipants = assignments.length;
      enhancedRosterParticipants = assignments.filter(
        (assignment) => assignment?.arm === "enhanced",
      ).length;
      comparisonRosterParticipants = assignments.filter(
        (assignment) => assignment?.arm === "comparison",
      ).length;

      if (
        rosterParticipants < LEARNING_PILOT_MIN_PARTICIPANTS ||
        rosterParticipants > LEARNING_PILOT_MAX_PARTICIPANTS
      ) {
        blockers.push(
          `pilot-roster-size:${rosterParticipants} (expected ${LEARNING_PILOT_MIN_PARTICIPANTS}-${LEARNING_PILOT_MAX_PARTICIPANTS})`,
        );
        nextActions.push("use-documented-learning-pilot-size");
      }

      const protocol = input.roster.protocol;
      if (protocol?.contentVersion !== input.pilot.version) {
        blockers.push("pilot-roster-content-version-mismatch");
        nextActions.push("regenerate-roster-for-current-content");
      }
      if (
        protocol?.assessment?.bankContentVersion !== input.pilot.version
      ) {
        blockers.push("pilot-roster-assessment-bank-version-mismatch");
        nextActions.push("regenerate-roster-for-current-content");
      }
      if (protocol?.enhancedChannel !== "released") {
        blockers.push(
          `pilot-roster-enhanced-channel:${protocol?.enhancedChannel ?? "(missing)"}`,
        );
        nextActions.push("use-released-enhanced-channel-for-learning-pilot");
      }
    }
  }

  return {
    phase: input.phase,
    ready: blockers.length === 0,
    generatedFrom: {
      contentVersion: input.pilot.version,
      pilotSelection: input.pilot.pilotSelection,
    },
    summary: {
      selectedEntries: selectedIds.length,
      presentEntries: selectedEntries.length,
      machineReadyEntries,
      bilingualApprovedEntries,
      pronunciationApprovedEntries,
      fullyApprovedEntries,
      releasedEntries,
      rosterParticipants,
      enhancedRosterParticipants,
      comparisonRosterParticipants,
    },
    blockers,
    nextActions: [...new Set(nextActions)],
    evidenceBoundary: {
      usability:
        "Usability preflight checks machine-ready content and exact pilot-selection provenance; draft content may be observed before human release approval.",
      learning:
        "Learning-pilot preflight additionally requires current bilingual and pronunciation approval, released enhanced content, and a valid version-bound released-channel roster.",
      humanReview:
        "This preflight is read-only. It never creates, infers, or upgrades bilingual or pronunciation approval.",
      effectiveness:
        "Passing preflight means the protocol may start; it is not evidence that Vajefy is effective.",
    },
  };
}
