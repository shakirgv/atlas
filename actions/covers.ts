"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { countryFlag, countryName } from "@/lib/countries";
import { signPhotoPaths } from "@/lib/storage";
import { fail, must, ok } from "@/actions/_util";
import type { ActionResult } from "@/lib/types";

export type CoverRow = {
  id: string;
  kind: "country" | "city";
  name: string;
  flag: string;
  /** Countries: the trip's name when several are shown. Cities: the country's name. */
  group: string;
  countryId: string;
  url: string | null;
  thumb: string | null;
};

/** Both uploads and fetched covers keep their thumbnail next to the full file, under this name. */
const thumbOf = (path: string) => path.replace(/\.webp$/, "_thumb.webp");

/** Every country and city in view, with what they use as a cover now. Loaded when the window opens, so the pages stay light. */
export async function loadCoverRows(tripIds: string[]): Promise<ActionResult<{ countries: CoverRow[]; cities: CoverRow[] }>> {
  try {
    const { supabase } = await requireUser();
    const ids = z.array(z.uuid()).max(200).parse(tripIds);
    if (!ids.length) return ok({ countries: [], cities: [] });
    const [trips, tcs] = await Promise.all([
      supabase.from("trips").select("id, title").in("id", ids).then(must),
      supabase.from("trip_countries").select("id, trip_id, country_code, cover_path").in("trip_id", ids).order("order_index").then(must),
    ]);
    const cities = tcs.length ? must(await supabase.from("cities").select("id, name, trip_country_id, cover_path").in("trip_country_id", tcs.map((c) => c.id)).order("order_index")) : [];
    const paths = [...tcs, ...cities].map((r) => r.cover_path).filter((p): p is string => Boolean(p));
    const urls = await signPhotoPaths(supabase, [...paths, ...paths.map(thumbOf)]);
    const urlOf = (path: string | null) => (path ? (urls[path] ?? null) : null);
    const thumb = (path: string | null) => (path ? (urls[thumbOf(path)] ?? urls[path] ?? null) : null);
    const titles = new Map(trips.map((t) => [t.id, t.title]));
    const byId = new Map(tcs.map((c) => [c.id, c]));
    return ok({
      countries: tcs.map((c) => {
        const code = c.country_code.trim();
        return { id: c.id, kind: "country" as const, name: countryName(code), flag: countryFlag(code), group: ids.length > 1 ? (titles.get(c.trip_id) ?? "") : "", countryId: c.id, url: urlOf(c.cover_path), thumb: thumb(c.cover_path) };
      }),
      cities: cities.map((c) => {
        const code = byId.get(c.trip_country_id)?.country_code.trim();
        return { id: c.id, kind: "city" as const, name: c.name, flag: countryFlag(code), group: countryName(code), countryId: c.trip_country_id, url: urlOf(c.cover_path), thumb: thumb(c.cover_path) };
      }),
    });
  } catch (e) {
    return fail(e);
  }
}
