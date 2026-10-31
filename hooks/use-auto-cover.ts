"use client";
import { useCallback } from "react";
import { useRouter } from "next/navigation";

export type CoverKind = "trip" | "country" | "city" | "place";

/** Request a cover for a single entity. Returns true when a photo was stored. */
export async function requestCover(kind: CoverKind, id: string, opts: { onlyIfEmpty?: boolean; query?: string } = {}) {
  try {
    const res = await fetch("/api/cover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, id, onlyIfEmpty: opts.onlyIfEmpty ?? true, query: opts.query }),
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { found?: boolean };
    return Boolean(json.found);
  } catch {
    return false;
  }
}

/**
 * Fetch covers in the background after creating entities (2 at a time),
 * then refresh the page once. Failures silently fall back to gradients.
 */
export function useAutoCover() {
  const router = useRouter();
  return useCallback(
    (kind: CoverKind, ids: string[]) => {
      if (!ids.length) return;
      void (async () => {
        let found = 0;
        const queue = [...ids];
        const worker = async () => {
          while (queue.length) {
            const id = queue.shift()!;
            if (await requestCover(kind, id)) found++;
          }
        };
        await Promise.all([worker(), worker()]);
        if (found) router.refresh();
      })();
    },
    [router],
  );
}
