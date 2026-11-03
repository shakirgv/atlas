"use client";
import { useMemo, useState, useTransition } from "react";
import { ChevronDown, CopyCheck, Loader2, MapPin, Plus, Search, Star } from "lucide-react";
import { toast } from "sonner";
import { mergePlaces } from "@/actions/places";
import type { CityVM, PlaceVM } from "@/lib/data";
import { matchesName } from "@/lib/normalize-name";
import { findDuplicatePlaces, keeperFor, type PlaceLinks } from "@/lib/place-duplicates";
import { PLACE_STATUS_META } from "@/lib/status";
import { PLACE_STATUSES, type PlaceStatus } from "@/lib/types";
import { cn, pluralize } from "@/lib/utils";
import { EmptyState } from "@/components/common/empty-state";
import { SectionTitle } from "@/components/common/page-header";
import { PlaceStatusChip } from "@/components/common/status-chip";
import { PlaceRow } from "@/components/places/place-row";
import { useWorkspace } from "@/components/shell/workspace";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/misc";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

const linkCount = (l: PlaceLinks | undefined) => [l?.stops ? pluralize(l.stops, "stop") : null, l?.memories ? pluralize(l.memories, "memory", "memories") : null].filter(Boolean).join(" · ");

/** Nothing is merged until the button at the bottom is pressed, with the place to keep and the ones to fold in both on show. */
function MergeDialog({ group, links, onOpenChange }: { group: PlaceVM[]; links: Record<string, PlaceLinks>; onOpenChange: (open: boolean) => void }) {
  const [keep, setKeep] = useState(() => keeperFor(group, links).id);
  const [left, setLeft] = useState<Set<string>>(new Set());
  const [pending, start] = useTransition();
  const merging = group.filter((p) => p.id !== keep && !left.has(p.id));
  const kept = group.find((p) => p.id === keep)!;
  const merge = () =>
    start(async () => {
      const res = await mergePlaces(keep, merging.map((p) => p.id));
      if (!res.ok) return void toast.error(res.error);
      const moved = [res.data.stops ? pluralize(res.data.stops, "stop") : null, res.data.memories ? pluralize(res.data.memories, "memory", "memories") : null, res.data.photos ? pluralize(res.data.photos, "photo") : null].filter(Boolean).join(", ");
      toast.success(`Merged into ${kept.name}`, { description: moved ? `Moved ${moved}.` : undefined });
      onOpenChange(false);
    });
  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title="Merge possible duplicates"
      description="Choose the place to keep. Stops, memories and photos move to it, along with any visit and rating. This can't be undone."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Keep them separate
          </Button>
          <Button onClick={merge} disabled={pending || !merging.length}>
            {pending && <Loader2 className="animate-spin" />} {merging.length ? `Merge ${pluralize(merging.length, "place")} into ${kept.name}` : "Pick a place to merge"}
          </Button>
        </>
      }
    >
      <ul className="flex flex-col gap-2 pb-2" data-testid="merge-list">
        {group.map((p) => {
          const isKept = p.id === keep;
          return (
            <li key={p.id} className={cn("rounded-xl border p-3", isKept ? "border-ink/40 bg-surface-2" : "border-border")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="min-w-0 break-words font-medium">{p.name}</span>
                <PlaceStatusChip status={p.status as PlaceStatus} size="sm" />
                {p.rating ? (
                  <span className="num flex items-center gap-0.5 text-xs text-muted">
                    <Star className="size-3 fill-planned text-planned" /> {p.rating}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-xs text-muted">{[linkCount(links[p.id]) || "Not linked to any stop or memory", p.address].filter(Boolean).join(" · ")}</p>
              <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <label className="flex min-h-9 items-center gap-2">
                  <input type="radio" name="merge-keep" checked={isKept} onChange={() => setKeep(p.id)} className="size-4 accent-[var(--accent)]" />
                  Keep this one
                </label>
                {!isKept && (
                  <label className="flex min-h-9 items-center gap-2">
                    <Checkbox checked={!left.has(p.id)} onCheckedChange={(v) => setLeft((prev) => {
                      const next = new Set(prev);
                      if (v === true) next.delete(p.id);
                      else next.add(p.id);
                      return next;
                    })} />
                    Merge into it
                  </label>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </ResponsiveDialog>
  );
}

export function PlacesTab({ countryId, cities, places, links }: { countryId: string; cities: CityVM[]; places: PlaceVM[]; links: Record<string, PlaceLinks> }) {
  const ws = useWorkspace();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<PlaceStatus | "all">("all");
  const [closed, setClosed] = useState<Set<string>>(new Set());
  const [reviewing, setReviewing] = useState<string[] | null>(null);
  const duplicates = useMemo(() => findDuplicatePlaces(places), [places]);
  const flagged = useMemo(() => new Set(duplicates.flat().map((p) => p.id)), [duplicates]);
  const visible = places.filter((p) => (status === "all" || p.status === status) && matchesName(p.name, query));
  const searching = Boolean(query.trim());
  const groups = cities.map((c) => ({ city: c, places: visible.filter((p) => p.city_id === c.id) })).filter((g) => g.places.length > 0);
  // Read fresh each time, so the dialog doesn't hold on to a place that has since been merged away.
  const reviewGroup = reviewing ? places.filter((p) => reviewing.includes(p.id)) : [];
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
      {duplicates.length > 0 && (
        <section className="card flex flex-col gap-2 p-4" aria-label="Possible duplicates">
          <h3 className="flex items-center gap-2 font-semibold">
            <CopyCheck className="size-4 text-accent" /> Possible duplicates
          </h3>
          <ul className="flex flex-col divide-y divide-border">
            {duplicates.map((group) => (
              <li key={group[0]!.id} className="flex flex-col gap-1.5 py-2 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                <span className="min-w-0 break-words text-sm">
                  {group.map((p) => p.name).join(", ")} <span className="text-muted">in {group[0]!.city_name}</span>
                </span>
                <Button size="sm" variant="secondary" className="shrink-0 self-start sm:self-auto" onClick={() => setReviewing(group.map((p) => p.id))}>
                  Review
                </Button>
              </li>
            ))}
          </ul>
        </section>
      )}
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
      {reviewGroup.length > 1 && <MergeDialog key={reviewing!.join()} group={reviewGroup} links={links} onOpenChange={(o) => !o && setReviewing(null)} />}
    </div>
  );
}
