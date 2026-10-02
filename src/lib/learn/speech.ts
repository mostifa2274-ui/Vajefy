export function speakEnglish(text: string) {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const clean = text
      .replace(/[¹²³⁴⁵⁶⁷⁸⁹]/g, "")
      .replace(/\([^)]*\)/g, " ")
      .replace(/[^A-Za-z0-9' -]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  } catch {
    /* synthesis is optional */
  }
}

export function cancelSpeech() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}
