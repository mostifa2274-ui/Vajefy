import { Mic, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { Copy } from "@/lib/learn/i18n";
import { play } from "@/lib/learn/speech";

/** Longest recording: enough for a word or a short example. */
const MAX_MS = 6000;

type State = "idle" | "asking" | "recording" | "recorded" | "denied" | "failed";

function supported(): boolean {
  return typeof window !== "undefined" && typeof MediaRecorder !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

/**
 * Speaking practice, first stage: record yourself, then compare with the
 * reference recording. The recording exists only in this page's memory: it
 * is never uploaded or saved, and it is discarded when the learner leaves.
 * There is no automatic score until one is calibrated against human judgement.
 */
export function SayIt({ text, clip, copy }: { text: string; clip?: string; copy: Copy }) {
  const [state, setState] = useState<State>("idle");
  const [mine, setMine] = useState<string | null>(null);
  const [available] = useState(supported);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);
  const player = useRef<HTMLAudioElement | null>(null);

  function release() {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
  }

  useEffect(
    () => () => {
      release();
      if (recorder.current?.state === "recording") recorder.current.stop();
    },
    [],
  );

  useEffect(
    () => () => {
      if (mine) URL.revokeObjectURL(mine);
    },
    [mine],
  );

  async function start() {
    setState("asking");
    try {
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.current = media;
      const chunks: Blob[] = [];
      const next = new MediaRecorder(media);
      next.ondataavailable = (event) => {
        if (event.data.size) chunks.push(event.data);
      };
      next.onstop = () => {
        release();
        const blob = new Blob(chunks, { type: next.mimeType || "audio/webm" });
        setMine(blob.size ? URL.createObjectURL(blob) : null);
        setState(blob.size ? "recorded" : "failed");
      };
      recorder.current = next;
      next.start();
      setState("recording");
      timer.current = window.setTimeout(() => next.state === "recording" && next.stop(), MAX_MS);
    } catch (error) {
      release();
      setState(error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError") ? "denied" : "failed");
    }
  }

  function stop() {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }

  function playMine() {
    if (!mine) return;
    player.current?.pause();
    player.current = new Audio(mine);
    void player.current.play().catch(() => setState("failed"));
  }

  if (!available) return null;
  const base = "inline-flex min-h-11 items-center gap-2 rounded-md bg-paper px-3 text-sm text-ink shadow-[var(--shadow-border)]";
  const status =
    state === "asking" || state === "recording"
      ? copy.sayRecording
      : state === "denied"
        ? copy.sayDenied
        : state === "failed"
          ? copy.sayFailed
          : "";

  return (
    <div className="mt-3">
      <p className="text-sm font-medium">{copy.sayTitle}</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {state === "recording" ? (
          <button type="button" className={base} onClick={stop}>
            <Square className="size-4 text-bad" aria-hidden />
            {copy.sayStop}
          </button>
        ) : (
          <button type="button" className={base} onClick={() => void start()} disabled={state === "asking"}>
            <Mic className="size-4" aria-hidden />
            {mine ? copy.sayAgain : copy.sayRecord}
          </button>
        )}
        {mine && state === "recorded" ? (
          <>
            <button type="button" className={base} onClick={playMine}>
              {copy.sayPlayMine}
            </button>
            <button type="button" className={base} onClick={() => void play({ key: `say|${clip ?? ""}|${text}`, text, clip })}>
              {copy.sayPlayModel}
            </button>
          </>
        ) : null}
        <span role="status" className={state === "denied" || state === "failed" ? "text-xs text-bad" : "text-xs text-muted"}>
          {status}
        </span>
      </div>
      <p className="mt-1 text-xs text-pretty text-muted">{copy.sayPrivacy}</p>
    </div>
  );
}
