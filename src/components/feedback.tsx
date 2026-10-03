import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { useFormat } from "@/lib/learn/format";
import type { Copy } from "@/lib/learn/i18n";
import { Button } from "./ui";

/** How far through a session the learner is, as a bar and a count. */
export function ProgressMeter({ value, max, label, count = true }: { value: number; max: number; label: string; count?: boolean }) {
  const { num } = useFormat();
  const safe = Math.max(1, max);
  const clamped = Math.min(safe, Math.max(0, value));
  return (
    <div className="mb-3 flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={safe}
        aria-valuenow={clamped}
        aria-valuetext={`${num(clamped)} / ${num(safe)}`}
        className="h-1.5 flex-1 rounded-full bg-line"
      >
        <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.round((100 * clamped) / safe)}%` }} />
      </div>
      {count ? (
        <span className="text-xs text-muted tabular-nums" aria-hidden>
          {num(clamped)} / {num(safe)}
        </span>
      ) : null}
    </div>
  );
}

/**
 * A right or wrong marker that does not rely on colour: a visible symbol, and
 * words for screen readers.
 */
export function Mark({ ok, copy }: { ok: boolean; copy: Copy }) {
  return (
    <>
      <span aria-hidden>{ok ? "✓ " : "✗ "}</span>
      <span className="sr-only">{ok ? copy.markRight : copy.markWrong}: </span>
    </>
  );
}

/** A common mistake beside its correction, with the reason in Persian. */
export function WrongRight({ wrong, right, why, copy }: { wrong: string; right: string; why: string; copy: Copy }) {
  return (
    <div className="text-sm">
      <p lang="en" dir="ltr" className="text-bad">
        <Mark ok={false} copy={copy} />
        {wrong}
      </p>
      <p lang="en" dir="ltr" className="text-good">
        <Mark ok copy={copy} />
        {right}
      </p>
      <p lang="fa" dir="rtl" className="mt-1 text-muted text-pretty">
        {why}
      </p>
    </div>
  );
}

/**
 * The result of an answer and the single way on. The verdict is announced, and
 * focus moves to Next, because the answer controls are disabled once answered.
 */
export function AnswerFeedback({
  ok,
  title,
  children,
  nextLabel,
  onNext,
}: {
  ok: boolean;
  title: string;
  children?: ReactNode;
  nextLabel: string;
  onNext: () => void;
}) {
  const next = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    next.current?.focus({ preventScroll: true });
    next.current?.scrollIntoView({ block: "nearest" });
  }, []);
  return (
    <div className="mt-4 border-t border-line pt-4">
      <p role="status" className={cn("font-medium", ok ? "text-good" : "text-bad")}>
        <span aria-hidden>{ok ? "✓ " : "✗ "}</span>
        {title}
      </p>
      {children}
      <Button ref={next} className="mt-4 w-full" onClick={onNext}>
        {nextLabel}
      </Button>
    </div>
  );
}
