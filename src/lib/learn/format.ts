import { useProgress } from "./store";
import type { Lang } from "./types";

export type Format = { num: (value: number) => string; pct: (ratio: number) => string; sep: string };

// Number formats are slow to build, and every number on screen asks for one,
// so each language's is built once and shared.
const formats = new Map<string, Format>();

/** Formatting for a language; before the saved language loads it matches the server render. */
export function formatFor(lang: Lang, hydrated: boolean): Format {
  const key = `${lang}:${hydrated}`;
  let format = formats.get(key);
  if (!format) {
    const locale = lang === "fa" ? "fa-IR" : "en-US";
    const number = hydrated ? new Intl.NumberFormat(locale) : null;
    const percent = hydrated ? new Intl.NumberFormat(locale, { style: "percent" }) : null;
    format = {
      num: (value) => (number ? number.format(value) : String(value)),
      pct: (ratio) => (percent ? percent.format(ratio) : `${Math.round(ratio * 100)}%`),
      /** Between items in a line. A middle dot beside Persian digits reads as zero (۰). */
      sep: lang === "fa" ? "، " : " · ",
    };
    formats.set(key, format);
  }
  return format;
}

/**
 * Number and percent formatting in the reader's language (Persian digits in
 * the Persian UI). Until the saved language loads it matches the server render.
 */
export function useFormat(): Format {
  const lang = useProgress((state) => state.lang);
  const hydrated = useProgress((state) => state.hydrated);
  return formatFor(lang, hydrated);
}
