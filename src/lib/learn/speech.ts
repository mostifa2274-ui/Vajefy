import { useSyncExternalStore } from "react";
import { useProgress } from "./store";

/**
 * One playback controller for the whole app, so only one sound plays at a time.
 *
 * A controlled clip (generated, reviewed audio from /audio) is always preferred.
 * Browser speech is only a fallback: depending on the browser and voice, it may
 * synthesise on the device or send the text to the browser vendor's speech
 * service. It is used only with an English voice, never with a voice for
 * another language, and every failure is reported instead of failing silently.
 */

export type PlaybackState = "idle" | "loading" | "playing" | "unavailable";
export type Accent = "en-GB" | "en-US";

export type Source = {
  /** A stable key for the button that started playback. */
  key: string;
  /** English text, used when no clip exists or the clip fails. */
  text: string;
  /** URL of a controlled clip, if one exists. */
  clip?: string;
  slow?: boolean;
};

type Snapshot = { key: string | null; state: PlaybackState };

const QUALITY_HINTS = ["Samantha", "Daniel", "Karen", "Moira", "Google", "Microsoft", "Natural", "Premium", "Enhanced"];
const VOICE_WAIT_MS = 1500;
const START_TIMEOUT_MS = 4000;

let snapshot: Snapshot = { key: null, state: "idle" };
const listeners = new Set<() => void>();
let audio: HTMLAudioElement | null = null;
let token = 0;

function set(next: Snapshot) {
  snapshot = next;
  for (const listener of listeners) listener();
}

/** Keep sentence punctuation for natural intonation; drop markup and notes. */
export function cleanSpeech(text: string): string {
  return text
    .replace(/[¹²³⁴⁵⁶⁷⁸⁹]/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^A-Za-z0-9'’.,!?;:\- ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function voices(): Promise<SpeechSynthesisVoice[]> {
  const synth = window.speechSynthesis;
  const now = synth.getVoices();
  if (now.length) return Promise.resolve(now);
  // Chrome and others load the voice list asynchronously.
  return new Promise((resolve) => {
    const done = () => {
      synth.removeEventListener?.("voiceschanged", done);
      resolve(synth.getVoices());
    };
    synth.addEventListener?.("voiceschanged", done);
    window.setTimeout(done, VOICE_WAIT_MS);
  });
}

export function bestVoice(list: SpeechSynthesisVoice[], accent: Accent): SpeechSynthesisVoice | undefined {
  return list
    .filter((voice) => voice.lang.toLowerCase().replace("_", "-").startsWith("en"))
    .map((voice) => {
      const lang = voice.lang.toLowerCase().replace("_", "-");
      let score = lang === accent.toLowerCase() ? 100 : 40;
      if (voice.localService) score += 8;
      if (QUALITY_HINTS.some((hint) => voice.name.includes(hint))) score += 12;
      if (/compact|espeak|festival/i.test(voice.name)) score -= 15;
      return { voice, score };
    })
    .sort((a, b) => b.score - a.score)[0]?.voice;
}

async function speak(text: string, accent: Accent, slow: boolean, mine: number): Promise<boolean> {
  if (typeof window === "undefined" || !window.speechSynthesis) return false;
  const clean = cleanSpeech(text);
  if (!clean) return false;
  const voice = bestVoice(await voices(), accent);
  if (mine !== token) return true;
  if (!voice) return false;
  return new Promise((resolve) => {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.voice = voice;
    utterance.lang = voice.lang;
    utterance.rate = slow ? 0.7 : 0.92;
    let started = false;
    const timeout = window.setTimeout(() => {
      if (!started) resolve(false);
    }, START_TIMEOUT_MS);
    utterance.onstart = () => {
      started = true;
      if (mine === token) set({ key: snapshot.key, state: "playing" });
    };
    utterance.onend = () => {
      window.clearTimeout(timeout);
      resolve(true);
    };
    utterance.onerror = (event) => {
      window.clearTimeout(timeout);
      // An interruption by the learner's next action is not a failure.
      resolve(event.error === "interrupted" || event.error === "canceled");
    };
    synth.speak(utterance);
  });
}

function playClip(url: string, slow: boolean, mine: number): Promise<boolean> {
  return new Promise((resolve) => {
    const element = new Audio(url);
    audio = element;
    element.preload = "auto";
    if (slow) {
      element.playbackRate = 0.75;
      element.preservesPitch = true;
    }
    element.onplaying = () => {
      if (mine === token) set({ key: snapshot.key, state: "playing" });
    };
    element.onended = () => resolve(true);
    element.onerror = () => resolve(false);
    void element.play().catch(() => resolve(false));
  });
}

export async function play(source: Source, accent: Accent = useProgress.getState().accent): Promise<boolean> {
  stop();
  const mine = ++token;
  set({ key: source.key, state: "loading" });
  let ok = false;
  if (source.clip) ok = await playClip(source.clip, Boolean(source.slow), mine);
  if (!ok && mine === token) ok = await speak(source.text, accent, Boolean(source.slow), mine);
  if (mine === token) set({ key: source.key, state: ok ? "idle" : "unavailable" });
  return ok;
}

export function stop() {
  token += 1;
  try {
    audio?.pause();
  } catch {
    // Already gone.
  }
  audio = null;
  try {
    if (typeof window !== "undefined") window.speechSynthesis?.cancel();
  } catch {
    // Speech is optional.
  }
  if (snapshot.state !== "idle" && snapshot.state !== "unavailable") set({ key: null, state: "idle" });
}

const server: Snapshot = { key: null, state: "idle" };

/** The playback state of one button. */
export function usePlayback(key: string): PlaybackState {
  const current = useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => snapshot,
    () => server,
  );
  return current.key === key ? current.state : "idle";
}

/** Fire-and-forget pronunciation for places without a playback button. */
export function speakEnglish(text: string, clip?: string) {
  void play({ key: `auto:${text}`, text, clip });
}

export function cancelSpeech() {
  stop();
}

/** Whether speech can work at all; listening questions need it or a clip. */
export function canSpeak(): boolean {
  return typeof window !== "undefined" && Boolean(window.speechSynthesis);
}
