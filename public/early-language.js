try {
  const raw = localStorage.getItem("roshana-v1");
  const lang = raw ? JSON.parse(raw)?.state?.lang : null;
  if (lang === "en") {
    document.documentElement.lang = "en";
    document.documentElement.dir = "ltr";
  }
} catch {
  // A malformed or unavailable localStorage entry must never block rendering.
}
