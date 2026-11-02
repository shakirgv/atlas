"use client";
import type { ClimateMonth, ForecastDay, Verdict } from "@/lib/climate";
import { ClimateCard } from "@/components/climate/climate-card";
import { VerdictChip } from "@/components/climate/verdict-chip";
import { ForecastView, NormalsView, type WeatherStop } from "@/components/dashboard/weather-tile";
import { EssentialsTab } from "@/components/countries/essentials-tab";
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
