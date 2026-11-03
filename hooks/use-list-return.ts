"use client";
import { useEffect } from "react";

const KEY = "atlas:countries-return";

type ListReturn = { href: string; y: number | null };

function read(): ListReturn | null {
  try {
    const o = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Partial<ListReturn> | null;
    return o && typeof o.href === "string" && o.href.startsWith("/") && !o.href.startsWith("//") ? { href: o.href, y: typeof o.y === "number" ? o.y : null } : null;
  } catch {
    return null;
  }
}

function write(value: ListReturn) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  } catch {}
}

const here = () => `${window.location.pathname}${window.location.search}`;

/** Keeps the list's filters in the address without asking the server for the page again. */
export function replaceListQuery(query: string) {
  const next = `${window.location.pathname}${query ? `?${query}` : ""}`;
  if (next !== here()) window.history.replaceState(null, "", next);
}

/** Called on the way into a country, so its breadcrumb and the Back button can both find this exact spot. */
export function rememberListSpot() {
  write({ href: here(), y: window.scrollY });
}

/** Where the breadcrumb leads: the list as it was left, or the plain list when arriving from anywhere else. */
export function listReturnHref() {
  return read()?.href ?? null;
}

/** Puts the list back where it was left, once, when coming back to the same filters. */
export function useRestoreListScroll() {
  useEffect(() => {
    const spot = read();
    if (spot?.y == null || spot.href !== here()) return;
    // Two frames: the router scrolls to the top of a new page on the first one.
    let inner = 0;
    const outer = requestAnimationFrame(() => {
      inner = requestAnimationFrame(() => {
        window.scrollTo(0, spot.y!);
        write({ href: spot.href, y: null });
      });
    });
    return () => {
      cancelAnimationFrame(outer);
      cancelAnimationFrame(inner);
    };
  }, []);
}
