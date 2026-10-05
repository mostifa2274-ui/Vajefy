import { Link, type RegisteredRouter, type ValidateLinkOptions } from "@tanstack/react-router";
import { AudioLines } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useFormat } from "@/lib/learn/format";
import { useCopy } from "@/lib/learn/i18n";
import { play, stop, usePlayback } from "@/lib/learn/speech";
import { useProgress } from "@/lib/learn/store";

const buttonClass = {
  primary: "bg-accent text-accent-fg hover:bg-ink",
  secondary: "bg-paper-2 text-ink shadow-[var(--shadow-border)] hover:bg-accent-soft",
  ghost: "text-ink hover:bg-accent-soft",
  quiet: "bg-transparent text-ink hover:bg-accent-soft",
} as const;

type Variant = keyof typeof buttonClass;

export function Button({
  variant = "primary",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & { variant?: Variant }) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-[background-color,scale] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.96] disabled:pointer-events-none disabled:opacity-40",
        buttonClass[variant],
        className,
      )}
      {...props}
    />
  );
}

export function ButtonLink({
  variant = "primary",
  className,
  children,
  ...link
}: {
  variant?: Variant;
  className?: string;
  children: ReactNode;
} & ValidateLinkOptions<RegisteredRouter>) {
  return (
    <Link
      {...link}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-[background-color,scale] duration-150 ease-[cubic-bezier(0.22,1,0.36,1)] active:scale-[0.96]",
        buttonClass[variant],
        className,
      )}
    >
      {children}
    </Link>
  );
}

/** A separator between items in a line: the Persian comma, or a middle dot in English. */
export function Sep() {
  const lang = useProgress((state) => state.lang);
  return lang === "fa" ? (
    <span>، </span>
  ) : (
    <span className="mx-2" aria-hidden>
      ·
    </span>
  );
}

export function Num({ value }: { value: number }) {
  const { num } = useFormat();
  return <span className="tabular-nums">{num(value)}</span>;
}

/**
 * Pronunciation with explicit loading, playing and failure states. A controlled
 * clip plays when one exists; browser speech is the fallback.
 */
export function SpeakButton({
  text,
  label,
  clip,
  slow = false,
  item,
  exposure = "listen",
  clipOnly = false,
}: {
  text: string;
  label: string;
  clip?: string;
  /** Play only the recorded clip, never browser speech. */
  clipOnly?: boolean;
  /** Also offer slower playback. */
  slow?: boolean;
  /** The learning item heard, recorded as an exposure. */
  item?: string;
  /** What was heard: the word itself or one of its examples. */
  exposure?: "listen" | "example";
}) {
  const lang = useProgress((state) => state.lang);
  const expose = useProgress((state) => state.expose);
  const copy = useCopy(lang);
  const key = `${clip ?? ""}|${text}`;
  const state = usePlayback(key);
  const slowState = usePlayback(`${key}|slow`);
  const busy = state === "loading" || state === "playing";
  const current = slowState !== "idle" ? slowState : state;
  const status =
    current === "loading" ? copy.audioLoading : current === "playing" ? copy.audioPlaying : current === "unavailable" ? copy.audioUnavailable : "";
  const base = "inline-flex min-h-11 items-center gap-2 rounded-md bg-paper px-3 text-sm text-ink shadow-[var(--shadow-border)]";
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => {
          if (busy) return stop();
          if (item) expose(item, exposure);
          void play({ key, text, clip, clipOnly });
        }}
        aria-label={label}
        aria-busy={state === "loading"}
        className={base}
      >
        <AudioLines className={cn("size-4", state === "playing" && "text-accent")} aria-hidden />
        <span>{label}</span>
      </button>
      {slow ? (
        <button
          type="button"
          onClick={() => {
            if (item) expose(item, exposure);
            void play({ key: `${key}|slow`, text, clip, slow: true, clipOnly });
          }}
          className={base}
        >
          {copy.slower}
        </button>
      ) : null}
      <span role="status" className={cn("text-xs", current === "unavailable" ? "text-bad" : "text-muted")}>
        {status}
      </span>
    </span>
  );
}

export function GoalRing({ value, goal, label }: { value: number; goal: number; label: string }) {
  const safe = Math.max(1, goal);
  const pct = Math.min(1, Math.max(0, value / safe));
  const radius = 28;
  const turn = 2 * Math.PI * radius;
  const filled = turn * pct;
  return (
    <div className="relative size-20 shrink-0" role="img" aria-label={`${label}: ${value} / ${goal}`}>
      <svg viewBox="0 0 72 72" className="size-20 -rotate-90" aria-hidden>
        <circle cx="36" cy="36" r={radius} fill="none" stroke="var(--color-line)" strokeWidth="6" />
        <circle
          cx="36"
          cy="36"
          r={radius}
          fill="none"
          stroke="var(--color-accent)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${turn - filled}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" aria-hidden>
        <span className="text-sm font-medium">
          <Num value={value} />
        </span>
        <span className="text-xs text-muted">
          / <Num value={goal} />
        </span>
      </div>
    </div>
  );
}

export function PageHeader({
  kicker,
  title,
  lede,
}: {
  kicker?: string;
  title: string;
  lede?: string;
}) {
  return (
    <header className="mb-6 max-w-2xl">
      {kicker ? <p className="text-sm text-accent">{kicker}</p> : null}
      <h1 className="mt-1 text-3xl font-medium text-balance">{title}</h1>
      {lede ? <p className="mt-2 max-w-xl text-pretty text-muted">{lede}</p> : null}
    </header>
  );
}
