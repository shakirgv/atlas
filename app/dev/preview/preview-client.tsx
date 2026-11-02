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
import { useState } from "react";
import type { Expense, PhotoView } from "@/lib/types";
import { planExchange, planSpend, planWithdrawal, summarizeCash } from "@/lib/cash";
import { entryOverview } from "@/lib/entry";
import { shiftIso, todayIso } from "@/lib/dates";
import type { EntryRequirement } from "@/lib/types";
import { ConfirmProvider } from "@/components/ui/confirm";
import { TooltipProvider } from "@/components/ui/tooltip";

const VERDICTS: Verdict[] = ["good", "hot", "rainy", "cold", "very_hot", "freezing"];
const TOKYO: WeatherStop = { name: "Tokyo", lat: 35.68, lng: 139.65, arrive: "2027-07-05", depart: "2027-07-20", ongoing: false, forecastDue: true, focusDate: null };

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
