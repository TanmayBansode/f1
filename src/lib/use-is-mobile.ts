"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Returns true when the viewport is narrower than `breakpoint` px.
 *
 * Backed by `matchMedia` + `useSyncExternalStore`, so it never calls setState
 * inside an effect, updates exactly when the breakpoint is crossed (no resize
 * spam), and renders `false` on the server to keep hydration deterministic.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const query = `(max-width: ${breakpoint - 0.02}px)`;

  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query]
  );

  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  );
}
