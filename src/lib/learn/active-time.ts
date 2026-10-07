import { useEffect, useRef } from "react";

/**
 * A visible step remains active for at most this long after the learner's most
 * recent interaction. This matches docs/LEARNING_MEASURES.md: idle time beyond
 * 60 seconds is excluded rather than merely capped after the fact.
 */
export const IDLE_TIMEOUT_MS = 60_000;

export class ActiveTimeCounter {
  private last: number;
  private activeUntil: number;
  private hidden: boolean;
  private total = 0;

  constructor(now: number, hidden = false) {
    this.last = now;
    this.hidden = hidden;
    this.activeUntil = hidden ? now : now + IDLE_TIMEOUT_MS;
  }

  private accrue(now: number) {
    const safe = Math.max(this.last, now);
    if (!this.hidden) {
      const activeEnd = Math.min(safe, this.activeUntil);
      if (activeEnd > this.last) this.total += activeEnd - this.last;
    }
    this.last = safe;
  }

  /** A learner interaction extends the active window from this instant. */
  activity(now: number) {
    this.accrue(now);
    this.activeUntil = Math.max(this.activeUntil, now + IDLE_TIMEOUT_MS);
  }

  hide(now: number) {
    this.accrue(now);
    this.hidden = true;
  }

  /**
   * Returning to the page is itself intentional activity: reading may continue
   * without an immediate key/pointer event.
   */
  show(now: number) {
    this.last = Math.max(this.last, now);
    this.hidden = false;
    this.activeUntil = Math.max(this.activeUntil, now + IDLE_TIMEOUT_MS);
  }

  /** Active-visible milliseconds accumulated up to now. */
  value(now: number): number {
    this.accrue(now);
    return Math.max(0, Math.round(this.total));
  }
}

/**
 * Active-visible time for one lesson step. The clock restarts when `key`
 * changes, excludes hidden-tab intervals and stops accruing after 60 seconds
 * without interaction. Pointer, keyboard, input, scroll and touch activity
 * resume the active window.
 */
export function useActiveTime(key: string | undefined) {
  const counter = useRef<ActiveTimeCounter | null>(null);

  useEffect(() => {
    counter.current = new ActiveTimeCounter(performance.now(), document.hidden);
  }, [key]);

  useEffect(() => {
    const activity = () => counter.current?.activity(performance.now());
    const visibility = () => {
      const now = performance.now();
      if (document.hidden) counter.current?.hide(now);
      else counter.current?.show(now);
    };

    document.addEventListener("visibilitychange", visibility);
    document.addEventListener("pointerdown", activity, { capture: true, passive: true });
    document.addEventListener("keydown", activity, { capture: true });
    document.addEventListener("input", activity, { capture: true });
    document.addEventListener("wheel", activity, { capture: true, passive: true });
    document.addEventListener("touchstart", activity, { capture: true, passive: true });
    return () => {
      document.removeEventListener("visibilitychange", visibility);
      document.removeEventListener("pointerdown", activity, true);
      document.removeEventListener("keydown", activity, true);
      document.removeEventListener("input", activity, true);
      document.removeEventListener("wheel", activity, true);
      document.removeEventListener("touchstart", activity, true);
    };
  }, []);

  return () => counter.current?.value(performance.now()) ?? 0;
}
