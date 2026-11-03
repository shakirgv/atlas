"use client";
import type { ClimateMonth, ForecastDay, Verdict } from "@/lib/climate";
import { ClimateCard } from "@/components/climate/climate-card";
import { VerdictChip } from "@/components/climate/verdict-chip";
import { ForecastView, NormalsView, type WeatherStop } from "@/components/dashboard/weather-tile";
import { EssentialsTab } from "@/components/countries/essentials-tab";
import { EntryTab } from "@/components/entry/entry-tab";
import { EntryTable } from "@/components/entry/entry-table";
import { CashTab } from "@/components/cash/cash-tab";
import { ExpenseTable } from "@/components/budget/expense-table";
import { PhotoMap } from "@/components/photos/photo-map";
import { PinPad } from "@/components/vault/pin-pad";
import { ExportDialog, type ExportTrip } from "@/components/map/export-dialog";
import { RecapView } from "@/components/recap/recap-view";
import { ShareDialog } from "@/components/share/share-dialog";
import { OnThisDay } from "@/components/dashboard/on-this-day";
import { computeRecap, recapSlides, type RecapInput } from "@/lib/recap";
import { Button } from "@/components/ui/button";
import { SecuritySection } from "@/components/settings/security-section";
import { MfaForm } from "@/app/(auth)/login/mfa/mfa-form";
import type { PhotoPin, UnlocatedPhoto } from "@/lib/photo-pins";
import { useState } from "react";
import type { Expense, PhotoView } from "@/lib/types";
import { planExchange, planSpend, planWithdrawal, summarizeCash } from "@/lib/cash";
import { entryOverview } from "@/lib/entry";
import { shiftIso, todayIso } from "@/lib/dates";
import type { EntryRequirement } from "@/lib/types";
import { ConfirmProvider } from "@/components/ui/confirm";
import { TooltipProvider } from "@/components/ui/tooltip";

const VERDICTS: Verdict[] = ["good", "hot", "rainy", "cold", "very_hot", "freezing"];
const TOKYO: WeatherStop = { name: "Tokyo", lat: 35.68, lng: 139.65, arrive: "2027-07-05", depart: "2027-07-20", forecastDue: true, focusDate: null };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {children}
    </section>
  );
}

function entryFixtures() {
  const today = todayIso();
  const d = (n: number) => shiftIso(today, n);
  const list = [
    { id: "jp", code: "JP", name: "Japan", flag: "🇯🇵", trip_title: "Sample trip", arrive_date: d(40), depart_date: d(55) },
    { id: "it", code: "IT", name: "Italy", flag: "🇮🇹", trip_title: "Sample trip", arrive_date: d(60), depart_date: d(104) },
    { id: "th", code: "TH", name: "Thailand", flag: "🇹🇭", trip_title: "Sample trip", arrive_date: d(20), depart_date: d(30) },
    { id: "ge", code: "GE", name: "Georgia", flag: "🇬🇪", trip_title: "Sample trip", arrive_date: d(10), depart_date: d(15) },
    { id: "tr", code: "TR", name: "Türkiye", flag: "🇹🇷", trip_title: "Sample trip", arrive_date: d(200), depart_date: d(205) },
  ];
  const done = [{ id: "a", label: "Passport valid for 6+ months", done: true }];
  const rows = [
    { trip_country_id: "jp", requirement_type: "e_visa", status: "approved", valid_from: d(0), valid_until: d(90), checklist: done },
    { trip_country_id: "it", requirement_type: "visa_required", status: "applied", allowed_stay_days: 30, last_verified_on: d(-5) },
    { trip_country_id: "ge", requirement_type: "visa_required", status: "to_apply", apply_by: d(5), last_verified_on: d(-200) },
    { trip_country_id: "tr", requirement_type: "visa_free", status: "not_needed", checklist: done },
  ];
  return { rows: entryOverview(list, rows, { today, passportExpiry: null }), arrive: d(60), depart: d(104), apply: d(30) };
}

const ENTRY = entryFixtures();

/** The spec's scenario, built with the same plan functions the actions use. */
function cashFixtures() {
  const date = todayIso();
  const wallet = (id: string, currency: string, label: string | null, low: number | null = null) => ({ id, currency, label, low_balance_alert: low, user_id: "u", created_at: date });
  const withdrawal = planWithdrawal({ walletId: "jpy", walletCurrency: "JPY", date, received: 20000, charged: 150, chargedCurrency: "USD", fee: 5, feeCurrency: "USD", tripId: "t" }, 0.00745);
  const spend = planSpend({ id: "e", payment_method: "cash", wallet_id: "jpy", kind: "actual", amount: 3500, date, title: "Ramen in Shibuya" })!;
  const exchange = planExchange({ fromWalletId: "eur", fromCurrency: "EUR", fromAmount: 40, toWalletId: "jpy", toCurrency: "JPY", toAmount: 6400, date, tripId: "t" }, 0.0061);
  const rows = [withdrawal.tx, spend, exchange.out, exchange.in, { wallet_id: "eur", type: "received", date, amount: 60, note: "Hostel deposit back" }].map((t, i) => ({
    id: `tx-${i}`,
    user_id: "u",
    created_at: `${date}T00:00:0${i}`,
    counter_amount: null,
    counter_currency: null,
    fee_amount: null,
    fee_currency: null,
    effective_rate: null,
    mid_market_rate: null,
    linked_transaction_id: null,
    expense_id: null,
    fee_expense_id: null,
    ...t,
  }));
  return summarizeCash([wallet("jpy", "JPY", null), wallet("eur", "EUR", "Euro pouch", 50)], rows, { rates: { base: "USD", rates: { JPY: 135, EUR: 0.92 }, updatedAt: null, stale: false }, baseCurrency: "USD", feesPaid: 5 });
}

const CASH = cashFixtures();

const RECEIPT_IMG = `data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="300" height="400"><rect width="300" height="400" fill="#fffdf8"/><text x="150" y="60" font-size="18" font-family="monospace" text-anchor="middle">RECEIPT</text></svg>')}`;
const expenseRow = (id: string, title: string, category: string, amount: number, currency: string, base: number, kind = "actual", payment = "card") => ({ id, title, category, amount, currency, amount_base: base, kind, payment_method: payment, date: todayIso(), fx_rate: 1, trip_id: "t", trip_country_id: null, city_id: "c", wallet_id: null, notes: null, user_id: "u", created_at: "" }) as unknown as Expense;
const EXPENSES = [expenseRow("a", "Ramen in Shibuya", "food", 3500, "JPY", 25.9, "actual", "cash"), expenseRow("b", "Hotel in Shinjuku", "accommodation", 168000, "JPY", 1244), expenseRow("c", "Taxi", "transport", 2200, "JPY", 16.3), expenseRow("d", "Ryokan in Kyoto", "accommodation", 120000, "JPY", 889, "planned")];
const RECEIPTS = { a: [{ id: "r1", thumb_url: RECEIPT_IMG, url: RECEIPT_IMG, width: 300, height: 400 } as unknown as PhotoView, { id: "r2", thumb_url: RECEIPT_IMG, url: RECEIPT_IMG, width: 300, height: 400 } as unknown as PhotoView] };

const swatch = (color: string) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="200" height="200" fill="${color}"/></svg>`)}`;
const pinPhoto = (id: string, color: string, caption: string) => ({ id, url: swatch(color), thumb_url: swatch(color), caption, width: 200, height: 200 }) as unknown as PhotoView;
/** Rome close together, so they cluster and split on zoom; one far-away pin; two for the tray. */
const PIN_BASE = { source: "gps" as const, tripId: "t", tripCountryId: "it", cityId: "rome", year: "2026" };
const PINS: PhotoPin[] = [
  { ...PIN_BASE, photo: pinPhoto("p1", "#d9774a", "Colosseum"), lat: 41.8902, lng: 12.4922, label: "Colosseum" },
  { ...PIN_BASE, photo: pinPhoto("p2", "#6f8f5f", "Forum"), lat: 41.8925, lng: 12.4853, label: "Forum" },
  { ...PIN_BASE, photo: pinPhoto("p3", "#7c8db5", "Trevi"), lat: 41.9009, lng: 12.4833, label: "Trevi" },
  { ...PIN_BASE, photo: pinPhoto("p4", "#c9a227", "Pantheon"), lat: 41.8986, lng: 12.4769, label: "Pantheon" },
  { ...PIN_BASE, tripCountryId: "jp", cityId: "tokyo", year: "2025", photo: pinPhoto("p5", "#b8865a", "Tokyo"), lat: 35.6762, lng: 139.6503, label: "Tokyo" },
];
const TRAY: UnlocatedPhoto[] = [
  { tripId: "t", tripCountryId: "it", cityId: null, year: "2026", label: "No GPS", photo: pinPhoto("u1", "#35506b", "") },
  { tripId: "t", tripCountryId: "it", cityId: null, year: "2026", label: "No GPS 2", photo: pinPhoto("u2", "#6b4a2b", "") },
];

const EXPORT_TRIPS: ExportTrip[] = [
  {
    id: "t1",
    title: "Three countries",
    routes: [
      [
        { id: "home", code: "", lat: 40.41, lng: 49.87, name: "Baku", home: true },
        { id: "ist", code: "TR", lat: 41.01, lng: 28.98, name: "Istanbul", mode: "flight" },
        { id: "rom", code: "IT", lat: 41.9, lng: 12.5, name: "Rome", mode: "flight" },
        { id: "flo", code: "IT", lat: 43.77, lng: 11.26, name: "Florence", mode: "train", minor: true },
        { id: "tyo", code: "JP", lat: 35.68, lng: 139.65, name: "Tokyo", mode: "flight" },
        { id: "kyo", code: "JP", lat: 35.01, lng: 135.77, name: "Kyoto", mode: "train", minor: true },
        { id: "nao", code: "JP", lat: 34.46, lng: 134.0, name: "Naoshima", mode: "ferry", minor: true },
      ],
    ],
    cities: [
      { id: "c1", name: "Istanbul", lat: 41.01, lng: 28.98 },
      { id: "c2", name: "Rome", lat: 41.9, lng: 12.5 },
      { id: "c3", name: "Tokyo", lat: 35.68, lng: 139.65 },
    ],
    countries: [
      { code: "TR", status: "visited" },
      { code: "IT", status: "visited" },
      { code: "JP", status: "planned" },
      { code: "BR", status: "wishlist" },
    ],
  },
];

/** A year with something on every slide. Fixed dates, so the numbers can be checked by hand. */
const RECAP_INPUT: RecapInput = {
  today: "2026-12-20",
  stays: [
    { id: "s0", code: "IT", name: "Italy", flag: "🇮🇹", status: "visited", arrive: "2025-05-01", depart: "2025-05-04" },
    { id: "s1", code: "TR", name: "Türkiye", flag: "🇹🇷", status: "visited", arrive: "2026-03-01", depart: "2026-03-08" },
    { id: "s2", code: "IT", name: "Italy", flag: "🇮🇹", status: "visited", arrive: "2026-03-09", depart: "2026-03-20" },
    { id: "s3", code: "JP", name: "Japan", flag: "🇯🇵", status: "visited", arrive: "2026-10-01", depart: "2026-10-18" },
    { id: "s4", code: "IT", name: "Italy", flag: "🇮🇹", status: "visited", arrive: "2026-11-01", depart: "2026-11-05" },
  ],
  stops: [
    { key: "a", kind: "city", id: "a", tripCountryId: "s1", name: "Istanbul", lat: 41.01, lng: 28.98, arrive: "2026-03-01", mode: "flight" },
    { key: "b", kind: "city", id: "b", tripCountryId: "s2", name: "Rome", lat: 41.9, lng: 12.5, arrive: "2026-03-09", mode: "flight" },
    { key: "c", kind: "city", id: "c", tripCountryId: "s2", name: "Florence", lat: 43.77, lng: 11.26, arrive: "2026-03-15", mode: "train" },
    { key: "d", kind: "city", id: "d", tripCountryId: "s3", name: "Tokyo", lat: 35.68, lng: 139.65, arrive: "2026-10-01", mode: "flight" },
    { key: "e", kind: "city", id: "e", tripCountryId: "s3", name: "Kyoto", lat: 35.01, lng: 135.77, arrive: "2026-10-10", mode: "train" },
  ],
  places: [
    { id: "p1", name: "Colosseum", cityId: "b", status: "visited", rating: 5 },
    { id: "p2", name: "Fushimi Inari Taisha", cityId: "e", status: "visited", rating: 5 },
    { id: "p3", name: "Grand Bazaar", cityId: "a", status: "visited", rating: 4 },
  ],
  expenses: [
    { date: "2026-03-02", kind: "actual", category: "accommodation", amount_base: 1200 },
    { date: "2026-10-02", kind: "actual", category: "food", amount_base: 640 },
    { date: "2026-10-03", kind: "actual", category: "fees", amount_base: 15 },
  ],
  memories: [
    { id: "m1", date: "2026-03-10", title: "Lost in Monti", body: "No map, just ivy walls, tiny wine bars and a cat that followed us for three streets until it found someone with better food." },
  ],
  photos: ["#d9774a", "#6f8f5f", "#7c8db5", "#c9a227", "#b8865a", "#35506b", "#6b4a2b"].map((color, i) => ({ id: `ph${i}`, url: swatch(color), thumbUrl: swatch(color), date: "2026-03-10", caption: null, linked: "memory" as const })),
};
const RECAP_STATS = computeRecap(RECAP_INPUT, 2026);
const THIS_DAY = [
  { kind: "memory" as const, id: "m", date: "2025-11-02", yearsAgo: 1, title: "First evening on the Bosphorus", place: "Istanbul", thumbUrl: swatch("#d9774a") },
  { kind: "photo" as const, id: "p", date: "2023-11-03", yearsAgo: 3, title: "Trevi at dusk", place: "Rome", thumbUrl: swatch("#7c8db5"), url: swatch("#7c8db5"), caption: "Trevi at dusk" },
];

const SHARE_ROWS = [{ id: "x", token: "sample-token", label: "Three Countries", view_count: 12, last_viewed_at: "2026-10-30T10:00:00Z", expires_at: "2030-01-01T00:00:00Z" } as never];

function ShareDemo({ enabled, label }: { enabled: boolean; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        {label}
      </Button>
      {open && (
        <ShareDialog
          kind="trip"
          targetId="00000000-0000-4000-8000-000000000000"
          title="Three Countries"
          enabled={enabled}
          onOpenChange={setOpen}
          initial={{
            photos: ["#d9774a", "#6f8f5f", "#7c8db5", "#c9a227", "#35506b"].map((c, i) => ({ id: `s${i}`, thumb: swatch(c) })),
            rows: SHARE_ROWS,
          }}
        />
      )}
    </>
  );
}

function ExportDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} data-testid="open-export">
        Open export dialog
      </Button>
      {open && <ExportDialog trips={EXPORT_TRIPS} activeTripId="t1" onOpenChange={setOpen} />}
    </>
  );
}

/** The keypad on the same rules the database enforces (tested separately): PIN 1234, 5 tries. */
function PinDemo() {
  const [left, setLeft] = useState(5);
  const [state, setState] = useState("locked");
  return (
    <div className="card max-w-sm p-6" data-testid="pin-demo" data-state={state}>
      <PinPad
        length={4}
        onUnlocked={() => setState("unlocked")}
        submit={async (pin) => {
          if (pin === "1234") return { ok: true, data: { unlocked: true, lockedUntil: null, attemptsLeft: 5 } };
          const next = left - 1;
          setLeft(next);
          return { ok: true, data: { unlocked: false, lockedUntil: next <= 0 ? new Date(Date.now() + 5 * 60000).toISOString() : null, attemptsLeft: next } };
        }}
      />
      <p className="mt-3 text-center text-xs text-muted">State: {state}</p>
    </div>
  );
}

/** Runs a file through the real compression pipeline, so the size target can be checked without Storage. */
function ReceiptProbe() {
  const [out, setOut] = useState("");
  return (
    <label className="text-sm">
      Compress a receipt:{" "}
      <input
        data-testid="receipt-probe"
        type="file"
        accept="image/*"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          const { processImage } = await import("@/lib/upload");
          const r = await processImage(file, "receipt");
          setOut(JSON.stringify({ input: file.size, full: r.full.size, thumb: r.thumb.size, width: r.width, height: r.height, type: r.full.type, lat: r.exif.lat }));
        }}
      />
      <output data-testid="receipt-probe-out" className="ml-2 font-mono text-xs">{out}</output>
    </label>
  );
}
const ENTRY_REQUIREMENT = {
  requirement_type: "e_visa",
  status: "to_apply",
  allowed_stay_days: 30,
  checklist: [
    { id: "a", label: "Passport valid for 6+ months", done: true },
    { id: "b", label: "Passport photo", done: false },
    { id: "c", label: "Proof of accommodation", done: false },
  ],
} as unknown as EntryRequirement;

export function PreviewClient({ liveClimate, liveForecast }: { liveClimate: { bangkok: ClimateMonth[] | null; reykjavik: ClimateMonth[] | null }; liveForecast: ForecastDay[] | null }) {
  return (
    <TooltipProvider>
      <ConfirmProvider>
      <main className="mx-auto flex max-w-6xl flex-col gap-10 p-4 sm:p-8">
        <h1 className="text-4xl font-semibold">Feature preview</h1>
        <Section title="Climate">
          <div className="flex flex-wrap gap-2">
            {VERDICTS.map((v) => (
              <VerdictChip key={v} verdict={v} />
            ))}
          </div>
          <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
            <div data-testid="climate-bangkok">
              <p className="mb-1 text-xs text-muted">Bangkok, July (live API)</p>
              <ClimateCard months={liveClimate.bangkok} arrive="2027-07-05" depart="2027-07-20" />
            </div>
            <div data-testid="climate-reykjavik">
              <p className="mb-1 text-xs text-muted">Reykjavik, January (live API)</p>
              <ClimateCard months={liveClimate.reykjavik} arrive="2027-01-10" depart="2027-01-20" />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted">No dates: chart only (live API)</p>
              <ClimateCard months={liveClimate.bangkok} />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted">API failure</p>
              <ClimateCard months={null} />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted">Loading</p>
              <ClimateCard months={null} loading />
            </div>
            <div>
              <p className="mb-1 text-xs text-muted">Dashboard tile: forecast (live API)</p>
              <div className="card flex h-56 flex-col gap-3 p-5" data-testid="tile-forecast">
                {liveForecast ? <ForecastView days={liveForecast} stop={TOKYO} /> : <p className="text-sm text-muted">Forecast unavailable</p>}
              </div>
              <p className="mb-1 mt-4 text-xs text-muted">Dashboard tile: normals (live API)</p>
              <div className="card flex h-44 flex-col gap-3 p-5">{liveClimate.bangkok && <NormalsView months={liveClimate.bangkok} stop={{ ...TOKYO, name: "Bangkok" }} />}</div>
            </div>
          </div>
        </Section>
        <Section title="Share links">
          <div className="flex flex-wrap gap-2">
            <ShareDemo enabled label="Share dialog" />
            <ShareDemo enabled={false} label="Share dialog, no server key" />
          </div>
        </Section>
        <Section title="Year recap">
          <RecapView embedded stats={RECAP_STATS} slides={recapSlides(RECAP_STATS)} currency="USD" years={[2026, 2025]} />
        </Section>
        <Section title="On this day">
          <div className="max-w-sm">
            <OnThisDay items={THIS_DAY} />
          </div>
        </Section>
        <Section title="Map export">
          <ExportDemo />
        </Section>
        <Section title="Extra lock">
          <div className="grid items-start gap-4 lg:grid-cols-3">
            <PinDemo />
            <div className="card p-6">
              <h3 className="text-xl font-semibold">Two-factor code</h3>
              <MfaForm next="/" onDone={() => {}} verify={async (code) => (code === "123456" ? { ok: true, data: undefined } : { ok: false, error: "That code didn't work. Codes change every 30 seconds, so try the new one." })} />
            </div>
            <div className="flex flex-col gap-4">
              <div className="card p-6">
                <SecuritySection mfaEnabled hasPin timeout={5} />
              </div>
              <div className="card p-6">
                <SecuritySection mfaEnabled={false} hasPin={false} timeout={5} />
              </div>
            </div>
          </div>
        </Section>
        <Section title="Photo pins">
          <PhotoMap pins={PINS} unlocated={TRAY} trips={[{ id: "t", title: "Sample trip" }]} countries={[{ id: "it", name: "Italy", flag: "🇮🇹" }, { id: "jp", name: "Japan", flag: "🇯🇵" }]} saveLocation={async () => ({ ok: true, data: undefined })} />
        </Section>
        <Section title="Expenses with receipts">
          <ReceiptProbe />
          <ExpenseTable expenses={EXPENSES} countries={[]} cities={[{ id: "c", name: "Tokyo" }]} base="USD" receipts={RECEIPTS} userId="u" onEdit={() => {}} />
        </Section>
        <Section title="Cash wallets">
          <CashTab cash={CASH} baseCurrency="USD" trips={[{ id: "t", title: "Sample trip" }]} defaultTripId="t" startOpen />
        </Section>
        <Section title="Cash: no wallets yet">
          <CashTab cash={{ wallets: [], cashOnHand: 0, unconverted: [], feesPaid: 0 }} baseCurrency="USD" trips={[]} defaultTripId={null} />
        </Section>
        <Section title="Visas &amp; entry table">
          <EntryTable rows={ENTRY.rows} />
        </Section>
        <Section title="Entry tab: 45 planned, 30 allowed">
          <EntryTab tripCountryId="00000000-0000-0000-0000-000000000000" arrive={ENTRY.arrive} depart={ENTRY.depart} requirement={ENTRY_REQUIREMENT} passportCountry="AZ" passportExpiry={null} documents={[{ id: "doc", title: "Japan eVisa", type: "visa" }]} />
        </Section>
        <Section title="Entry tab: empty, no passport set">
          <EntryTab tripCountryId="00000000-0000-0000-0000-000000000000" arrive={ENTRY.arrive} depart={ENTRY.depart} requirement={null} passportCountry={null} passportExpiry={null} documents={[]} />
        </Section>
        <Section title="Essentials: Japan with my edits">
          <EssentialsTab code="JP" countryId="preview" override={{ tipping: "Never tip, it can confuse staff.", embassy_name: "Embassy of Azerbaijan in Tokyo", embassy_phone: "+81 3 0000 0000", embassy_url: "https://example.org" }} />
        </Section>
        <Section title="Essentials: no baseline (Antarctica)">
          <EssentialsTab code="AQ" countryId="preview" override={null} />
        </Section>
      </main>
      </ConfirmProvider>
    </TooltipProvider>
  );
}
