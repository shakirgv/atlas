"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { Loader2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { lookupTimezone, updateHome } from "@/actions/settings";
import { COUNTRIES, countryFlag, countryName } from "@/lib/countries";
import { browserTimeZone, formatLocalTime } from "@/lib/timezones";
import type { Settings } from "@/lib/types";
import { useGeocode } from "@/hooks/use-geocode";
import { MoreDetails, SubmitButton } from "@/components/forms/form-bits";
import { Field, Input, NativeSelect } from "@/components/ui/input";

/** Settings → Home (city search → name, coordinates, time zone) and Passport country. */
export function HomeSection({ settings }: { settings: Settings | null }) {
  const [pending, start] = useTransition();
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const [city, setCity] = useState(settings?.home_city ?? "");
  const [lat, setLat] = useState(settings?.home_lat != null ? String(settings.home_lat) : "");
  const [lng, setLng] = useState(settings?.home_lng != null ? String(settings.home_lng) : "");
  const [tz, setTz] = useState(settings?.home_timezone ?? "");
  const [passport, setPassport] = useState(settings?.passport_country?.trim() ?? "");
  const [lookingUp, startLookup] = useTransition();
  const { results, loading } = useGeocode(query, { layer: "city", enabled: focused });
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const t = setTimeout(() => setNow(new Date()), 0);
    return () => clearTimeout(t);
  }, []);

  // Fixed locale: the default collation differs between server and browser, which breaks hydration.
  const countries = useMemo(() => [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name, "en")), []);

  const pick = (r: { name: string; label: string; lat: number; lng: number }) => {
    setCity(r.label.split(",").slice(0, 2).join(",").trim() || r.name);
    setLat(r.lat.toFixed(4));
    setLng(r.lng.toFixed(4));
    setQuery("");
    setFocused(false);
    startLookup(async () => {
      const res = await lookupTimezone(r.lat, r.lng);
      if (res.ok && res.data.timezone) setTz(res.data.timezone);
    });
  };

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    start(async () => {
      const res = await updateHome({ home_city: city, home_lat: lat, home_lng: lng, home_timezone: tz, passport_country: passport });
      if (!res.ok) return void toast.error(res.error);
      if (res.data.timezone) setTz(res.data.timezone);
      toast.success("Home and passport saved");
    });
  };

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <Field label="Home city" htmlFor="home-search" hint={city ? `Current: ${city}${tz ? ` · ${tz}` : ""}` : "Search your home city — coordinates and time zone fill in automatically."}>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input
            id="home-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            placeholder={city || "Baku, Berlin, Toronto…"}
            className="pl-9"
            autoComplete="off"
            role="combobox"
            aria-expanded={focused && results.length > 0}
            aria-controls="home-results"
          />
          {loading && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" />}
          {focused && results.length > 0 && (
            <ul id="home-results" role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-border bg-surface p-1 shadow-lg">
              {results.slice(0, 8).map((r) => (
                <li key={r.id} role="option" aria-selected={false}>
                  <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(r)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-ink/5">
                    <MapPin className="size-4 shrink-0 text-accent" />
                    <span className="truncate">{r.label}</span>
                    {r.countryCode && <span className="ml-auto">{countryFlag(r.countryCode)}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Field>
      <MoreDetails label="Edit home details">
        <Field label="Name" htmlFor="home-name">
          <Input id="home-name" value={city} onChange={(e) => setCity(e.target.value)} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Latitude" htmlFor="home-lat">
            <Input id="home-lat" inputMode="decimal" value={lat} onChange={(e) => setLat(e.target.value)} />
          </Field>
          <Field label="Longitude" htmlFor="home-lng">
            <Input id="home-lng" inputMode="decimal" value={lng} onChange={(e) => setLng(e.target.value)} />
          </Field>
        </div>
        <Field label="Time zone (IANA)" htmlFor="home-tz" hint={`Leave empty to look it up from the coordinates.${now ? ` This device: ${browserTimeZone()}.` : ""}`}>
          <div className="relative">
            <Input id="home-tz" value={tz} onChange={(e) => setTz(e.target.value)} placeholder="Asia/Baku" />
            {lookingUp && <Loader2 className="absolute right-3 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" />}
          </div>
        </Field>
      </MoreDetails>
      <Field label="Passport country" htmlFor="passport" hint="Used only to label visa requirements you enter yourself. Never assumed.">
        <NativeSelect id="passport" value={passport} onChange={(e) => setPassport(e.target.value)}>
          <option value="">Not set</option>
          {countries.map((c) => (
            <option key={c.cca2} value={c.cca2}>
              {c.flag} {c.name}
            </option>
          ))}
        </NativeSelect>
      </Field>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted">
          {tz && now ? `Home time now: ${formatLocalTime(tz, now)}` : null}
          {passport ? `${tz && now ? " · " : ""}Passport: ${countryFlag(passport)} ${countryName(passport)}` : null}
        </p>
        <SubmitButton pending={pending}>Save home & passport</SubmitButton>
      </div>
    </form>
  );
}
