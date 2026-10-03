import type { StoredEvent } from "./ops";
import type { SessionRecord } from "./session";

/**
 * The file a learner sends to the pilot study (docs/EVALUATION.md). It holds
 * learning evidence only: answers with their timing and context, exposures,
 * check-ups and the scheduler's outcomes, under a participant code the
 * researchers gave. Nothing identifies the learner. What they wrote in lessons
 * and practice is left out unless they choose to include it.
 */

export const STUDY_KIND = "vajefy-study";
export const STUDY_VERSION = 1;

/** Evidence the study analyses; settings changes and restores are left out. */
const STUDY_EVENTS = new Set(["review", "practice", "skip", "introduce", "exposure", "assessment", "undo", "forget", "reset"]);

export type StudyProfile = {
  lang: string;
  focus: string;
  goal: string;
  minutes: number;
  requestRetention: number;
  accent: string;
  sessionSize: number;
  newPerDay: number;
};

export type StudyExport = {
  kind: typeof STUDY_KIND;
  version: number;
  participant: string;
  exportedAt: string;
  includesWriting: boolean;
  app: { contentVersion: string | null; channel: string };
  profile: StudyProfile;
  events: StoredEvent[];
  sessions: SessionRecord[];
};

/** A participant code: 3–24 letters, digits or dashes, as researchers issue them. */
export function validParticipant(code: string): boolean {
  return /^[A-Za-z0-9-]{3,24}$/.test(code.trim());
}

/** Remove what the learner typed or wrote, keeping whether it was right. */
function withoutWriting(session: SessionRecord): SessionRecord {
  if (session.kind === "lesson") {
    return { ...session, answers: session.answers.map(({ given: _given, ...answer }) => answer) };
  }
  if (session.kind === "quiz") {
    return { ...session, answers: session.answers.map(({ typed: _typed, past: _past, pp: _pp, ...answer }) => answer) };
  }
  return session;
}

export function buildStudyExport(input: {
  participant: string;
  includeWriting: boolean;
  events: StoredEvent[];
  sessions: SessionRecord[];
  profile: StudyProfile;
  contentVersion: string | null;
  channel: string;
  now: Date;
}): StudyExport {
  return {
    kind: STUDY_KIND,
    version: STUDY_VERSION,
    participant: input.participant.trim(),
    exportedAt: input.now.toISOString(),
    includesWriting: input.includeWriting,
    app: { contentVersion: input.contentVersion, channel: input.channel },
    profile: input.profile,
    events: input.events
      .filter((event) => STUDY_EVENTS.has(event.type))
      .sort((a, b) => a.at - b.at || a.id.localeCompare(b.id)),
    sessions: input.sessions.map((session) => (input.includeWriting ? session : withoutWriting(session))),
  };
}

export function studyFileName(participant: string, now = new Date()): string {
  return `vajefy-study-${participant.trim()}-${now.toISOString().slice(0, 10)}.json`;
}
