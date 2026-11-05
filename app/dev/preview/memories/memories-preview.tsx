"use client";
import { MemoriesView } from "@/components/memories/memories-view";
import { MemoryDialog, MemoryEditDialog } from "@/components/forms/memory-composer";
import { WorkspaceProvider, type Workspace } from "@/components/shell/workspace";
import { ConfirmProvider } from "@/components/ui/confirm";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { MemoryVM } from "@/lib/data";
import type { MemoryFilters } from "@/lib/memory-filters";
import type { PhotoView } from "@/lib/types";

const COUNTRIES = [
  { id: "jp", code: "JP", name: "Japan", flag: "🇯🇵" },
  { id: "it", code: "IT", name: "Italy", flag: "🇮🇹" },
];
const CITIES = [
  { id: "tokyo", name: "Tokyo", trip_country_id: "jp", lat: 35.68, lng: 139.76 },
  { id: "kyoto", name: "Kyoto", trip_country_id: "jp", lat: 35.01, lng: 135.77 },
  { id: "rome", name: "Rome", trip_country_id: "it", lat: 41.9, lng: 12.49 },
];
const PLACES = [
  { id: "senso", name: "Senso-ji", city_id: "tokyo", lat: 35.7148, lng: 139.7967 },
  { id: "inari", name: "Fushimi Inari", city_id: "kyoto", lat: 34.9671, lng: 135.7727 },
];
const DAYS = [
  { id: "d1", trip_country_id: "jp", day_number: 1, date: "2037-01-03", city_id: "tokyo", title: "Arrive in Tokyo" },
  { id: "d6", trip_country_id: "jp", day_number: 6, date: "2037-01-09", city_id: "kyoto", title: null },
];

const swatch = (color: string, w: number, h: number) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${color}"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w, h) / 5}" fill="white" opacity=".5"/></svg>`)}`;
const photo = (id: string, color: string, w = 1600, h = 1067, gps?: [number, number], taken_at: string | null = null) =>
  ({ id, url: swatch(color, w, h), thumb_url: swatch(color, w / 4, h / 4), caption: null, width: w, height: h, lat: gps?.[0] ?? null, lng: gps?.[1] ?? null, taken_at, source: "upload", entity_type: "memory", entity_id: "x" }) as unknown as PhotoView;

const LONG = `We woke before dawn to beat the crowds. The gates go on and on up the mountain, and the light changes every few minutes.

- Took the **Keihan line** from Gion-Shijo
- Stopped for kitsune udon halfway up
- The fox statues all have a key or a scroll in their mouths

By the time we reached the top the sun was out and the whole city was below us. A long, quiet climb, and worth every step. We sat on a bench for half an hour and watched the haze lift off the rooftops.

On the way down we took the side path through the bamboo and saw almost nobody.`;

const mem = (id: string, date: string, over: Partial<MemoryVM>): MemoryVM =>
  ({ id, date, trip_id: "t", trip_country_id: null, city_id: null, place_id: null, itinerary_day_id: null, title: null, body: null, mood: null, tags: [], photos: [], user_id: "u", created_at: date, ...over }) as MemoryVM;

const MEMORIES: MemoryVM[] = [
  mem("m1", "2037-02-04", { title: "Cornetto in Trastevere", body: "Best breakfast of the trip. The barista drew a heart in the foam.", trip_country_id: "it", city_id: "rome", tags: ["food", "coffee"], mood: "😋", photos: [photo("r1", "#C8553D", 1200, 1600)] }),
  mem("m2", "2037-01-09", { title: "Fushimi Inari at dawn", body: LONG, trip_country_id: "jp", city_id: "kyoto", place_id: "inari", itinerary_day_id: "d6", tags: ["hike", "temples"], mood: "🌅", photos: [photo("k1", "#E8532F", 1600, 1067, [34.9671, 135.7727], "2037-01-09T06:12:00Z"), photo("k2", "#F2A541"), photo("k3", "#0E7C7B"), photo("k4", "#9B5DE5")] }),
  mem("m3", "2037-01-05", { title: "Rainy evening", body: "Just stayed in and wrote postcards. No photos today.", trip_country_id: "jp", city_id: "tokyo", tags: ["slow"] }),
  mem("m4", "2037-01-03", { title: "Senso-ji", body: "Incense, lanterns and far too many people.", trip_country_id: "jp", city_id: "tokyo", place_id: "senso", itinerary_day_id: "d1", tags: ["temples"], photos: [photo("t1", "#3D5A80"), photo("t2", "#98C1D9", 1067, 1600)] }),
  mem("m5", "2036-12-20", { body: "Packing list done. Can't sleep.", tags: ["before"] }),
  mem("m6", "2036-12-18", { title: "Visa photos", body: "No place on this one, and a photo without GPS.", photos: [photo("v1", "#6A994E")] }),
];

const WORKSPACE: Workspace = {
  userId: "u",
  email: null,
  settings: null,
  baseCurrency: "USD",
  displayName: "Sam",
  trips: [{ id: "t", title: "World Tour", status: "planning", start_date: null, end_date: null, is_sample: false }],
  activeTripId: "t",
  isAll: false,
  countries: [
    { id: "jp", trip_id: "t", country_code: "JP", name: "Japan", flag: "🇯🇵" },
    { id: "it", trip_id: "t", country_code: "IT", name: "Italy", flag: "🇮🇹" },
  ] as Workspace["countries"],
  cities: CITIES as Workspace["cities"],
  vault: { hasPin: false, unlocked: false, pinLength: null, lockedUntil: null },
  sharingEnabled: false,
};

export function MemoriesPreview({ tab, filters, show }: { tab: string; filters: MemoryFilters; show: "new" | "edit" | null }) {
  return (
    <WorkspaceProvider value={{ ...WORKSPACE, openQuickAdd: () => {}, openPalette: () => {} }}>
      <TooltipProvider>
        <ConfirmProvider>
          <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-bg/75 px-4 backdrop-blur-xl md:h-16 md:px-8">Preview</header>
          <main className="mx-auto w-full max-w-[1280px] px-4 pb-32 pt-6 md:px-8 md:pt-8">
            <MemoriesView memories={MEMORIES} countries={COUNTRIES} cities={CITIES} places={PLACES} days={DAYS} focus={null} initialTab={tab} initialFilters={filters} />
          </main>
          {show === "new" && <MemoryDialog open onOpenChange={() => {}} preset={{ cityId: "kyoto" }} />}
          {show === "edit" && <MemoryEditDialog memory={MEMORIES[1]!} onOpenChange={() => {}} />}
        </ConfirmProvider>
      </TooltipProvider>
    </WorkspaceProvider>
  );
}
