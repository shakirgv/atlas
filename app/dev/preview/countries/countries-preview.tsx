"use client";
import { useState } from "react";
import Link from "next/link";
import { ClosingNotesDialog } from "@/components/countries/closing-notes";
import { CountriesView } from "@/components/countries/countries-view";
import { CountryDetail } from "@/components/countries/country-detail";
import { CountryEditDialog } from "@/components/countries/country-edit-dialog";
import { ExpenseSheet } from "@/components/forms/expense-sheet";
import { WorkspaceProvider, type QuickAddRequest, type Workspace } from "@/components/shell/workspace";
import { ConfirmProvider } from "@/components/ui/confirm";
import { TooltipProvider } from "@/components/ui/tooltip";
import { itineraryStats } from "@/lib/country-list";
import type { CityVM, CountryVM, PlaceVM } from "@/lib/data";
import { placeLinks } from "@/lib/place-duplicates";
import type { CountryOption, DocumentRow, EntryRequirement, Expense, ItineraryDay, ItineraryItem } from "@/lib/types";

const country = (id: string, code: string, name: string, flag: string, order_index: number, arrive_date: string | null, depart_date: string | null, region: string, extra: Partial<CountryVM> = {}) =>
  ({ id, code, name, flag, order_index, arrive_date, depart_date, region, trip_id: "t", trip_title: "World Tour", status: "planned", display: "planned", cover_url: null, cover_path: null, budget: null, notes: null, country_code: code, transport_mode: null, transport_note: null, ...extra }) as CountryVM;

// A long route, so the list has something to scroll and restore.
const FILLER = ["Peru", "Chile", "Brazil", "Mexico", "Canada", "Iceland", "Norway", "Greece", "Egypt", "Kenya", "India", "Nepal", "Vietnam", "Laos", "Fiji", "Samoa"].map((name, i) => country(`f${i}`, "PE", name, "🏳️", i + 3, `2038-0${(i % 9) + 1}-01`, `2038-0${(i % 9) + 1}-05`, "Americas"));

const JAPAN = country("jp", "JP", "Japan", "🇯🇵", 0, "2037-01-04", "2037-01-12", "Asia", { budget: 3000 });
const COUNTRIES = [JAPAN, country("it", "IT", "Italy", "🇮🇹", 1, "2037-02-04", "2037-02-04", "Europe"), country("ge", "GE", "Georgia", "🇬🇪", 2, null, null, "Asia"), ...FILLER];

const city = (id: string, name: string) => ({ id, name, trip_country_id: "jp", order_index: 0, display: "planned", status: "planned", arrive_date: null, depart_date: null, lat: null, lng: null, cover_url: null, country_code: "JP", country_name: "Japan", flag: "🇯🇵" }) as unknown as CityVM;
const CITIES = [city("tokyo", "Tokyo"), city("kyoto", "Kyoto")];

const day = (id: string, day_number: number, date: string | null, city_id: string | null, title: string | null) => ({ id, trip_country_id: "jp", day_number, date, city_id, title, notes: null }) as ItineraryDay;
const DAYS = [day("d1", 1, "2037-01-04", "tokyo", "Arrive in Tokyo"), day("d2", 2, "2037-01-05", "tokyo", null), day("d3", 3, "2037-01-08", "kyoto", "Temples")];

const stop = (id: string, day_id: string, title: string, start_time: string | null, end_time: string | null, place_id: string | null = null) => ({ id, day_id, title, start_time, end_time, place_id, order_index: 0, done: false, type: "activity", notes: null }) as ItineraryItem;
const ITEMS = [stop("s1", "d1", "Haneda to hotel", "09:00", "10:30"), stop("s2", "d1", "Shibuya Crossing", "18:00", null, "p1"), stop("s3", "d3", "Fushimi Inari", null, null, "p4")];

const place = (id: string, name: string, city_id: string, city_name: string, status = "want", extra: Partial<PlaceVM> = {}) =>
  ({ id, name, city_id, city_name, status, category: "sight", rating: null, lat: null, lng: null, address: null, cover_url: null, country_code: "JP", ...extra }) as PlaceVM;
const PLACES = [
  place("p1", "Shibuya Crossing", "tokyo", "Tokyo", "visited", { rating: 5 }),
  place("p2", "Shibuya crossing", "tokyo", "Tokyo"),
  place("p3", "Senso-ji", "tokyo", "Tokyo", "planned"),
  place("p4", "Fushimi Inari", "kyoto", "Kyoto"),
  place("p5", "Kinkaku-ji", "kyoto", "Kyoto"),
  ...Array.from({ length: 30 }, (_, i) => place(`m${i}`, `Spot number ${"abcdefghijklmnopqrstuvwxyz1234"[i]} of the city`, i % 2 ? "tokyo" : "kyoto", i % 2 ? "Tokyo" : "Kyoto")),
];

const expense = (id: string, kind: string, category: string, amount_base: number, city_id: string | null, title: string) => ({ id, kind, category, amount: amount_base, amount_base, city_id, title, trip_id: "t", trip_country_id: "jp", currency: "USD", fx_rate: 1, date: "2037-01-04", notes: null, payment_method: "card", wallet_id: null }) as Expense;
const EXPENSES = [expense("e1", "planned", "flights", 900, null, "Flight home"), expense("e2", "planned", "accommodation", 600, "tokyo", "Hotel"), expense("e3", "planned", "food", 200, "tokyo", "Ramen tour"), expense("e4", "actual", "food", 40, "tokyo", "Lunch")];

const passport = (expiry_date: string) => ({ id: "pp", type: "passport", title: "My passport", expiry_date, reference_no: null, trip_id: null, trip_country_id: null }) as DocumentRow;

const OPTIONS: CountryOption[] = COUNTRIES.map((c) => ({ id: c.id, trip_id: "t", country_code: c.code, name: c.name, flag: c.flag, order_index: c.order_index, arrive_date: c.arrive_date, depart_date: c.depart_date, status: c.status }));
const WORKSPACE: Workspace = {
  userId: "u",
  email: null,
  settings: null,
  baseCurrency: "USD",
  displayName: "",
  trips: [{ id: "t", title: "World Tour", status: "planning", start_date: null, end_date: null, is_sample: false }],
  activeTripId: "t",
  isAll: false,
  countries: OPTIONS,
  cities: CITIES.map((c) => ({ id: c.id, trip_country_id: "jp", name: c.name, lat: null, lng: null, country_code: "JP" })),
  vault: { hasPin: false, unlocked: false, pinLength: null, lockedUntil: null },
  sharingEnabled: false,
};

export type CountriesPreviewProps = { view: "list" | "detail" | "edit" | "closing"; tab: string; entry: "visa_free" | "evisa"; expiry: string | null; rule: string | null };

export function CountriesPreview({ view, tab, entry, expiry, rule }: CountriesPreviewProps) {
  const [quick, setQuick] = useState<QuickAddRequest | null>(null);
  const [open, setOpen] = useState(true);
  const requirement = {
    requirement_type: entry === "visa_free" ? "visa_free" : "e_visa",
    status: entry === "visa_free" ? "not_needed" : "to_apply",
    official_url: "https://www.mofa.go.jp/",
    last_verified_on: "2026-10-01",
    checklist: [],
    validity_rule_months: rule ? 6 : null,
    validity_rule_from: rule ? "departure" : null,
    validity_rule_passport: rule,
  } as unknown as EntryRequirement;
  const docs = expiry ? [passport(expiry)] : [];
  return (
    <WorkspaceProvider value={{ ...WORKSPACE, openQuickAdd: (r) => setQuick(typeof r === "string" ? { kind: r } : r), openPalette: () => {} }}>
      <TooltipProvider>
        <ConfirmProvider>
          {/* The same bar as the app, so the sticky tabs have something to sit under. */}
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b border-border bg-bg/75 px-4 backdrop-blur-xl md:h-16 md:px-8">
            <Link href="/dev/preview/countries">Plain list</Link>
          </header>
          <main className="mx-auto w-full max-w-[1280px] px-4 pb-32 pt-6 md:px-8 md:pt-8">
            {view === "list" && <CountriesView countries={COUNTRIES} cityCounts={{ jp: 2, it: 1 }} stats={itineraryStats([...DAYS, { ...DAYS[0]!, id: "blank", trip_country_id: "it", title: null }], ITEMS)} trips={[{ id: "t", title: "World Tour" }]} singleTrip />}
            {view === "detail" && (
              <CountryDetail
                legs={[]}
                climateStops={[]}
                infoOverride={null}
                entry={{ requirement, passportCountry: "AZ", passportExpiry: expiry, documents: [] }}
                country={JAPAN}
                attribution={null}
                cities={CITIES}
                places={PLACES}
                days={DAYS}
                items={ITEMS}
                expenses={EXPENSES}
                memories={[]}
                documents={docs}
                passportId={docs[0]?.id ?? null}
                placeLinks={placeLinks(ITEMS, [])}
                baseCurrency="USD"
                initialTab={tab}
                openEdit={false}
                closing={{ available: true, review: null, hotels: [] }}
              />
            )}
            {view === "edit" && <CountryEditDialog open={open} onOpenChange={setOpen} country={COUNTRIES[1]!} name="Italy" baseCurrency="USD" />}
            {view === "closing" && <ClosingNotesDialog country={JAPAN} review={null} places={PLACES} hotels={[]} onOpenChange={setOpen} />}
            {quick?.kind === "expense" && <ExpenseSheet open onOpenChange={() => setQuick(null)} tripCountryId={quick.tripCountryId} preset={quick.preset} />}
          </main>
        </ConfirmProvider>
      </TooltipProvider>
    </WorkspaceProvider>
  );
}
