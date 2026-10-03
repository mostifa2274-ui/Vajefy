export type Section = "today" | "learn" | "words" | "progress";

/** Which of the four destinations a screen belongs to. */
export function sectionOf(pathname: string): Section {
  if (["/learn", "/study", "/drill"].some((path) => pathname.startsWith(path))) return "learn";
  if (["/lexicon", "/library"].some((path) => pathname.startsWith(path))) return "words";
  if (pathname.startsWith("/progress")) return "progress";
  return "today";
}
