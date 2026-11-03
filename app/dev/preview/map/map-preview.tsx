"use client";
import type { ComponentProps } from "react";
import { MapExplorer } from "@/components/map/map-explorer";
import type { ExportTrip } from "@/components/map/export-dialog";
import type { RoutePoint } from "@/components/map/world-map";
import { AppShell } from "@/components/shell/app-shell";
import type { CountryVM } from "@/lib/data";
import { countryFlag, countryName } from "@/lib/countries";

type Shell = ComponentProps<typeof AppShell>["workspace"];

/** Europe sits close together so it clusters; the rest of the route is spread across the world. */
const STOPS: { code: string; lat: number; lng: number; status: "visited" | "planned" | "wishlist"; arrive: string; depart: string; mode: string; cities?: { name: string; lat: number; lng: number }[] }[] = [
  { code: "TR", lat: 41.01, lng: 28.98, status: "visited", arrive: "2026-03-01", depart: "2026-03-08", mode: "flight" },
  { code: "GR", lat: 37.98, lng: 23.73, status: "visited", arrive: "2026-03-09", depart: "2026-03-15", mode: "ferry" },
  { code: "IT", lat: 41.9, lng: 12.5, status: "visited", arrive: "2026-03-16", depart: "2026-03-28", mode: "flight", cities: [{ name: "Florence", lat: 43.77, lng: 11.26 }] },
  { code: "CH", lat: 46.95, lng: 7.45, status: "visited", arrive: "2026-03-29", depart: "2026-04-02", mode: "train" },
  { code: "FR", lat: 48.86, lng: 2.35, status: "planned", arrive: "2026-11-02", depart: "2026-11-12", mode: "train" },
  { code: "BE", lat: 50.85, lng: 4.35, status: "planned", arrive: "2026-11-13", depart: "2026-11-16", mode: "train" },
  { code: "NL", lat: 52.37, lng: 4.89, status: "planned", arrive: "2026-11-17", depart: "2026-11-21", mode: "train" },
  { code: "AE", lat: 25.2, lng: 55.27, status: "planned", arrive: "2026-12-29", depart: "2027-01-03", mode: "flight" },
  { code: "TH", lat: 13.75, lng: 100.5, status: "planned", arrive: "2027-01-04", depart: "2027-01-19", mode: "flight" },
  { code: "VN", lat: 21.03, lng: 105.85, status: "planned", arrive: "2027-01-20", depart: "2027-02-02", mode: "bus" },
  { code: "JP", lat: 35.68, lng: 139.65, status: "planned", arrive: "2027-02-03", depart: "2027-02-20", mode: "flight" },
  { code: "CD", lat: -4.32, lng: 15.31, status: "wishlist", arrive: "2027-05-01", depart: "2027-05-09", mode: "flight" },
  { code: "ST", lat: 0.34, lng: 6.73, status: "wishlist", arrive: "2027-05-10", depart: "2027-05-20", mode: "flight" },
  { code: "BR", lat: -22.91, lng: -43.17, status: "wishlist", arrive: "2027-06-01", depart: "2027-06-22", mode: "flight" },
  { code: "PE", lat: -12.05, lng: -77.04, status: "wishlist", arrive: "2027-06-23", depart: "2027-07-08", mode: "flight" },
  { code: "MX", lat: 19.43, lng: -99.13, status: "wishlist", arrive: "2027-07-09", depart: "2027-07-20", mode: "flight" },
  { code: "CA", lat: 45.42, lng: -75.7, status: "wishlist", arrive: "2027-07-21", depart: "2027-08-03", mode: "flight" },
  { code: "IS", lat: 64.15, lng: -21.94, status: "wishlist", arrive: "2027-08-04", depart: "2027-08-14", mode: "flight" },
  { code: "NO", lat: 59.91, lng: 10.75, status: "wishlist", arrive: "2027-08-15", depart: "2027-08-25", mode: "flight" },
  { code: "PL", lat: 52.23, lng: 21.01, status: "wishlist", arrive: "2027-08-26", depart: "2027-09-02", mode: "flight" },
];

const ROUTE: RoutePoint[] = [
  { id: "home", code: "", lat: 40.41, lng: 49.87, name: "Baku", home: true },
  ...STOPS.flatMap((s): RoutePoint[] => [
    { id: s.code, code: s.code, lat: s.lat, lng: s.lng, name: countryName(s.code), mode: s.mode },
    ...(s.cities ?? []).map((c) => ({ id: `${s.code}-${c.name}`, code: s.code, lat: c.lat, lng: c.lng, name: c.name, mode: "train", minor: true })),
  ]),
];

const CITIES = STOPS.flatMap((s) => [{ id: `c-${s.code}`, name: countryName(s.code), lat: s.lat, lng: s.lng }, ...(s.cities ?? []).map((c) => ({ id: `c-${c.name}`, ...c }))]);

const COUNTRIES = STOPS.map((s) => ({ id: s.code, code: s.code, name: countryName(s.code), flag: countryFlag(s.code), display: s.status, arrive_date: s.arrive, depart_date: s.depart, transport_mode: s.mode })) as unknown as CountryVM[];

const EXPORT_TRIPS: ExportTrip[] = [{ id: "t1", title: "Around the world", routes: [ROUTE], cities: CITIES, countries: STOPS.map((s) => ({ code: s.code, status: s.status })) }];

const WORKSPACE = {
  userId: "u",
  email: null,
  settings: { display_name: "Preview" },
  baseCurrency: "USD",
  displayName: "Preview",
  trips: [{ id: "t1", title: "Around the world", status: "planned", start_date: null, end_date: null, is_sample: false }],
  activeTripId: "t1",
  isAll: false,
  countries: [],
  cities: [],
  vault: { hasPin: false, unlocked: false, pinLength: null, lockedUntil: null },
  sharingEnabled: false,
} as unknown as Shell;

export function MapPreview() {
  return (
    <AppShell workspace={WORKSPACE} sidebarCollapsed={false}>
      <MapExplorer
        states={Object.fromEntries(STOPS.map((s) => [s.code, { status: s.status }]))}
        routes={[ROUTE]}
        cities={CITIES}
        inScopeIds={Object.fromEntries(STOPS.map((s) => [s.code, s.code]))}
        countries={COUNTRIES}
        cityCounts={Object.fromEntries(STOPS.map((s) => [s.code, 1 + (s.cities?.length ?? 0)]))}
        photoBadges={{ cities: [], countries: [] }}
        exportTrips={EXPORT_TRIPS}
        activeTripId="t1"
      />
    </AppShell>
  );
}
