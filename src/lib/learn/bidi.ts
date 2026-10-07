/**
 * Persian text often embeds English: "ضمیر I همیشه با حرف بزرگ نوشته می‌شود."
 * Splitting it into script runs lets each English run be isolated and marked
 * as English (plan §14, U3), so it keeps its own direction and punctuation
 * and screen readers voice it in English.
 */
export type TextRun = {
  text: string;
  latin: boolean;
  /** An English phrase of three words or more, best kept in one block. */
  long?: boolean;
};

// Persian letters and digits end an English run.
const PERSIAN = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/;
const LATIN = /[A-Za-z\u00C0-\u024F]/;
const WORD = /[A-Za-z\u00C0-\u024F0-9'\u2019-]/;
const SENTENCE_END = /^[.!?…]+/;

/**
 * An English run starts at a Latin letter and carries on, across spaces and
 * punctuation, to the last English word before the next Persian letter. The
 * browser's own bidi algorithm joins such a stretch the same way. Splitting it
 * into several isolates would lay the separators between them out right to
 * left: "I'm a student. / She's tired." would read backwards and "am: I am"
 * would become ":am".
 */
export function scriptRuns(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let plain = "";
  let at = 0;
  while (at < text.length) {
    if (!LATIN.test(text[at]!)) {
      plain += text[at];
      at += 1;
      continue;
    }
    let end = at;
    let words = 0;
    let scan = at;
    while (scan < text.length && !PERSIAN.test(text[scan]!)) {
      if (!WORD.test(text[scan]!)) {
        scan += 1;
        continue;
      }
      let next = scan;
      let latin = false;
      while (next < text.length && WORD.test(text[next]!)) {
        if (LATIN.test(text[next]!)) latin = true;
        next += 1;
      }
      if (latin) {
        end = next;
        words += 1;
      }
      scan = next;
    }
    // An English phrase owns its full stop; after a lone English word inside
    // a Persian sentence, the full stop is the Persian sentence's.
    if (words > 1) {
      const stop = SENTENCE_END.exec(text.slice(end));
      if (stop) end += stop[0].length;
    }
    if (plain) runs.push({ text: plain, latin: false });
    plain = "";
    runs.push({ text: text.slice(at, end), latin: true, ...(words >= 3 ? { long: true } : {}) });
    at = end;
  }
  if (plain) runs.push({ text: plain, latin: false });
  return runs;
}

/** The language of a short text whose language varies: Persian if it uses Arabic script. */
export function scriptLang(text: string): "fa" | "en" {
  return /[\u0600-\u06FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text) ? "fa" : "en";
}
