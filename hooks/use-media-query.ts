"use client";
import { useSyncExternalStore } from "react";

export function useMediaQuery(query: string, serverValue = false) {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => serverValue,
  );
}

export function useIsDesktop() {
  return useMediaQuery("(min-width: 768px)", true);
}

export function useReducedMotion() {
  return useMediaQuery("(prefers-reduced-motion: reduce)", false);
}
