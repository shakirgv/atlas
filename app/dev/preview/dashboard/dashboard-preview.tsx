"use client";
import type { ComponentProps } from "react";
import { useSearchParams } from "next/navigation";
import { Dashboard } from "@/components/dashboard/dashboard";
import { WorkspaceProvider } from "@/components/shell/workspace";
import { ConfirmProvider } from "@/components/ui/confirm";
import { TooltipProvider } from "@/components/ui/tooltip";

type Props = ComponentProps<typeof Dashboard>;

const swatch = (color: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="${color}"/></svg>`)}`;

const BASE = {
  displayName: "Shakir",
  baseCurrency: "USD",
  activeTrip: { title: "Three Countries" } as Props["activeTrip"],
  hasTrips: true,
  nextStop: { id: "it", code: "IT", name: "Italy", flag: "🇮🇹", display: "ongoing", arrive_date: "2026-10-29", depart_date: "2026-11-07", cover_url: null } as Props["nextStop"],
  nextStopCityCount: 2,
  stats: { visited: 1, planned: 2, cities: 6, daysOnRoad: 12, placesVisited: 6, places: 17, photos: 5 },
  budget: {
    totalBudget: 9000,
    planned: 3200,
    spent: 2450,
    remaining: 6550,
    avgPerDay: 188,
    remainingPerDay: 385,
    daysElapsed: 13,
    daysRemaining: 17,
    byCategory: [
      { category: "accommodation", actual: 1100, planned: 800 },
      { category: "flights", actual: 620, planned: 890 },
      { category: "food", actual: 420, planned: 300 },
      { category: "transport", actual: 180, planned: 200 },
      { category: "fees", actual: 8, planned: 0 },
    ],
    byCountry: [],
    cumulative: [],
  } as Props["budget"],
  cash: { onHand: 412.5, fees: 8.3 },
  map: {
    states: { TR: { status: "visited" }, IT: { status: "planned", display: "ongoing" }, JP: { status: "planned" } } as Props["map"]["states"],
    routes: [
      [
        { id: "home", code: "", lat: 40.41, lng: 49.87, name: "Baku", home: true },
        { id: "ist", code: "TR", lat: 41.01, lng: 28.98, name: "Istanbul", mode: "flight" },
        { id: "rom", code: "IT", lat: 41.9, lng: 12.5, name: "Rome", mode: "flight" },
        { id: "flo", code: "IT", lat: 43.77, lng: 11.26, name: "Florence", mode: "train", minor: true },
        { id: "tyo", code: "JP", lat: 35.68, lng: 139.65, name: "Tokyo", mode: "flight" },
      ],
    ],
    cities: [],
  },
  upcomingDays: [],
  memories: [],
  alerts: [
    { id: "a", level: "danger", kind: "entry", title: "🇮🇹 Italy: Planned 10 days, allowed 7", detail: "Visa and entry", href: "/" },
    { id: "b", level: "danger", kind: "passport", title: "Passport expires too soon", detail: "Many countries require 6 months", href: "/" },
    { id: "c", level: "info", kind: "jetlag", title: "Big time shift arriving in Tokyo", detail: "+6h east · ~6 days to adjust", href: "/" },
  ] as Props["alerts"],
  setup: { missingHome: false, missingPassport: false },
  time: { homeTz: "Asia/Baku", homeName: "Baku", current: { name: "Rome", tz: "Europe/Rome" }, next: { name: "Tokyo", tz: "Asia/Tokyo", arrive: "2026-11-08" } },
  weather: { name: "Rome", lat: 41.9, lng: 12.5, arrive: "2026-10-29", depart: "2026-11-07", ongoing: true, forecastDue: true, focusDate: "2026-11-02" },
  onThisDay: [] as Props["onThisDay"],
  recap: { year: 2025, prominent: false },
} satisfies Props;

const WORKSPACE = {
  userId: "u",
  email: null,
  settings: null,
  baseCurrency: "USD",
  displayName: "Shakir",
  trips: [],
  activeTripId: null,
  isAll: false,
  countries: [],
  cities: [],
  vault: { hasPin: false, unlocked: false, pinLength: null, lockedUntil: null },
  sharingEnabled: false,
  openQuickAdd: () => {},
  openPalette: () => {},
};

/** `?state=rich` adds On this day and a prominent recap; `?state=empty` hides every optional tile. */
export function DashboardPreview() {
  const state = useSearchParams().get("state");
  const props: Props =
    state === "rich"
      ? {
          ...BASE,
          recap: { year: 2026, prominent: true },
          onThisDay: [
            { kind: "memory", id: "m", date: "2025-11-02", yearsAgo: 1, title: "First evening on the Bosphorus", place: "Istanbul", thumbUrl: swatch("#d9774a") },
            { kind: "photo", id: "p", date: "2023-11-03", yearsAgo: 3, title: "Trevi at dusk", place: "Rome", thumbUrl: swatch("#7c8db5"), url: swatch("#7c8db5"), caption: "Trevi at dusk" },
          ],
        }
      : state === "empty"
        ? { ...BASE, cash: null, weather: null, recap: null, alerts: [], time: { homeTz: null, homeName: null, current: null, next: null } }
        : BASE;
  return (
    <TooltipProvider>
      <ConfirmProvider>
        <WorkspaceProvider value={WORKSPACE}>
          <main className="mx-auto max-w-[1280px] p-4 md:p-8">
            <Dashboard {...props} />
          </main>
        </WorkspaceProvider>
      </ConfirmProvider>
    </TooltipProvider>
  );
}
