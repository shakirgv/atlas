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

/** Which sections of a list are open. A fresh visit starts closed; coming back from a detail page reopens what was open. */
export function useOpenSections(alsoOpen?: string | null) {
  const params = useSearchParams();
  const [open, setOpen] = useState(() => {
    const ids = new Set(params.get("open")?.split(","));
    if (alsoOpen) ids.add(alsoOpen);
    return ids;
  });

  useEffect(() => setUrlParam("open", open.size ? [...open].join(",") : null), [open]);

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

  return { open, toggle, show };
}
