"use client";
import { PrintItinerary } from "@/components/itinerary/print-itinerary";
import type { CountryVM, PlaceVM } from "@/lib/data";
import type { PrintOptions, PrintSelection } from "@/lib/print-itinerary";
import type { Booking, ItineraryDay, ItineraryItem, Trip } from "@/lib/types";

const TRIP = { id: "t", title: "World Tour", start_date: "2037-05-01", end_date: "2037-06-03" } as Trip;
const country = (id: string, name: string, flag: string, arrive_date: string, depart_date: string) => ({ id, name, flag, trip_id: "t", trip_title: "World Tour", arrive_date, depart_date }) as CountryVM;
const COUNTRIES = [country("jp", "Japan", "🇯🇵", "2037-05-01", "2037-05-04"), country("it", "Italy", "🇮🇹", "2037-06-01", "2037-06-03")];
const CITIES = [
  { id: "tokyo", name: "Tokyo", trip_country_id: "jp", arrive_date: "2037-05-01", depart_date: "2037-05-02" },
  { id: "kyoto", name: "Kyoto", trip_country_id: "jp", arrive_date: null, depart_date: null },
  { id: "rome", name: "Rome", trip_country_id: "it", arrive_date: "2037-06-01", depart_date: "2037-06-03" },
];
const place = (address: string) => ({ address }) as PlaceVM;
const stop = (id: string, title: string, start_time: string | null, p: PlaceVM | null, notes: string | null, done = false) =>
  ({ id, title, start_time, end_time: null, type: "activity", notes, done, place: p }) as ItineraryItem & { place: PlaceVM | null };
const day = (id: string, tc: string, n: number, date: string | null, city: string | null, title: string | null, notes: string | null, stops: ReturnType<typeof stop>[], bookings: Booking[] = []) => ({
  day: { id, trip_country_id: tc, day_number: n, date, city_id: CITIES.find((c) => c.name === city)?.id ?? null, title, notes } as ItineraryDay,
  city,
  stops,
  bookings,
});
const DAYS = [
  day("d1", "jp", 1, "2037-05-01", "Tokyo", "Arrive in Tokyo", "Get a Suica card at the airport.", [stop("s1", "Shibuya Crossing", "18:00", place("2 Chome-2-1 Dogenzaka, Shibuya"), "Go up to the Starbucks for the view")], [{ id: "b1", type: "flight", title: "HND arrival", start_at: "2037-05-01T09:40:00", confirmation_no: "XK42" } as Booking]),
  day("d2", "jp", 2, "2037-05-02", "Tokyo", null, null, [stop("s2", "Senso-ji", "09:00", place("2 Chome-3-1 Asakusa, Taito"), null, true), stop("s3", "Ueno park", null, null, "Museums close at 17:00")]),
  day("d3", "jp", 3, "2037-05-03", "Kyoto", "Temples", null, [stop("s4", "Fushimi Inari", "07:30", place("68 Fukakusa Yabunouchicho, Fushimi"), null)]),
  day("d4", "jp", 4, "2037-05-04", "Kyoto", null, null, []),
  day("d5", "it", 1, "2037-06-01", "Rome", "Ancient Rome", "Book Colosseum tickets ahead.", [stop("s5", "Colosseum", "10:00", place("Piazza del Colosseo, 1"), null)]),
];

export function PrintPreview({ selection, options }: { selection: PrintSelection; options: PrintOptions }) {
  return (
    <main className="p-4 md:p-8">
      <PrintItinerary trip={TRIP} countries={COUNTRIES} cities={CITIES} days={DAYS} initialSelection={selection} initialOptions={options} />
    </main>
  );
}
