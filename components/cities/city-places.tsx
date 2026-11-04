"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { filterPlaces, placeCategories, placesPreview } from "@/lib/city-pages";
import type { PlaceVM } from "@/lib/data";
import { PLACE_CATEGORY_META } from "@/lib/icons";
import { findDuplicatePlaces, type PlaceLinks } from "@/lib/place-duplicates";
import { PLACE_STATUS_META } from "@/lib/status";
import { PLACE_STATUSES } from "@/lib/types";
import { cn, pluralize } from "@/lib/utils";
import { EmptyState } from "@/components/common/empty-state";
import { DuplicateReview } from "@/components/places/duplicate-review";
import { PlaceRow } from "@/components/places/place-row";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";

/** A city's places. A long list starts as a preview and opens into a panel that scrolls by itself, under the search and filters. */
export function CityPlaces({ places, links }: { places: PlaceVM[]; links: Record<string, PlaceLinks> }) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState("all");
  const [status, setStatus] = useState("all");
  const [expanded, setExpanded] = useState(false);
  const listRoot = useRef<HTMLDivElement>(null);
  const duplicates = useMemo(() => findDuplicatePlaces(places), [places]);
  const flagged = useMemo(() => new Set(duplicates.flat().map((p) => p.id)), [duplicates]);
  const categories = useMemo(() => placeCategories(places), [places]);
  // A merge can take away the last place in the picked category.
  const category = categories.some((c) => c === picked) ? picked : "all";
  const visible = filterPlaces(places, { query, category, status });
  const { long, rows } = placesPreview(visible, expanded);

  // The button that opens the panel sits below the list, so the page may be scrolled past the filters by then. 64px is the top bar.
  useEffect(() => {
    const box = listRoot.current;
    if (!expanded || !box) return;
    const { top, bottom } = box.getBoundingClientRect();
    if (top < 64 || bottom > window.innerHeight) box.scrollIntoView({ block: "start" });
  }, [expanded]);

  return (
    <div className="flex flex-col gap-4">
      <DuplicateReview places={places} duplicates={duplicates} links={links} />
      <div ref={listRoot} className="flex scroll-mt-20 flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name" className="pl-9" aria-label="Search places by name" />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <NativeSelect value={category} onChange={(e) => setPicked(e.target.value)} aria-label="Category" className="sm:w-40">
              <option value="all">Any category</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {PLACE_CATEGORY_META[c].label}
                </option>
              ))}
            </NativeSelect>
            <NativeSelect value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status" className="sm:w-36">
              <option value="all">Any status</option>
              {PLACE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {PLACE_STATUS_META[s].label}
                </option>
              ))}
            </NativeSelect>
          </div>
        </div>
        {rows.length ? (
          <div id="city-places" data-testid="city-places" className={cn("card divide-y divide-border p-2", long && expanded && "max-h-[min(60vh,36rem)] overflow-y-auto overscroll-contain")}>
            {rows.map((p) => (
              <PlaceRow key={p.id} place={p} flagged={flagged.has(p.id)} />
            ))}
          </div>
        ) : (
          <EmptyState compact icon={Search} title="No matches" description="Try another name, category or status." />
        )}
        {long && (
          <div className="flex items-center justify-between gap-3">
            <span className="num text-xs text-muted">{expanded ? pluralize(visible.length, "place") : `Showing ${rows.length} of ${visible.length}`}</span>
            <Button size="sm" variant="secondary" aria-expanded={expanded} aria-controls="city-places" onClick={() => setExpanded((e) => !e)}>
              {expanded ? <ChevronUp /> : <ChevronDown />} {expanded ? "Collapse" : "Show all places"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
