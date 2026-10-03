/**
 * Runs inline in <head>, before the first paint. The progress database is
 * asynchronous, so the interface language is mirrored to a small synchronous
 * key; older saves kept it inside the original localStorage entry. Inline, it
 * costs no extra request before the page can render.
 */
export const EARLY_LANGUAGE = `try {
  let lang = localStorage.getItem("vajefy-lang");
  if (!lang) {
    const raw = localStorage.getItem("roshana-v1");
    lang = raw ? JSON.parse(raw)?.state?.lang : null;
  }
  if (lang === "en") {
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
  }
} catch {}`;
