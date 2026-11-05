"use client";
import { useMemo, useState } from "react";
import { CalendarSearch, Check, ChevronsUpDown } from "lucide-react";
import { fmtDate, todayIso } from "@/lib/dates";
import { dayMatch } from "@/lib/itinerary-days";
import type { ItineraryDay } from "@/lib/types";
import { cn, pluralize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const fold = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** A country's place in the search: its name starting with the words first, then containing them, then its trip's name. */
function countryScore(c: CountryLite, search: string) {
  const q = fold(search.trim());
  if (!q) return 1;
  const name = fold(c.name);
  if (name.startsWith(q)) return 1;
  if (name.includes(q)) return 0.7;
  return fold(c.trip_title).includes(q) ? 0.4 : 0;
}

export type CountryLite = { id: string; name: string; flag: string; trip_id: string; trip_title: string; hasDays: boolean };

/** The planner's country, found by typing its name (or its trip's, when every trip is shown). */
export function CountryPicker({ countries, value, showTripName, onChange }: { countries: CountryLite[]; value: string | null; showTripName: boolean; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = countries.find((c) => c.id === value);
  const byId = useMemo(() => new Map(countries.map((c) => [c.id, c])), [countries]);
  const groups = useMemo(() => {
    if (!showTripName) return [{ id: "all", title: null as string | null, countries }];
    const out: { id: string; title: string | null; countries: CountryLite[] }[] = [];
    for (const c of countries) {
      const g = out.find((x) => x.id === c.trip_id);
      if (g) g.countries.push(c);
      else out.push({ id: c.trip_id, title: c.trip_title, countries: [c] });
    }
    return out;
  }, [countries, showTripName]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" role="combobox" aria-expanded={open} aria-label="Country" className="w-60 justify-between px-3 font-normal">
          <span className="min-w-0 truncate">{current ? `${current.flag} ${current.name}` : "Choose a country"}</span>
          <ChevronsUpDown className="text-muted" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(20rem,calc(100vw-2rem))] overflow-hidden p-0">
        <Command filter={(id, search) => countryScore(byId.get(id)!, search)}>
          <CommandInput placeholder="Search countries…" aria-label="Search countries" />
          <CommandList>
            <CommandEmpty>No country matches.</CommandEmpty>
            {groups.map((g) => (
              <CommandGroup key={g.id} heading={g.title ?? undefined}>
                {g.countries.map((c) => (
                  <CommandItem
                    key={c.id}
                    value={c.id}
                    onSelect={() => {
                      setOpen(false);
                      if (c.id !== value) onChange(c.id);
                    }}
                  >
                    <span className="text-base leading-none">{c.flag}</span>
                    <span className="min-w-0 flex-1 truncate">{c.name}</span>
                    {!c.hasDays && <span className="shrink-0 text-xs text-muted">No days</span>}
                    <Check className={cn("shrink-0", c.id === value ? "opacity-100" : "opacity-0")} />
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Finds a day by its number, its date or its city, and hands it to the planner to open. */
export function JumpToDay({ days, cityName, selected, onJump }: { days: ItineraryDay[]; cityName: (cityId: string | null) => string | null; selected: string | null; onJump: (dayId: string) => void }) {
  const [open, setOpen] = useState(false);
  const byId = useMemo(() => new Map(days.map((d) => [d.id, d])), [days]);
  const today = todayIso();
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="secondary" aria-expanded={open}>
          <CalendarSearch /> Jump to day
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(22rem,calc(100vw-2rem))] overflow-hidden p-0">
        <Command
          filter={(id, search) => {
            const d = byId.get(id);
            return d ? dayMatch(search, d, cityName(d.city_id)) : 0;
          }}
        >
          <CommandInput placeholder="Day number, date or city" aria-label="Find a day" />
          <CommandList>
            <CommandEmpty>No day matches.</CommandEmpty>
            <CommandGroup heading={pluralize(days.length, "day")}>
              {days.map((d) => {
                const city = cityName(d.city_id);
                return (
                  <CommandItem
                    key={d.id}
                    value={d.id}
                    onSelect={() => {
                      setOpen(false);
                      onJump(d.id);
                    }}
                  >
                    <span className={cn("num grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold", d.id === selected ? "bg-accent text-white" : "bg-surface-2 ring-1 ring-border")}>{d.day_number}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate font-medium">
                        {d.date ? fmtDate(d.date, "EEE, dd MMM") : `Day ${d.day_number}`}
                        {d.date === today && <span className="ml-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">TODAY</span>}
                      </span>
                      <span className="truncate text-xs text-muted">{[city ?? "No city", d.title].filter(Boolean).join(" · ")}</span>
                    </span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
