"use client";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";

/** Changes one query param without asking the server for the page again. Going back to the page finds it in the address. */
export function setUrlParam(name: string, value: string | null) {
  const url = new URL(window.location.href);
  if (url.searchParams.get(name) === value) return;
  if (value === null) url.searchParams.delete(name);
  else url.searchParams.set(name, value);
  window.history.replaceState(null, "", url);
}

/** A page's chosen view, in the address like its open sections. The first view is the default and leaves the address clean. */
export function useViewParam<T extends string>(views: readonly T[]) {
  const params = useSearchParams();
  const [view, setView] = useState<T>(() => views.find((v) => v === params.get("view")) ?? views[0]!);
  const change = useCallback(
    (next: T) => {
      setView(next);
      setUrlParam("view", next === views[0] ? null : next);
    },
    [views],
  );
  return [view, change] as const;
}

/**
 * Which sections of a list are open. A fresh visit starts closed; coming back from a detail page reopens what was open.
 * `param` names the address key, for a page that already uses "open" for something else.
 */
export function useOpenSections(alsoOpen?: string | null, param = "open") {
  const params = useSearchParams();
  const [open, setOpen] = useState(() => {
    const ids = new Set(params.get(param)?.split(",").filter(Boolean));
    if (alsoOpen) ids.add(alsoOpen);
    return ids;
  });

  useEffect(() => setUrlParam(param, open.size ? [...open].join(",") : null), [open, param]);

  const toggle = useCallback(
    (id: string) =>
      setOpen((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    [],
  );
  const show = useCallback((id: string) => setOpen((prev) => (prev.has(id) ? prev : new Set(prev).add(id))), []);

  /** Opens exactly these, e.g. every section at once, or none. */
  const setAll = useCallback((ids: string[]) => setOpen(new Set(ids)), []);

  return { open, toggle, show, setAll };
}
