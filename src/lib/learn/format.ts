import { useMemo } from "react";
import { useProgress } from "./store";

/**
 * Number and percent formatting in the reader's language (Persian digits in
 * the Persian UI). Until the saved language loads it matches the server render.
 */
export function useFormat() {
  const lang = useProgress((state) => state.lang);
  const hydrated = useProgress((state) => state.hydrated);
  return useMemo(() => {
    const locale = lang === "fa" ? "fa-IR" : "en-US";
    const number = new Intl.NumberFormat(locale);
    const percent = new Intl.NumberFormat(locale, { style: "percent" });
    return {
      num: (value: number) => (hydrated ? number.format(value) : String(value)),
      pct: (ratio: number) => (hydrated ? percent.format(ratio) : `${Math.round(ratio * 100)}%`),
      /** Between items in a line. A middle dot beside Persian digits reads as zero (۰). */
      sep: lang === "fa" ? "، " : " · ",
    };
  }, [lang, hydrated]);
}
