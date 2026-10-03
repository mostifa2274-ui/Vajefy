try {
  // The progress database is asynchronous, so the interface language is
  // mirrored to a small synchronous key for the first paint. Older saves kept
  // it inside the original localStorage entry.
  let lang = localStorage.getItem("vajefy-lang");
  if (!lang) {
    const raw = localStorage.getItem("roshana-v1");
    lang = raw ? JSON.parse(raw)?.state?.lang : null;
  }
  if (lang === "en") {
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
  }
} catch {
  // A malformed or unavailable localStorage entry must never block rendering.
}
