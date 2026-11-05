"use client";
import { Search, X } from "lucide-react";
import { hasFilters, NO_FILTERS, withCity, withCountry, type FilterOption, type MemoryFilters } from "@/lib/memory-filters";
import { pluralize } from "@/lib/utils";
import { Input, NativeSelect } from "@/components/ui/input";

type Options = { countries: FilterOption[]; cities: (FilterOption & { country: string })[]; years: FilterOption[]; tags: FilterOption[] };

/** Search and filters shared by Timeline, Gallery and Map. */
export function MemoryFilterBar({ filters, onChange, options, shown, total }: { filters: MemoryFilters; onChange: (f: MemoryFilters) => void; options: Options; shown: number; total: number }) {
  const cities = options.cities.filter((c) => !filters.country || c.country === filters.country);
  // A value from the URL that matches nothing still shows, so it can be cleared.
  const keep = (list: FilterOption[], value: string) => (value && !list.some((o) => o.value === value) ? [...list, { value, label: value, count: 0 }] : list);
  const active = hasFilters(filters);
  return (
    <div className="flex flex-col gap-2" role="search" aria-label="Filter memories">
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-full flex-1 sm:min-w-52">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input type="search" value={filters.q} onChange={(e) => onChange({ ...filters, q: e.target.value })} placeholder="Search titles and text" aria-label="Search memories" className="pl-9" />
        </div>
        <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
          <NativeSelect value={filters.country} onChange={(e) => onChange(withCountry(filters, e.target.value))} aria-label="Country" className="sm:w-44">
            <option value="">All countries</option>
            {keep(options.countries, filters.country).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={filters.city} onChange={(e) => onChange(withCity(filters, e.target.value))} aria-label="City" className="sm:w-40">
            <option value="">All cities</option>
            {keep(cities, filters.city).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={filters.year} onChange={(e) => onChange({ ...filters, year: e.target.value })} aria-label="Year" className="sm:w-28">
            <option value="">All years</option>
            {keep(options.years, filters.year).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </NativeSelect>
          <NativeSelect value={filters.tag} onChange={(e) => onChange({ ...filters, tag: e.target.value })} aria-label="Tag" className="sm:w-36" disabled={!options.tags.length && !filters.tag}>
            <option value="">All tags</option>
            {keep(options.tags, filters.tag).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label.startsWith("#") ? o.label : `#${o.label}`}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {active && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-muted" aria-live="polite">
          <span className="num">
            {shown} of {pluralize(total, "memory", "memories")}
          </span>
          <button type="button" onClick={() => onChange(NO_FILTERS)} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
            <X className="size-3.5" /> Clear filters
          </button>
        </p>
      )}
    </div>
  );
}
