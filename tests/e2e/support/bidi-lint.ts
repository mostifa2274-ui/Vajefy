import type { Page } from "@playwright/test";

/**
 * Bidi lint (plan §14, U3): finds visible text that renders or reads in the
 * wrong direction or language.
 *
 * - DIRECTION: a run that is mostly Persian sits in a left-to-right context
 *   (or mostly English in a right-to-left one) and starts with a non-letter
 *   or ends with punctuation, a symbol or a bracket. The bidi algorithm puts
 *   those on the wrong side, as in "B2+" shown as "+B2".
 * - LANG_FA_IN_EN: Persian script inside an element whose language is English.
 * - SPLIT_RUN: two isolated English runs with only spaces or punctuation
 *   between them. The separators then lay out right to left, so
 *   "I'm a student. / She's tired." reads backwards and "am: I am" becomes
 *   ":am". One English stretch must be one isolate.
 * - LANG_EN_IN_FA: English inside an element whose language is Persian,
 *   alone or embedded in Persian text. Screen readers read it with a Persian
 *   voice.
 */
export type BidiFinding = {
  rule: "DIRECTION" | "LANG_FA_IN_EN" | "LANG_EN_IN_FA" | "SPLIT_RUN";
  text: string;
  direction: string;
  lang: string;
  where: string;
  html?: string;
};

export function bidiLint(page: Page): Promise<BidiFinding[]> {
  return page.evaluate(() => {
    const RTL = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
    const LTR = /[A-Za-z\u00C0-\u024F]/;
    const LETTER = /[\p{L}\p{M}]/u;

    /** The direction of the script most of the run's letters use. */
    function dominant(text: string): "rtl" | "ltr" | null {
      let rtl = 0;
      let ltr = 0;
      for (const char of text) {
        if (RTL.test(char)) rtl += 1;
        else if (LTR.test(char)) ltr += 1;
      }
      if (!rtl && !ltr) return null;
      return rtl >= ltr ? "rtl" : "ltr";
    }

    function where(element: Element): string {
      const parts: string[] = [];
      let current: Element | null = element;
      while (current && parts.length < 4 && current !== document.body) {
        const label = current.getAttribute("data-testid") ?? current.id;
        parts.unshift(label ? `${current.tagName.toLowerCase()}#${label}` : current.tagName.toLowerCase());
        current = current.parentElement;
      }
      return parts.join(" > ");
    }

    function visible(element: Element): boolean {
      const html = element as HTMLElement;
      if (typeof html.checkVisibility === "function" && !html.checkVisibility({ checkOpacity: false, checkVisibilityCSS: true })) {
        return false;
      }
      return html.getClientRects().length > 0;
    }

    const findings: BidiFinding[] = [];
    const seen = new Set<string>();
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const element = node.parentElement;
      if (!element || element.closest("script, style, noscript, template, svg, [aria-hidden='true']")) continue;
      const text = (node.textContent ?? "").replace(/\s+/g, " ").trim();
      if (!text || !visible(element)) continue;

      const direction = getComputedStyle(element).direction;
      const lang = (element.closest("[lang]")?.getAttribute("lang") ?? "").toLowerCase().split("-")[0] ?? "";
      const strong = dominant(text);
      const report = (rule: BidiFinding["rule"]) => {
        const key = `${rule}|${text}|${direction}|${lang}`;
        if (seen.has(key)) return;
        seen.add(key);
        findings.push({ rule, text: text.slice(0, 80), direction, lang, where: where(element), html: (element.parentElement ?? element).outerHTML.replace(/\s+/g, " ").slice(0, 400) });
      };

      // In the opposite context, a leading non-letter or a trailing neutral
      // (punctuation, symbol, bracket) lands on the wrong side. Trailing
      // digits are safe: they take the direction of the letters before them.
      if (strong && strong !== direction) {
        const chars = [...text];
        if (!LETTER.test(chars[0]!) || !/[\p{L}\p{M}\p{Nd}]/u.test(chars.at(-1)!)) report("DIRECTION");
      }
      if (lang === "en" && RTL.test(text)) report("LANG_FA_IN_EN");
      // English inside Persian must be marked as English; the Fa component
      // does this for content. A word is two Latin letters or more, or a lone
      // letter such as "I"; a letter joined to digits ("A1") is a code.
      if (lang === "fa" && /(?<![A-Za-z0-9])(?:[A-Za-z]{2,}|[A-Za-z](?![A-Za-z0-9]))/.test(text)) report("LANG_EN_IN_FA");
    }
    for (const isolate of document.querySelectorAll("bdi[lang='en'], [lang='en'][dir='ltr']")) {
      if (!visible(isolate)) continue;
      let between = "";
      let next: Node | null = isolate.nextSibling;
      while (next && next.nodeType === Node.TEXT_NODE) {
        between += next.textContent ?? "";
        next = next.nextSibling;
      }
      if (!(next instanceof Element) || next.getAttribute("lang") !== "en") continue;
      // Only pieces of one line: blocks, grid items and controls are separate.
      const inline = (element: Element) =>
        getComputedStyle(element).display.startsWith("inline") && !element.matches("button, a, input, textarea, select");
      if (!inline(isolate) || !inline(next)) continue;
      if (RTL.test(between) || /[A-Za-z]/.test(between)) continue;
      if (getComputedStyle(isolate.parentElement ?? isolate).direction !== "rtl") continue;
      const key = `SPLIT_RUN|${isolate.textContent}|${next.textContent}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        rule: "SPLIT_RUN",
        text: `${isolate.textContent}${between}${next.textContent}`.slice(0, 80),
        direction: "rtl",
        lang: "en",
        where: where(isolate),
        html: (isolate.parentElement ?? isolate).outerHTML.replace(/\s+/g, " ").slice(0, 400),
      });
    }
    return findings;
  });
}
