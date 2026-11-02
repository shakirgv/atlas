"use client";
import { CloudOff, CloudSun, Droplets } from "lucide-react";
import { CLIMATE_LABEL, climateKey, MONTH_NAMES, monthsInStay, verdictForStay, verdictReason, weatherFromCode, type ClimateMonth, type ForecastDay } from "@/lib/climate";
import { fmtDate } from "@/lib/dates";
import { useClimate, useForecast } from "@/hooks/use-climate";
import { Skeleton } from "@/components/ui/misc";
import { VerdictChip } from "@/components/climate/verdict-chip";

export type WeatherStop = {
  name: string;
  lat: number;
  lng: number;
  arrive: string | null;
  depart: string | null;
  ongoing: boolean;
  /** Decided on the server: ongoing, or arriving within the next 14 days. */
  forecastDue: boolean;
  /** The day to show the forecast for (today while ongoing, else the arrival date). */
  focusDate: string | null;
};

export function ForecastView({ days, stop }: { days: ForecastDay[]; stop: WeatherStop }) {
  const start = Math.max(0, days.findIndex((d) => d.date === stop.focusDate));
  const day = days[start]!;
  const w = weatherFromCode(day.code);
  return (
    <>
      <div className="flex items-center gap-3">
        <w.icon className="size-9 shrink-0 text-accent" />
        <div className="min-w-0">
          <p className="num font-display text-[26px] font-semibold leading-none">
            {Math.round(day.tmax)}° <span className="text-lg text-muted">{Math.round(day.tmin)}°</span>
          </p>
          <p className="mt-1 truncate text-xs text-muted">
            {w.label}
            {day.rainChance != null && (
              <span className="ml-1.5 inline-flex items-center gap-0.5">
                <Droplets className="size-3" /> {day.rainChance}%
              </span>
            )}
          </p>
        </div>
      </div>
      <ul className="mt-auto grid grid-cols-3 gap-2 border-t border-border pt-2.5">
        {days.slice(start + 1, start + 4).map((d) => {
          const f = weatherFromCode(d.code);
          return (
            <li key={d.date} className="flex flex-col items-center gap-0.5 text-xs">
              <span className="text-muted">{fmtDate(d.date, "EEE")}</span>
              <f.icon className="size-4 text-muted" aria-label={f.label} />
              <span className="num">
                {Math.round(d.tmax)}° <span className="text-muted">{Math.round(d.tmin)}°</span>
              </span>
            </li>
          );
        })}
      </ul>
    </>
  );
}

export function NormalsView({ months, stop }: { months: ClimateMonth[]; stop: WeatherStop }) {
  const planned = monthsInStay(stop.arrive, stop.depart);
  const month = months.find((m) => m.month === planned[0]) ?? months[0]!;
  const v = verdictForStay(months, stop.arrive, stop.depart);
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="num font-display text-[26px] font-semibold leading-none">
          {Math.round(month.tmax)}° <span className="text-lg text-muted">{Math.round(month.tmin)}°</span>
        </p>
        {v && <VerdictChip verdict={v.verdict} size="sm" title={verdictReason(v.month)} />}
      </div>
      <p className="text-xs text-muted">
        {MONTH_NAMES[month.month - 1]}: {Math.round(month.precip)} mm, {Math.round(month.wetDays)} wet days
      </p>
      <p className="mt-auto text-[11px] text-muted">{CLIMATE_LABEL}</p>
    </>
  );
}

/** Forecast when the stop is 14 days away or less, otherwise climate normals. Falls back to normals if the forecast fails. */
export function WeatherTile({ stop }: { stop: WeatherStop }) {
  const forecast = useForecast(stop.lat, stop.lng, stop.forecastDue);
  const showForecast = stop.forecastDue && !forecast.failed;
  const climate = useClimate(showForecast ? [] : [stop]);
  const months = climate.data[climateKey(stop.lat, stop.lng)];
  const loading = showForecast ? forecast.loading : climate.loading;

  return (
    <section className="card flex h-full flex-col gap-3 p-5" aria-label="Weather at next stop">
      <div>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <CloudSun className="size-5 text-accent" /> Weather
        </h2>
        <p className="mt-0.5 truncate text-xs text-muted">
          {stop.name}
          {stop.ongoing ? " · today" : stop.focusDate ? ` · ${fmtDate(stop.focusDate, "dd MMM")}` : ""}
        </p>
      </div>
      {loading ? (
        <Skeleton className="h-20 w-full" />
      ) : showForecast && forecast.days ? (
        <ForecastView days={forecast.days} stop={stop} />
      ) : months ? (
        <NormalsView months={months} stop={stop} />
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted">
          <CloudOff className="size-4 shrink-0" /> Weather unavailable
        </p>
      )}
    </section>
  );
}
