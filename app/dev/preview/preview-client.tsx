"use client";
import type { ClimateMonth, ForecastDay, Verdict } from "@/lib/climate";
import { ClimateCard } from "@/components/climate/climate-card";
import { VerdictChip } from "@/components/climate/verdict-chip";
import { ForecastView, NormalsView, type WeatherStop } from "@/components/dashboard/weather-tile";
import { EssentialsTab } from "@/components/countries/essentials-tab";
import { EntryTab } from "@/components/entry/entry-tab";
import { EntryTable } from "@/components/entry/entry-table";
import { entryOverview } from "@/lib/entry";
import { shiftIso, todayIso } from "@/lib/dates";
import type { EntryRequirement } from "@/lib/types";
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
    </TooltipProvider>
  );
}
