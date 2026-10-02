import { useProgress } from "./store";

const QUALITY_HINTS = [
  "Samantha",
  "Daniel",
  "Karen",
  "Moira",
  "Google",
  "Microsoft",
  "Natural",
  "Premium",
  "Enhanced",
];

function cleanSpeech(text: string): string {
  return text
    .replace(/[¹²³⁴⁵⁶⁷⁸⁹]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^A-Za-z0-9' -]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function bestVoice(accent: "en-GB" | "en-US"): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return undefined;
  const base = accent.slice(0, 2).toLowerCase();
  return voices
    .map((voice) => {
      const lang = voice.lang.toLowerCase();
      let score = 0;
      if (lang === accent.toLowerCase()) score += 100;
      else if (lang.startsWith(base)) score += 40;
      if (voice.localService) score += 8;
      if (QUALITY_HINTS.some((hint) => voice.name.includes(hint))) score += 12;
      if (/compact|espeak|festival/i.test(voice.name)) score -= 15;
      return { voice, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.voice;
}

/**
 * Pronounce English with the learner's chosen dialect and the strongest
 * installed system voice. Audio remains local/offline and never sends text to
 * an application server.
 */
export function speakEnglish(text: string, accent = useProgress.getState().accent) {
  try {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const clean = cleanSpeech(text);
    if (!clean) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = accent;
    utterance.rate = 0.92;
    utterance.pitch = 1;
    const voice = bestVoice(accent);
    if (voice) utterance.voice = voice;
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
