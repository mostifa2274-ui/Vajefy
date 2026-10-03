import { useEffect, useRef } from "react";

/** Longest single response counted as active; longer gaps are treated as idle. */
export const MAX_ACTIVE_MS = 120_000;

/**
 * Time spent on the current question while the page was visible, in
 * milliseconds. It restarts whenever `key` changes and ignores time the tab
 * spent hidden, so it measures attention rather than wall-clock time.
 */
export function useActiveTime(key: string | undefined) {
  const state = useRef({ start: 0, hiddenAt: 0, hidden: 0 });

  useEffect(() => {
    state.current = { start: performance.now(), hiddenAt: 0, hidden: 0 };
  }, [key]);

  useEffect(() => {
    function onVisibility() {
      const now = performance.now();
      if (document.hidden) state.current.hiddenAt = now;
      else if (state.current.hiddenAt) {
        state.current.hidden += now - state.current.hiddenAt;
        state.current.hiddenAt = 0;
      }
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  return () => {
    const now = performance.now();
    const hiddenNow = state.current.hiddenAt ? now - state.current.hiddenAt : 0;
    const active = now - state.current.start - state.current.hidden - hiddenNow;
    return Math.max(0, Math.min(MAX_ACTIVE_MS, Math.round(active)));
  };
}
