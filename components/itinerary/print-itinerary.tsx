"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Building2, CalendarRange, Flag, Globe2, Printer } from "lucide-react";
import type { CountryVM, PlaceVM } from "@/lib/data";
import type { Booking, ItineraryDay, ItineraryItem, StopType, Trip } from "@/lib/types";
import { STOP_TYPE_META, BOOKING_TYPE_META } from "@/lib/icons";
import { fmtDate, fmtRange, fmtTime } from "@/lib/dates";
import { APP_NAME } from "@/lib/config";
import { PRINT_OPTIONS, printHeading, selectPrintDays, type PrintOptions, type PrintScope, type PrintSelection } from "@/lib/print-itinerary";
import { pluralize } from "@/lib/utils";
import { setUrlParam } from "@/hooks/use-open-sections";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Segmented, Switch } from "@/components/ui/misc";

type PrintDay = { day: ItineraryDay; city: string | null; stops: (ItineraryItem & { place: PlaceVM | null })[]; bookings: Booking[] };
type PrintCity = { id: string; name: string; trip_country_id: string; arrive_date: string | null; depart_date: string | null };

const OPTION_LABELS: Record<keyof PrintOptions, string> = { addresses: "Addresses", notes: "Notes", checkboxes: "Checkboxes" };

/** Fills in what an address left out or got wrong: a country and a city that exist, and dates for a range. */
function settle(sel: PrintSelection, countries: CountryVM[], cities: PrintCity[], dates: string[]): PrintSelection {
  const city = cities.find((c) => c.id === sel.cityId);
  const countryId = countries.some((c) => c.id === sel.countryId) ? sel.countryId : (city?.trip_country_id ?? countries[0]?.id ?? null);
  const cityId = city ? city.id : (cities.find((c) => c.trip_country_id === countryId)?.id ?? cities[0]?.id ?? null);
  const scope: PrintScope = sel.scope === "city" && !cityId ? "country" : sel.scope;
  let { from, to } = sel;
  if (scope === "range" && !from && !to) {
    const country = countries.find((c) => c.id === countryId);
    from = country?.arrive_date ?? dates[0] ?? null;
    to = country?.depart_date ?? dates.at(-1) ?? null;
  }
  return { scope, countryId, cityId, from, to };
}

export function PrintItinerary({
  trip,
  countries,
  cities,
  days,
  initialSelection,
  initialOptions,
}: {
  trip: Trip;
  countries: CountryVM[];
  cities: PrintCity[];
  days: PrintDay[];
  initialSelection: PrintSelection;
  initialOptions: PrintOptions;
}) {
  const dates = useMemo(() => days.flatMap((d) => (d.day.date ? [d.day.date] : [])).sort(), [days]);
  const [sel, setSel] = useState(() => settle(initialSelection, countries, cities, dates));
  const [options, setOptions] = useState(initialOptions);

  const chosen = useMemo(() => {
    const ids = new Set(selectPrintDays(days.map((d) => d.day), sel).map((d) => d.id));
    return days.filter((d) => ids.has(d.day.id));
  }, [days, sel]);
  const country = countries.find((c) => c.id === sel.countryId) ?? null;
  const city = cities.find((c) => c.id === sel.cityId) ?? null;
  const cityCountry = city ? (countries.find((c) => c.id === city.trip_country_id) ?? null) : null;
  const heading = printHeading(sel, {
    appName: APP_NAME,
    trip,
    country: sel.scope === "city" ? cityCountry : country,
    city,
    dates: chosen.map((d) => d.day.date),
  });

  // Countries in route order, each with its chosen days. A country or the whole trip also shows the countries with none.
  const sections = countries
    .filter((c) => (sel.scope === "trip" ? true : sel.scope === "country" ? c.id === sel.countryId : chosen.some((d) => d.day.trip_country_id === c.id)))
    .map((c) => ({ country: c, days: chosen.filter((d) => d.day.trip_country_id === c.id) }));
  // A printout of one country or one city already names it in its title.
  const countryHeadings = sel.scope === "trip" || sel.scope === "range";

  // Next writes the page's own title once its metadata streams in, so the chosen one is put back whenever the head changes.
  useEffect(() => {
    const apply = () => {
      if (document.title !== heading.documentTitle) document.title = heading.documentTitle;
    };
    apply();
    const watch = new MutationObserver(apply);
    watch.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => watch.disconnect();
  }, [heading.documentTitle]);

  useEffect(() => {
    setUrlParam("scope", sel.scope);
    setUrlParam("country", sel.countryId);
    setUrlParam("city", sel.scope === "city" ? sel.cityId : null);
    setUrlParam("from", sel.scope === "range" ? sel.from : null);
    setUrlParam("to", sel.scope === "range" ? sel.to : null);
    setUrlParam("trip", null);
    for (const k of PRINT_OPTIONS) setUrlParam(k, options[k] ? null : "0");
  }, [sel, options]);

  const change = (patch: Partial<PrintSelection>) => setSel((prev) => settle({ ...prev, ...patch }, countries, cities, dates));
  const plannerHref = `/itinerary${sel.countryId ? `?country=${sel.scope === "city" && city ? city.trip_country_id : sel.countryId}` : ""}`;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" asChild>
          <Link href={plannerHref}>
            <ArrowLeft /> Back to planner
          </Link>
        </Button>
        <Button onClick={() => window.print()} disabled={!chosen.length}>
          <Printer /> Print / Save as PDF
        </Button>
      </div>

      <section aria-label="What to print" className="no-print card mb-6 flex flex-col gap-4 p-4 sm:p-5">
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Print</p>
          <Segmented
            className="self-start"
            value={sel.scope}
            onChange={(scope) => change({ scope })}
            options={[
              { value: "country", label: "Selected country", icon: <Flag /> },
              ...(cities.length ? [{ value: "city" as const, label: "Selected city", icon: <Building2 /> }] : []),
              { value: "range", label: "Date range", icon: <CalendarRange /> },
              { value: "trip", label: "Whole trip", icon: <Globe2 /> },
            ]}
          />
          <div className="flex flex-wrap items-center gap-2">
            {sel.scope === "country" && (
              <NativeSelect value={sel.countryId ?? ""} onChange={(e) => change({ countryId: e.target.value, cityId: null })} aria-label="Country" className="w-64 max-w-full">
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </NativeSelect>
            )}
            {sel.scope === "city" && (
              <NativeSelect value={sel.cityId ?? ""} onChange={(e) => change({ cityId: e.target.value, countryId: cities.find((c) => c.id === e.target.value)?.trip_country_id ?? sel.countryId })} aria-label="City" className="w-64 max-w-full">
                {countries.map((c) => {
                  const list = cities.filter((x) => x.trip_country_id === c.id);
                  return list.length ? (
                    <optgroup key={c.id} label={`${c.flag} ${c.name}`}>
                      {list.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.name}
                        </option>
                      ))}
                    </optgroup>
                  ) : null;
                })}
              </NativeSelect>
            )}
            {sel.scope === "range" && (
              <>
                <Input type="date" value={sel.from ?? ""} max={sel.to ?? undefined} onChange={(e) => change({ from: e.target.value || null })} aria-label="From" className="w-44" />
                <span className="text-sm text-muted">to</span>
                <Input type="date" value={sel.to ?? ""} min={sel.from ?? undefined} onChange={(e) => change({ to: e.target.value || null })} aria-label="To" className="w-44" />
              </>
            )}
            <span className="num text-sm text-muted" aria-live="polite">
              {chosen.length ? pluralize(chosen.length, "day") : "No days match"}
            </span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <p className="eyebrow">Include</p>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {PRINT_OPTIONS.map((k) => (
              <label key={k} className="flex min-h-9 cursor-pointer items-center gap-2 text-sm">
                <Switch checked={options[k]} onCheckedChange={(v) => setOptions((o) => ({ ...o, [k]: v }))} />
                {OPTION_LABELS[k]}
              </label>
            ))}
          </div>
        </div>
      </section>

      <article className="rounded-[16px] bg-white p-8 text-[#15181E] shadow-card print:p-0 print:shadow-none sm:p-12">
        <header className="border-b-2 border-[#15181E] pb-5">
          <p className="text-xs uppercase tracking-[0.2em] text-[#61656e]">{heading.eyebrow}</p>
          <h1 className="mt-2 flex items-baseline gap-3 text-[40px] font-semibold leading-none">
            {heading.flag && <span>{heading.flag}</span>}
            {heading.title}
          </h1>
          <p className="mt-2 text-sm text-[#61656e]">{heading.range}</p>
        </header>
        {!chosen.length && sel.scope !== "trip" && sel.scope !== "country" && <p className="mt-8 text-sm text-[#61656e]">No days match this selection.</p>}
        {sections.map(({ country: c, days: list }) => (
          <section key={c.id} className="mt-8">
            {countryHeadings && (
              <h2 className="print-break flex items-baseline gap-3 text-[28px] font-semibold">
                <span>{c.flag}</span> {c.name}
                <span className="text-sm font-normal text-[#61656e]">{fmtRange(c.arrive_date, c.depart_date)}</span>
              </h2>
            )}
            {!list.length && <p className="mt-2 text-sm text-[#61656e]">No days planned yet.</p>}
            <ol className="mt-4 flex flex-col gap-5">
              {list.map(({ day, city: cityName, stops, bookings }) => (
                <li key={day.id} className="print-break border-l-2 border-[#E8532F] pl-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#E8532F]">
                    Day {day.day_number}
                    {day.date ? ` · ${fmtDate(day.date, "EEEE, dd MMM yyyy")}` : ""}
                    {cityName ? ` · ${cityName}` : ""}
                  </p>
                  {day.title && <p className="mt-0.5 font-display text-lg font-semibold">{day.title}</p>}
                  {options.notes && day.notes && <p className="mt-1 whitespace-pre-wrap text-sm text-[#61656e]">{day.notes}</p>}
                  <table className="mt-2 w-full text-sm">
                    <tbody>
                      {bookings.map((b) => (
                        <tr key={b.id} className="border-t border-[#E7E1D6]">
                          <td className="w-24 py-1.5 pr-3 align-top font-mono text-xs">{b.start_at?.slice(11, 16)}</td>
                          <td className="py-1.5 align-top" colSpan={options.checkboxes ? 2 : 1}>
                            <b>{BOOKING_TYPE_META[b.type as keyof typeof BOOKING_TYPE_META]?.label ?? "Booking"}:</b> {b.title}
                            {b.confirmation_no ? <span className="ml-2 font-mono text-xs">#{b.confirmation_no}</span> : null}
                          </td>
                        </tr>
                      ))}
                      {stops.map((s) => (
                        <tr key={s.id} className="border-t border-[#E7E1D6]">
                          <td className="w-24 py-1.5 pr-3 align-top font-mono text-xs">
                            {fmtTime(s.start_time) || "—"}
                            {s.end_time ? `–${fmtTime(s.end_time)}` : ""}
                          </td>
                          <td className="py-1.5 align-top">
                            <span className="font-medium">{s.title}</span>
                            <span className="ml-2 text-xs text-[#61656e]">{STOP_TYPE_META[s.type as StopType]?.label}</span>
                            {options.addresses && s.place?.address && <span className="block text-xs text-[#61656e]">{s.place.address}</span>}
                            {options.notes && s.notes && <span className="block whitespace-pre-wrap text-xs text-[#61656e]">{s.notes}</span>}
                          </td>
                          {options.checkboxes && <td className="w-6 py-1.5 align-top">{s.done ? "✓" : "☐"}</td>}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </article>
    </div>
  );
}
