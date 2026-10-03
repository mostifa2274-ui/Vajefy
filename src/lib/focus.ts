import { useEffect, useRef, type RefObject } from "react";

/**
 * When `key` changes and the change left focus nowhere (the focused control was
 * removed), move focus to `target`, so keyboard and screen-reader users stay in
 * the task instead of starting again from the top of the page.
 */
export function useKeepFocus(target: RefObject<HTMLElement | null>, key: unknown) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const active = document.activeElement;
    if (!active || active === document.body) target.current?.focus({ preventScroll: true });
  }, [target, key]);
}
