"use client";
import Link from "next/link";
import { CitiesView } from "@/components/cities/cities-view";
import { ItineraryPlanner } from "@/components/itinerary/planner";
import { WorkspaceProvider, type Workspace } from "@/components/shell/workspace";
import { ConfirmProvider } from "@/components/ui/confirm";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { CityVM, CountryVM, PlaceVM } from "@/lib/data";
import type { ItineraryDay, ItineraryItem } from "@/lib/types";

const WORKSPACE: Workspace = {
  userId: "u",
  email: null,
  settings: null,
  baseCurrency: "USD",
  displayName: "",
  trips: [],
  activeTripId: "t",
  isAll: false,
  countries: [],
  cities: [],
  vault: { hasPin: false, unlocked: false, pinLength: null, lockedUntil: null },
  sharingEnabled: false,
};

const COUNTRIES = [
  { id: "jp", name: "Japan", flag: "🇯🇵", trip_id: "t", trip_title: "World Tour", hasDays: true },
  { id: "it", name: "Italy", flag: "🇮🇹", trip_id: "t", trip_title: "World Tour", hasDays: false },
  { id: "ge", name: "Georgia", flag: "🇬🇪", trip_id: "t", trip_title: "World Tour", hasDays: false },
  { id: "tr", name: "Türkiye", flag: "🇹🇷", trip_id: "t", trip_title: "World Tour", hasDays: false },
  { id: "ci", name: "Côte d'Ivoire", flag: "🇨🇮", trip_id: "t", trip_title: "World Tour", hasDays: false },
];

const city = (id: string, trip_country_id: string, name: string, display: CityVM["display"], arrive_date: string | null, lat: number, lng: number) =>
  ({ id, trip_country_id, name, display, arrive_date, depart_date: arrive_date, lat, lng, cover_url: null, country_code: trip_country_id.toUpperCase(), country_name: COUNTRIES.find((c) => c.id === trip_country_id)!.name, flag: COUNTRIES.find((c) => c.id === trip_country_id)!.flag }) as CityVM;

const CITIES = [
  city("tokyo", "jp", "Tokyo", "ongoing", "2037-05-01", 35.68, 139.76),
  city("kyoto", "jp", "Kyoto", "planned", "2037-05-04", 35.01, 135.77),
  city("osaka", "jp", "Osaka", "planned", null, 34.69, 135.5),
  city("rome", "it", "Rome", "visited", "2037-06-01", 41.9, 12.5),
  city("milan", "it", "Milan", "wishlist", null, 45.46, 9.19),
  city("tbilisi", "ge", "Tbilisi", "visited", "2037-07-01", 41.72, 44.79),
];

const JAPAN = { id: "jp", name: "Japan", flag: "🇯🇵", code: "JP", trip_id: "t", trip_title: "World Tour", arrive_date: "2037-05-01", depart_date: "2037-05-14", display: "ongoing", cover_url: null } as CountryVM;
const JAPAN_CITIES = CITIES.filter((c) => c.trip_country_id === "jp");

const day = (id: string, day_number: number, date: string | null, city_id: string | null, title: string | null) => ({ id, trip_country_id: "jp", day_number, date, city_id, title, notes: null }) as ItineraryDay;

const DAYS = [
  day("d1", 1, "2037-05-01", "tokyo", "Arrive in Tokyo"),
  day("d2", 2, "2037-05-02", "tokyo", null),
  day("d3", 3, "2037-05-03", "tokyo", "Asakusa and Ueno"),
  day("d4", 4, "2037-05-04", "kyoto", "Temples"),
  day("d5", 5, "2037-05-05", null, null),
  day("d6", 6, "2037-05-07", "kyoto", "Arashiyama"),
  day("d7", 7, "2037-05-08", "kyoto", "Northern temples"),
  day("d8", 8, "2037-05-10", "osaka", null),
  day("d9", 9, null, null, null),
];

const stop = (id: string, day_id: string, order_index: number, title: string, place_id: string | null, done = false) => ({ id, day_id, order_index, title, place_id, done, type: "activity", start_time: null, end_time: null, notes: null }) as ItineraryItem;

const ITEMS = [
  stop("s1", "d1", 0, "Haneda to hotel", null, true),
  stop("s2", "d1", 1, "Shibuya Crossing", "shibuya"),
  stop("s3", "d3", 0, "Senso-ji temple", "sensoji"),
  stop("s4", "d3", 1, "Ueno park", "ueno"),
  stop("s4b", "d3", 2, "Lunch somewhere", null),
  stop("s4c", "d3", 3, "Akihabara", "akiba"),
  stop("s4d", "d3", 4, "Tokyo Tower at night", "tower"),
  stop("s5", "d4", 0, "Fushimi Inari", "inari"),
  stop("s6", "d4", 1, "Kiyomizu-dera", "kiyomizu"),
  stop("s7", "d6", 0, "Bamboo grove", null),
  stop("s8", "d7", 0, "Kinkaku-ji", null),
];

const place = (id: string, name: string, lat: number, lng: number) => ({ id, name, lat, lng, city_id: "tokyo", category: "sight", cover_url: null, city_name: "Tokyo", country_code: "JP" }) as PlaceVM;
const PLACES = [
  place("shibuya", "Shibuya Crossing", 35.6595, 139.7005),
  place("sensoji", "Senso-ji", 35.7148, 139.7967),
  place("ueno", "Ueno Park", 35.7156, 139.7745),
  place("akiba", "Akihabara", 35.6984, 139.7731),
  place("tower", "Tokyo Tower", 35.6586, 139.7454),
  place("inari", "Fushimi Inari", 34.9671, 135.7727),
  place("kiyomizu", "Kiyomizu-dera", 34.9949, 135.785),
];

export function ListsPreview({ view, initialDayId }: { view: "cities" | "itinerary"; initialDayId: string | null }) {
  return (
    <WorkspaceProvider value={{ ...WORKSPACE, openQuickAdd: () => {}, openPalette: () => {} }}>
      <TooltipProvider>
        <ConfirmProvider>
          <main className="mx-auto max-w-6xl p-4 md:p-8">
            {/* Goes to another route and back, to check that open sections come back. */}
            <Link href="/dev/preview/tools" className="mb-4 inline-block text-sm text-accent hover:underline">
              Leave this page
            </Link>
            {view === "cities" ? (
              <CitiesView cities={CITIES} countries={COUNTRIES} placeCounts={{ tokyo: 2 }} dayCounts={{ tokyo: 3, kyoto: 1 }} />
            ) : (
              <ItineraryPlanner countries={COUNTRIES} country={JAPAN} days={DAYS} items={ITEMS} cities={JAPAN_CITIES} places={PLACES} bookings={[]} shiftDayIds={["d1"]} initialDayId={initialDayId} showTripName={false} />
            )}
          </main>
        </ConfirmProvider>
      </TooltipProvider>
    </WorkspaceProvider>
  );
}
