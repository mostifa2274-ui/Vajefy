import type { LessonSession } from "./lesson";
import type { SessionRecord } from "./session";

export const MIN_TIMED_LESSONS = 3;
export const DEFAULT_SECONDS_PER_NEW = 90;
const MIN_SECONDS_PER_NEW = 30;
const MAX_SECONDS_PER_NEW = 300;

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function completedTimedLessons(sessions: readonly SessionRecord[]): LessonSession[] {
  return sessions
    .filter((session): session is LessonSession => session.kind === "lesson")
    .filter(
      (session) =>
        session.mode === "lesson" &&
        session.status === "done" &&
        session.targets.length > 0 &&
        Boolean(session.timing?.length),
    );
}

export type LessonTimeProfile = {
  sessions: number;
  totalActiveMs: number;
  p50ActiveMsPerTarget: number | null;
  p50StepMs: number | null;
  teachMs: number;
  responseMs: number;
  feedbackMs: number;
  contextReadMs: number;
};

/**
 * Robust timing profile from completed guided lessons only.
 *
 * We intentionally use the median per-target active time, never raw response
 * latency, so accessibility-related slowness cannot shorten future lessons.
 * Fewer than three complete timed lessons are treated as insufficient evidence.
 */
export function lessonTimeProfile(sessions: readonly SessionRecord[]): LessonTimeProfile {
  const lessons = completedTimedLessons(sessions);
  const activePerTarget = lessons.flatMap((lesson) => {
    // Due-word recycling consumes the review budget and is estimated
    // separately by dailyPlan. Do not charge that time to newly taught words
    // or the displayed duration would double-count review work.
    const active = (lesson.timing ?? [])
      .filter((sample) => !(sample.kind === "check" && sample.role === "recycle"))
      .reduce((sum, sample) => sum + sample.activeMs, 0);
    return active > 0 ? [active / lesson.targets.length] : [];
  });
  const stepTimes = lessons.flatMap((lesson) => (lesson.timing ?? []).map((sample) => sample.activeMs).filter((ms) => ms > 0));
  const samples = lessons.flatMap((lesson) => lesson.timing ?? []);

  return {
    sessions: lessons.length,
    totalActiveMs: samples.reduce((sum, sample) => sum + sample.activeMs, 0),
    p50ActiveMsPerTarget: lessons.length >= MIN_TIMED_LESSONS ? median(activePerTarget) : null,
    p50StepMs: median(stepTimes),
    teachMs: samples.filter((sample) => sample.kind === "teach").reduce((sum, sample) => sum + sample.activeMs, 0),
    responseMs: samples.reduce((sum, sample) => sum + (sample.responseMs ?? 0), 0),
    feedbackMs: samples.reduce((sum, sample) => sum + (sample.feedbackMs ?? 0), 0),
    contextReadMs: samples
      .filter((sample) => sample.kind === "scene" || sample.kind === "contrast")
      .reduce((sum, sample) => sum + sample.activeMs, 0),
  };
}

/**
 * Planner input derived from real lesson distributions. Null means "not enough
 * evidence", so callers keep the preregistered fallback instead of pretending
 * a tiny sample is calibrated.
 */
export function measuredSecondsPerNew(sessions: readonly SessionRecord[]): number | null {
  const p50 = lessonTimeProfile(sessions).p50ActiveMsPerTarget;
  if (p50 === null) return null;
  return Math.max(MIN_SECONDS_PER_NEW, Math.min(MAX_SECONDS_PER_NEW, p50 / 1000));
}
