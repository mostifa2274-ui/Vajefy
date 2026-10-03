import { CONTENT_CHANNEL } from "./learn/channel";

export type Section = "today" | "learn" | "words" | "progress";

/** Which of the four destinations a screen belongs to. */
export function sectionOf(pathname: string): Section {
  if (["/learn", "/study", "/drill"].some((path) => pathname.startsWith(path))) return "learn";
  if (["/lexicon", "/library"].some((path) => pathname.startsWith(path))) return "words";
  if (pathname.startsWith("/progress")) return "progress";
  return "today";
}

/** Where Learn opens: guided lessons, or Review when this build has none. */
export const LEARN_HOME = CONTENT_CHANNEL === "none" ? "/study" : "/learn";
