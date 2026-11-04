"use client";
import { useState } from "react";
import { CitiesView } from "@/components/cities/cities-view";
import { CityDetail } from "@/components/cities/city-detail";
import { CityEditDialog } from "@/components/cities/city-edit-dialog";
import { WorkspaceProvider, type Workspace } from "@/components/shell/workspace";
import { ConfirmProvider } from "@/components/ui/confirm";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { CityVM, PlaceVM } from "@/lib/data";
import type { PhotoPin } from "@/lib/photo-pins";
import { placeLinks } from "@/lib/place-duplicates";
import type { ItineraryDay, ItineraryItem, PhotoView } from "@/lib/types";

const city = (id: string, name: string, trip_country_id: string, country_name: string, country_code: string, flag: string, arrive_date: string | null, depart_date: string | null, lat: number | null, lng: number | null) =>
  ({ id, name, trip_country_id, country_name, country_code, flag, arrive_date, depart_date, lat, lng, order_index: 0, status: "planned", display: "planned", cover_url: null, cover_path: null, notes: "Take the **Yamanote** line.", timezone: "Asia/Tokyo", transport_mode: "train", transport_note: null }) as unknown as CityVM;

const TOKYO = city("tokyo", "Tokyo", "jp", "Japan", "JP", "🇯🇵", "2037-01-03", "2037-01-09", 35.68, 139.76);
const CITIES = [
  TOKYO,
  city("kyoto", "Kyoto", "jp", "Japan", "JP", "🇯🇵", "2037-01-09", "2037-01-12", 35.01, 135.77),
  city("osaka", "Osaka with a rather long name for the list to fold", "jp", "Japan", "JP", "🇯🇵", null, null, 34.69, 135.5),
  city("rome", "Rome", "it", "Italy", "IT", "🇮🇹", "2037-02-04", "2037-02-04", 41.9, 12.49),
  city("milan", "Milan", "it", "Italy", "IT", "🇮🇹", "2037-02-05", "2037-03-08", 45.46, 9.19),
];
const COUNTRIES = [
  { id: "jp", name: "Japan", flag: "🇯🇵" },
  { id: "it", name: "Italy", flag: "🇮🇹" },
];

const CATEGORIES = ["sight", "food", "cafe", "museum", "nature"];
const place = (id: string, name: string, status: string, category: string, lat: number | null, lng: number | null) =>
  ({ id, name, city_id: "tokyo", city_name: "Tokyo", status, category, rating: null, lat, lng, address: null, cover_url: null, country_code: "JP" }) as PlaceVM;
const PLACES = [
  place("p1", "Shibuya Crossing", "visited", "sight", 35.6595, 139.7005),
  place("p2", "Shibuya crossing", "want", "sight", 35.6596, 139.7006),
  place("p3", "Senso-ji", "planned", "sight", 35.7148, 139.7967),
  place("p4", "No pin yet", "want", "food", null, null),
  ...Array.from({ length: 28 }, (_, i) => place(`m${i}`, `Spot ${"abcdefghijklmnopqrstuvwxyz12"[i]} of the city`, i % 3 ? "want" : "planned", CATEGORIES[i % CATEGORIES.length]!, 35.65 + (i % 7) * 0.012, 139.68 + (i % 5) * 0.025)),
];

const swatch = (color: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="${color}"/></svg>`)}`;
const pin = (id: string, lat: number, lng: number, color: string) => ({ photo: { id, url: swatch(color), thumb_url: swatch(color), caption: `Photo ${id}` } as PhotoView, lat, lng, source: "gps", tripId: "t", tripCountryId: "jp", cityId: "tokyo", year: "2037", label: `Photo ${id}` }) as PhotoPin;
// The first one sits exactly on a place, which a photo linked to that place does.
const PINS = [pin("ph1", 35.7148, 139.7967, "#E8532F"), pin("ph2", 35.67, 139.74, "#0E7C7B"), pin("ph3", 35.70, 139.72, "#9B5DE5")];

const day = (id: string, day_number: number, date: string, title: string | null) => ({ id, trip_country_id: "jp", city_id: "tokyo", day_number, date, title, notes: null }) as ItineraryDay;
const DAYS = Array.from({ length: 7 }, (_, i) => day(`d${i}`, i + 1, `2037-01-0${i + 3}`, i ? null : "Arrive in Tokyo"));
const ITEMS = [{ id: "s1", day_id: "d0", place_id: "p1", title: "Shibuya Crossing", start_time: "18:00", done: false }, { id: "s2", day_id: "d1", place_id: "p1", title: "Back again", start_time: null, done: false }] as ItineraryItem[];

const WORKSPACE: Workspace = {
  userId: "u",
  email: null,
  settings: null,
  baseCurrency: "USD",
  displayName: "",
  trips: [{ id: "t", title: "World Tour", status: "planning", start_date: null, end_date: null, is_sample: false }],
  activeTripId: "t",
  isAll: false,
  countries: [],
  cities: [],
  vault: { hasPin: false, unlocked: false, pinLength: null, lockedUntil: null },
  sharingEnabled: false,
};

export function CitiesPreview({ show, few }: { show: "list" | "detail" | "edit"; few: boolean }) {
  const [open, setOpen] = useState(true);
  const places = few ? PLACES.slice(0, 4) : PLACES;
  return (
    <WorkspaceProvider value={{ ...WORKSPACE, openQuickAdd: () => {}, openPalette: () => {} }}>
      <TooltipProvider>
        <ConfirmProvider>
          {/* The same bar as the app, so the map has something to stick under. */}
          <header className="sticky top-0 z-30 flex h-14 items-center border-b border-border bg-bg/75 px-4 backdrop-blur-xl md:h-16 md:px-8">Preview</header>
          <main className="mx-auto w-full max-w-[1280px] px-4 pb-32 pt-6 md:px-8 md:pt-8">
            {show === "list" && <CitiesView cities={CITIES} countries={COUNTRIES} placeCounts={{ tokyo: 32, kyoto: 1 }} dayCounts={{ tokyo: 7, rome: 1 }} />}
            {show === "detail" && <CityDetail city={TOKYO} pins={PINS} stay={{ arrive: TOKYO.arrive_date, depart: TOKYO.depart_date }} attribution={null} places={places} days={DAYS} items={ITEMS} memories={[]} placeLinks={placeLinks(ITEMS, [])} previousStop="Baku" isFirstStop={false} />}
            {show === "edit" && <CityEditDialog open={open} onOpenChange={setOpen} city={TOKYO} previousStop="Baku" isFirstStop={false} />}
          </main>
        </ConfirmProvider>
      </TooltipProvider>
    </WorkspaceProvider>
  );
}
