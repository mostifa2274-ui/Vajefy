import { Link, type RegisteredRouter, type ValidateLinkOptions } from "@tanstack/react-router";
import { AudioLines } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useProgress } from "@/lib/learn/store";
import { speakEnglish } from "@/lib/learn/speech";

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
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
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

export function Num({ value }: { value: number }) {
  const lang = useProgress((state) => state.lang);
  const hydrated = useProgress((state) => state.hydrated);
  const text = hydrated
    ? new Intl.NumberFormat(lang === "fa" ? "fa-IR" : "en-US").format(value)
    : String(value);
  return <span className="tabular-nums">{text}</span>;
}

export function SpeakButton({ text, label }: { text: string; label: string }) {
  return (
    <button
      type="button"
      onClick={() => speakEnglish(text)}
      aria-label={label}
      className="inline-flex min-h-11 items-center gap-2 rounded-md bg-paper px-3 text-sm text-ink shadow-[var(--shadow-border)]"
    >
      <AudioLines className="size-4" aria-hidden />
      <span>{label}</span>
    </button>
  );
}

export function GoalRing({ value, goal, label }: { value: number; goal: number; label: string }) {
  const safe = Math.max(1, goal);
  const pct = Math.min(1, Math.max(0, value / safe));
  const radius = 28;
  const turn = 2 * Math.PI * radius;
  const filled = turn * pct;
  return (
    <div className="relative size-20 shrink-0" aria-label={label}>
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
      <div className="absolute inset-0 flex flex-col items-center justify-center">
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
