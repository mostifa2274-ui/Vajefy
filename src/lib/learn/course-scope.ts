import type { ReviewSession } from "./session";
import type { LevelId } from "./types";

/** A1 learning stays within the course; older saves retain their other cards. */
export function inLearningScope(id: string, focus: LevelId): boolean {
  return focus !== "A1" || (id.startsWith("lex:A1:") && id.length > 7);
}

/** A mixed legacy session must be archived before starting a course-only one. */
export function reviewSessionInScope(session: ReviewSession, focus: LevelId): boolean {
  return focus !== "A1" || (
    session.focus === "A1" && session.queue.every(item => inLearningScope(item.id, focus))
  );
}
