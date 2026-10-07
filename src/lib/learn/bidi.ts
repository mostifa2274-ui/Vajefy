/**
 * Persian text often embeds English: "ضمیر I همیشه با حرف بزرگ نوشته می‌شود."
 * Splitting it into script runs lets each English run be isolated and marked
 * as English (plan §14, U3), so it keeps its own direction and punctuation
 * and screen readers voice it in English.
 */
export type TextRun = { text: string; latin: boolean };

const WORD = /[A-Za-z][A-Za-z0-9'’-]*/y;
// Between two English words: spaces, or a joiner such as + / & with spaces.
const JOIN = /(?:\s*[+/&]\s*|,?\s+)(?=[A-Za-z0-9])/y;
const NUMBER = /[0-9][0-9.,]*/y;
const SENTENCE_END = /[.!?]+(?=\s+\S)/y;

function match(pattern: RegExp, text: string, at: number): string | null {
  pattern.lastIndex = at;
  const found = pattern.exec(text);
  return found ? found[0] : null;
}

export function scriptRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let plain = "";
  let at = 0;
  while (at < text.length) {
    const word = match(WORD, text, at);
    if (!word) {
      plain += text[at];
      at += 1;
      continue;
    }
    let end = at + word.length;
    let words = 1;
    for (;;) {
      const join = match(JOIN, text, end);
      if (join === null) break;
      const next = match(WORD, text, end + join.length) ?? match(NUMBER, text, end + join.length);
      if (!next) break;
      end += join.length + next.length;
      words += 1;
    }
    // An English sentence keeps its full stop when Persian follows it.
    if (words > 1) {
      const stop = match(SENTENCE_END, text, end);
      if (stop) end += stop.length;
    }
    if (plain) runs.push({ text: plain, latin: false });
    plain = "";
    runs.push({ text: text.slice(at, end), latin: true });
    at = end;
  }
  if (plain) runs.push({ text: plain, latin: false });
  return runs;
}

/** The language of a short text whose language varies: Persian if it uses Arabic script. */
export function scriptLang(text: string): "fa" | "en" {
  return /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text) ? "fa" : "en";
}
