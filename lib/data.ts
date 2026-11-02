import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { countryFlag, countryName, getCountry } from "@/lib/countries";
import { displayStatus } from "@/lib/status";
import { signPhotoPaths, withPhotoUrls } from "@/lib/storage";
import type {
  Booking,
  City,
  DisplayStatus,
  DocumentRow,
  EntryRequirement,
  Expense,
  ItineraryDay,
  ItineraryItem,
  Memory,
  PackingItem,
  Photo,
  PhotoView,
  Place,
  Trip,
  TripCountry,
} from "@/lib/types";

export type CountryVM = TripCountry & {
  code: string;
  name: string;
  flag: string;
  region: string;
  display: DisplayStatus;
  cover_url: string | null;
  trip_title: string;
};
export type CityVM = City & { cover_url: string | null; country_code: string; country_name: string; flag: string; display: DisplayStatus };
export type PlaceVM = Place & { cover_url: string | null; city_name: string; country_code: string };
export type MemoryVM = Memory & { photos: PhotoView[] };

export type Graph = {
  trips: (Trip & { cover_url: string | null })[];
  countries: CountryVM[];
  cities: CityVM[];
  places: PlaceVM[];
  days: ItineraryDay[];
  items: ItineraryItem[];
  expenses: Expense[];
  memories: MemoryVM[];
  documents: DocumentRow[];
  bookings: Booking[];
  packing: PackingItem[];
  entries: EntryRequirement[];
  photoCount: number;
};

type Opts = {
  places?: boolean;
  days?: boolean;
  expenses?: boolean;
  memories?: boolean | { limit: number };
  documents?: boolean;
  bookings?: boolean;
  packing?: boolean;
  entries?: boolean;
  photoCount?: boolean;
};

async function safe<T>(p: PromiseLike<{ data: T | null; error: unknown }>, fallback: T): Promise<T> {
  try {
    const r = await p;
    return (r.data ?? fallback) as T;
  } catch {
    return fallback;
  }
}

/** Load everything under the given trips (single user, small data → simple + fast). */
export async function loadGraph(supabase: ServerSupabase, allTrips: Trip[], tripIds: string[], opts: Opts = {}): Promise<Graph> {
  const trips = allTrips.filter((t) => tripIds.includes(t.id));
  const tripTitle = new Map(trips.map((t) => [t.id, t.title]));
  const none = tripIds.length === 0;

  const tcs = none ? [] : await safe(supabase.from("trip_countries").select("*").in("trip_id", tripIds).order("order_index"), [] as TripCountry[]);
  const tcIds = tcs.map((t) => t.id);
  const cities = tcIds.length ? await safe(supabase.from("cities").select("*").in("trip_country_id", tcIds).order("order_index"), [] as City[]) : [];
  const cityIds = cities.map((c) => c.id);

  const [places, days, expenses, memories, documents, bookings, packing, entries, photoCount] = await Promise.all([
    opts.places && cityIds.length ? safe(supabase.from("places").select("*").in("city_id", cityIds).order("created_at"), [] as Place[]) : Promise.resolve([] as Place[]),
    opts.days && tcIds.length ? safe(supabase.from("itinerary_days").select("*").in("trip_country_id", tcIds).order("day_number"), [] as ItineraryDay[]) : Promise.resolve([] as ItineraryDay[]),
    opts.expenses && !none ? safe(supabase.from("expenses").select("*").in("trip_id", tripIds).order("date", { ascending: false }), [] as Expense[]) : Promise.resolve([] as Expense[]),
    opts.memories && !none
      ? safe(
          (() => {
            const q = supabase.from("memories").select("*").in("trip_id", tripIds).order("date", { ascending: false }).order("created_at", { ascending: false });
            return typeof opts.memories === "object" ? q.limit(opts.memories.limit) : q;
          })(),
          [] as Memory[],
        )
      : Promise.resolve([] as Memory[]),
    opts.documents ? safe(supabase.from("documents").select("*").order("expiry_date", { ascending: true, nullsFirst: false }), [] as DocumentRow[]) : Promise.resolve([] as DocumentRow[]),
    opts.bookings && !none ? safe(supabase.from("bookings").select("*").in("trip_id", tripIds).order("start_at"), [] as Booking[]) : Promise.resolve([] as Booking[]),
    opts.packing && !none ? safe(supabase.from("packing_items").select("*").in("trip_id", tripIds).order("order_index"), [] as PackingItem[]) : Promise.resolve([] as PackingItem[]),
    opts.entries && tcIds.length ? safe(supabase.from("entry_requirements").select("*").in("trip_country_id", tcIds), [] as EntryRequirement[]) : Promise.resolve([] as EntryRequirement[]),
    opts.photoCount ? supabase.from("photos").select("id", { count: "exact", head: true }).eq("source", "upload").then((r) => r.count ?? 0) : Promise.resolve(0),
  ]);

  const dayIds = days.map((d) => d.id);
  const items = dayIds.length ? await safe(supabase.from("itinerary_items").select("*").in("day_id", dayIds).order("order_index"), [] as ItineraryItem[]) : [];

  const memIds = memories.map((m) => m.id);
  const memPhotos = memIds.length
    ? await safe(supabase.from("photos").select("*").eq("entity_type", "memory").in("entity_id", memIds).order("order_index"), [] as Photo[])
    : [];

  // One batched signing call for every cover + memory photo.
  const urls = await signPhotoPaths(supabase, [
    ...trips.map((t) => t.cover_path),
    ...tcs.map((t) => t.cover_path),
    ...cities.map((c) => c.cover_path),
    ...places.map((p) => p.cover_path),
    ...memPhotos.flatMap((p) => [p.path, p.thumb_path]),
  ]);
  const u = (p: string | null) => (p ? (urls[p] ?? null) : null);

  const countries: CountryVM[] = tcs.map((t) => {
    const code = t.country_code.trim();
    return {
      ...t,
      code,
      name: countryName(code),
      flag: countryFlag(code),
      region: getCountry(code)?.region ?? "",
      display: displayStatus(t.status, t.arrive_date, t.depart_date),
      cover_url: u(t.cover_path),
      trip_title: tripTitle.get(t.trip_id) ?? "",
    };
  });
  const cMap = new Map(countries.map((c) => [c.id, c]));
  const cityVMs: CityVM[] = cities.map((c) => {
    const tc = cMap.get(c.trip_country_id);
    return {
      ...c,
      cover_url: u(c.cover_path),
      country_code: tc?.code ?? "",
      country_name: tc?.name ?? "",
      flag: tc?.flag ?? "",
      display: displayStatus(c.status, c.arrive_date, c.depart_date),
    };
  });
  const cityMap = new Map(cityVMs.map((c) => [c.id, c]));
  const placeVMs: PlaceVM[] = places.map((p) => ({
    ...p,
    cover_url: u(p.cover_path),
    city_name: cityMap.get(p.city_id)?.name ?? "",
    country_code: cityMap.get(p.city_id)?.country_code ?? "",
  }));
  const photoViews: PhotoView[] = memPhotos.map((p) => ({ ...p, url: u(p.path), thumb_url: u(p.thumb_path) ?? u(p.path) }));
  const memoryVMs: MemoryVM[] = memories.map((m) => ({ ...m, photos: photoViews.filter((p) => p.entity_id === m.id) }));

  return {
    trips: trips.map((t) => ({ ...t, cover_url: u(t.cover_path) })),
    countries,
    cities: cityVMs,
    places: placeVMs,
    days,
    items,
    expenses,
    memories: memoryVMs,
    documents,
    bookings,
    packing,
    entries,
    photoCount,
  };
}

/** Photos attached to one entity, with signed URLs. */
export async function loadEntityPhotos(supabase: ServerSupabase, entityId: string) {
  const { data } = await supabase.from("photos").select("*").eq("entity_id", entityId).order("order_index");
  return withPhotoUrls(supabase, data ?? []);
}

/** Attribution text for a cover (shown for auto-fetched Wikimedia photos). */
export async function coverAttribution(supabase: ServerSupabase, path: string | null) {
  if (!path) return null;
  const { data } = await supabase.from("photos").select("attribution, source").eq("path", path).maybeSingle();
  return data?.source === "wikimedia" ? data.attribution : null;
}
