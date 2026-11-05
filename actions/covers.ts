"use server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { countryFlag, countryName } from "@/lib/countries";
import { signPhotoPaths } from "@/lib/storage";
import { fail, must, ok } from "@/actions/_util";
import type { ActionResult } from "@/lib/types";

export type CoverRow = {
  id: string;
  kind: "country" | "city" | "place";
  name: string;
  flag: string;
  /** Countries: the trip's name when several are shown. Cities: the country's name. Places: city and country. */
  group: string;
  countryId: string;
  /** Places only: the city it is in, for the City filter. */
  cityId?: string;
  url: string | null;
  thumb: string | null;
};

/** Both uploads and fetched covers keep their thumbnail next to the full file, under this name. */
const thumbOf = (path: string) => path.replace(/\.webp$/, "_thumb.webp");

export type CoverRows = { countries: CoverRow[]; cities: CoverRow[]; places: CoverRow[] };

/** Every country, city and place in view, with what they use as a cover now. Loaded when the window opens, so the pages stay light. */
export async function loadCoverRows(tripIds: string[]): Promise<ActionResult<CoverRows>> {
  try {
    const { supabase } = await requireUser();
    const ids = z.array(z.uuid()).max(200).parse(tripIds);
    if (!ids.length) return ok({ countries: [], cities: [], places: [] });
    const [trips, tcs] = await Promise.all([
      supabase.from("trips").select("id, title").in("id", ids).then(must),
      supabase.from("trip_countries").select("id, trip_id, country_code, cover_path").in("trip_id", ids).order("order_index").then(must),
    ]);
    const cities = tcs.length ? must(await supabase.from("cities").select("id, name, trip_country_id, cover_path").in("trip_country_id", tcs.map((c) => c.id)).order("order_index")) : [];
    const places = cities.length ? must(await supabase.from("places").select("id, name, city_id, cover_path").in("city_id", cities.map((c) => c.id)).order("name")) : [];
    const paths = [...tcs, ...cities, ...places].map((r) => r.cover_path).filter((p): p is string => Boolean(p));
    const urls = await signPhotoPaths(supabase, [...paths, ...paths.map(thumbOf)]);
    const urlOf = (path: string | null) => (path ? (urls[path] ?? null) : null);
    const thumb = (path: string | null) => (path ? (urls[thumbOf(path)] ?? urls[path] ?? null) : null);
    const titles = new Map(trips.map((t) => [t.id, t.title]));
    const byId = new Map(tcs.map((c) => [c.id, c]));
    const cityById = new Map(cities.map((c) => [c.id, c]));
    return ok({
      countries: tcs.map((c) => {
        const code = c.country_code.trim();
        return { id: c.id, kind: "country" as const, name: countryName(code), flag: countryFlag(code), group: ids.length > 1 ? (titles.get(c.trip_id) ?? "") : "", countryId: c.id, url: urlOf(c.cover_path), thumb: thumb(c.cover_path) };
      }),
      cities: cities.map((c) => {
        const code = byId.get(c.trip_country_id)?.country_code.trim();
        return { id: c.id, kind: "city" as const, name: c.name, flag: countryFlag(code), group: countryName(code), countryId: c.trip_country_id, url: urlOf(c.cover_path), thumb: thumb(c.cover_path) };
      }),
      places: places.map((p) => {
        const city = cityById.get(p.city_id);
        const code = city ? byId.get(city.trip_country_id)?.country_code.trim() : undefined;
        return {
          id: p.id,
          kind: "place" as const,
          name: p.name,
          flag: countryFlag(code),
          group: [city?.name, code ? countryName(code) : null].filter(Boolean).join(", "),
          countryId: city?.trip_country_id ?? "",
          cityId: p.city_id,
          url: urlOf(p.cover_path),
          thumb: thumb(p.cover_path),
        };
      }),
    });
  } catch (e) {
    return fail(e);
  }
}
