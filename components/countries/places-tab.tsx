"use client";
import { useMemo, useState } from "react";
import { ChevronDown, MapPin, Plus, Search } from "lucide-react";
import type { CityVM, PlaceVM } from "@/lib/data";
import { matchesName } from "@/lib/normalize-name";
import { findDuplicatePlaces, type PlaceLinks } from "@/lib/place-duplicates";
import { PLACE_STATUS_META } from "@/lib/status";
import { PLACE_STATUSES, type PlaceStatus } from "@/lib/types";
import { cn, pluralize } from "@/lib/utils";
import { EmptyState } from "@/components/common/empty-state";
import { SectionTitle } from "@/components/common/page-header";
import { DuplicateReview } from "@/components/places/duplicate-review";
import { PlaceRow } from "@/components/places/place-row";
import { useWorkspace } from "@/components/shell/workspace";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";

export function PlacesTab({ countryId, cities, places, links }: { countryId: string; cities: CityVM[]; places: PlaceVM[]; links: Record<string, PlaceLinks> }) {
  const ws = useWorkspace();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PlaceStatus | "all">("all");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const duplicates = useMemo(() => findDuplicatePlaces(places), [places]);
  const flagged = useMemo(() => new Set(duplicates.flat().map((p) => p.id)), [duplicates]);
  const visible = places.filter((p) => (status === "all" || p.status === status) && matchesName(p.name, query));
  const searching = Boolean(query.trim());
  const groups = cities.map((c) => ({ city: c, places: visible.filter((p) => p.city_id === c.id) })).filter((g) => g.places.length > 0);
  const toggle = (id: string) =>
    setClosed((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });

  const add = () => ws.openQuickAdd(cities.length ? { kind: "place", cityId: cities[0]?.id } : { kind: "city", tripCountryId: countryId });
  if (!places.length) {
    return <EmptyState icon={MapPin} title="No places yet" description={cities.length ? "Sights, food spots, cafés — save them here." : "Add a city first, then save places in it."} action={<Button onClick={add}><Plus /> {cities.length ? "Add place" : "Add cities"}</Button>} />;
  }
  return (
    <div className="flex flex-col gap-4">
      <SectionTitle className="mb-0" action={<Button size="sm" onClick={add}><Plus /> Add place</Button>}>
        {pluralize(places.length, "place")}
      </SectionTitle>
      <DuplicateReview places={places} duplicates={duplicates} links={links} />
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" className="pl-9" aria-label="Search places by name" />
        </div>
        <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as PlaceStatus | "all")} aria-label="Status" className="sm:w-44">
          <option value="all">Any status</option>
          {PLACE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {PLACE_STATUS_META[s].label}
            </option>
          ))}
        </NativeSelect>
      </div>
      {groups.length ? (
        <div className="flex flex-col gap-3">
          {groups.map(({ city, places: rows }) => {
            // A search looks through every group, so a closed one can't hide a match.
            const open = searching || !closed.has(city.id);
            return (
              <section key={city.id} className="card overflow-hidden" aria-label={city.name}>
                <button type="button" aria-expanded={open} aria-controls={`places-${city.id}`} onClick={() => toggle(city.id)} disabled={searching} className="flex min-h-12 w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-ink/[0.03] disabled:hover:bg-transparent">
                  <span className="min-w-0 flex-1 truncate font-semibold">{city.name}</span>
                  <span className="num shrink-0 text-xs text-muted">{pluralize(rows.length, "place")}</span>
                  <ChevronDown className={cn("size-4 shrink-0 text-muted transition-transform", open && "rotate-180")} />
                </button>
                {open && (
                  <div id={`places-${city.id}`} className="divide-y divide-border border-t border-border p-2">
                    {rows.map((p) => (
                      <PlaceRow key={p.id} place={p} flagged={flagged.has(p.id)} />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState compact icon={Search} title="No matches" description="Try another name or status." />
      )}
    </div>
  );
}
