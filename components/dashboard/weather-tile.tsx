"use client";
import { CloudOff, Droplets } from "lucide-react";
import { climateKey, monthsInStay, typicalWeatherLabel, verdictForStay, verdictReason, weatherFromCode, type ClimateMonth, type ForecastDay } from "@/lib/climate";
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
  /** Decided on the server: arriving within the next 14 days. */
  forecastDue: boolean;
  /** The day to show the forecast for: the arrival date. */
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
  // Only the labelled month, so a stay running into December can't put its verdict on "Typical November weather".
  const v = verdictForStay(months, stop.arrive ?? stop.depart, stop.arrive ?? stop.depart);
  return (
    <>
      <p className="text-xs font-medium text-muted">{typicalWeatherLabel(month.month)}</p>
      <div className="flex items-start justify-between gap-2">
        <p className="num font-display text-[26px] font-semibold leading-none">
          {Math.round(month.tmax)}° <span className="text-lg text-muted">{Math.round(month.tmin)}°</span>
        </p>
        {v && <VerdictChip verdict={v.verdict} size="sm" title={verdictReason(v.month)} />}
      </div>
      <p className="text-xs text-muted">
        {Math.round(month.precip)} mm, {Math.round(month.wetDays)} wet days · last 5 years
      </p>
    </>
  );
}

/** Typical weather for the travel month, plus the real forecast once the arrival date is within its range. */
export function DestinationWeather({ stop }: { stop: WeatherStop }) {
  const forecast = useForecast(stop.lat, stop.lng, stop.forecastDue);
  const climate = useClimate([stop]);
  const months = climate.data[climateKey(stop.lat, stop.lng)];
  const forecastDays = forecast.days?.some((d) => d.date === stop.focusDate) ? forecast.days : null;

  return (
    <div className="flex flex-1 flex-col gap-3 border-t border-border pt-3">
      {climate.loading ? (
        <Skeleton className="h-20 w-full" />
      ) : months ? (
        <div className="flex flex-col gap-2">
          <NormalsView months={months} stop={stop} />
        </div>
      ) : (
        <p className="flex items-center gap-2 text-sm text-muted">
          <CloudOff className="size-4 shrink-0" /> Weather unavailable
        </p>
      )}
      {forecastDays && (
        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <p className="text-xs font-medium text-muted">Forecast · {fmtDate(stop.focusDate, "dd MMM")}</p>
          <ForecastView days={forecastDays} stop={stop} />
        </div>
      )}
    </div>
  );
}
