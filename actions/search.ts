"use server";
import { requireUser } from "@/lib/auth";
import { countryFlag, countryName } from "@/lib/countries";
import { fail, ok } from "@/actions/_util";
import type { ActionResult } from "@/lib/types";

export type SearchItem = { id: string; group: "Trips" | "Countries" | "Cities" | "Places" | "Memories" | "Documents"; title: string; subtitle?: string; href: string; icon?: string };

/** Lightweight index for the command palette (all trips). */
export async function getSearchIndex(): Promise<ActionResult<SearchItem[]>> {
  try {
    const { supabase } = await requireUser();
    const [trips, tcs, cities, places, memories, docs] = await Promise.all([
      supabase.from("trips").select("id, title, start_date"),
      supabase.from("trip_countries").select("id, country_code, trip_id"),
      supabase.from("cities").select("id, name, trip_country_id"),
      supabase.from("places").select("id, name, category, city_id"),
      supabase.from("memories").select("id, title, date, body").order("date", { ascending: false }).limit(300),
      supabase.from("documents").select("id, title, type, expiry_date"),
    ]);
    const tripTitle = new Map((trips.data ?? []).map((t) => [t.id, t.title]));
    const tcMap = new Map((tcs.data ?? []).map((t) => [t.id, t]));
    const cityMap = new Map((cities.data ?? []).map((c) => [c.id, c]));
    const items: SearchItem[] = [
      ...(trips.data ?? []).map((t) => ({ id: t.id, group: "Trips" as const, title: t.title, href: `/trips/${t.id}` })),
      ...(tcs.data ?? []).map((t) => ({
        id: t.id,
        group: "Countries" as const,
        title: countryName(t.country_code),
        subtitle: tripTitle.get(t.trip_id),
        href: `/countries/${t.id}`,
        icon: countryFlag(t.country_code),
      })),
      ...(cities.data ?? []).map((c) => {
        const tc = tcMap.get(c.trip_country_id);
        return { id: c.id, group: "Cities" as const, title: c.name, subtitle: tc ? countryName(tc.country_code) : undefined, href: `/cities/${c.id}`, icon: tc ? countryFlag(tc.country_code) : undefined };
      }),
      ...(places.data ?? []).map((p) => ({ id: p.id, group: "Places" as const, title: p.name, subtitle: cityMap.get(p.city_id)?.name, href: `/places?open=${p.id}` })),
      ...(memories.data ?? []).map((m) => ({
        id: m.id,
        group: "Memories" as const,
        title: m.title || (m.body ?? "").slice(0, 60) || "Untitled memory",
        subtitle: m.date,
        href: `/memories?focus=${m.id}`,
      })),
      ...(docs.data ?? []).map((d) => ({ id: d.id, group: "Documents" as const, title: d.title, subtitle: d.expiry_date ? `Expires ${d.expiry_date}` : d.type, href: `/documents?open=${d.id}` })),
    ];
    return ok(items);
  } catch (e) {
    return fail(e);
  }
}
