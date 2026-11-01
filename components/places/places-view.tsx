"use client";
import { useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, Map as MapIcon, MapPin, Plus, Search, Star, Table2 } from "lucide-react";
import type { PlaceVM } from "@/lib/data";
import { PLACE_CATEGORIES, PLACE_STATUSES, type PhotoView, type PlaceCategory, type PlaceStatus } from "@/lib/types";
import { PLACE_CATEGORY_META } from "@/lib/icons";
import { PLACE_STATUS_META } from "@/lib/status";
import { formatMoney } from "@/lib/money";
import { Cover } from "@/components/common/cover";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition, Stagger, StaggerItem } from "@/components/common/motion";
import { PlaceStatusChip } from "@/components/common/status-chip";
import { FlagChip } from "@/components/common/flag";
import { PlaceDialog } from "@/components/forms/place-dialog";
import { MapView } from "@/components/map/map";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { FilterChip, Segmented } from "@/components/ui/misc";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { useWorkspace } from "@/components/shell/workspace";
import { MarkVisitedButton, PlaceThumb } from "./place-row";
import { PlaceDrawerContent, type PlaceStop } from "./place-drawer";

type View = "grid" | "table" | "map";

export function PlacesView({
  places,
  cities,
  open,
  openPhotos,
  openAttribution,
  openStops,
  baseCurrency: _baseCurrency,
}: {
  places: PlaceVM[];
  cities: { id: string; name: string; flag: string }[];
  open: PlaceVM | null;
  openPhotos: PhotoView[];
  openAttribution: string | null;
  openStops: PlaceStop[];
  baseCurrency: string;
}) {
  const ws = useWorkspace();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [view, setView] = useState<View>("grid");
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("all");
  const [category, setCategory] = useState<PlaceCategory | "all">("all");
  const [status, setStatus] = useState<PlaceStatus | "all">("all");
  const [editing, setEditing] = useState<PlaceVM | null>(null);

  const setOpen = (id: string | null) => {
    const next = new URLSearchParams(sp.toString());
    if (id) next.set("open", id);
    else next.delete("open");
    router.push(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  };

  const filtered = useMemo(
    () =>
      places.filter(
        (p) =>
          (city === "all" || p.city_id === city) &&
          (category === "all" || p.category === category) &&
          (status === "all" || p.status === status) &&
          (!query || `${p.name} ${p.address ?? ""} ${p.city_name}`.toLowerCase().includes(query.toLowerCase())),
      ),
    [places, city, category, status, query],
  );
  const usedCategories = PLACE_CATEGORIES.filter((c) => places.some((p) => p.category === c));

  return (
    <PageTransition>
      <PageHeader
        eyebrow="Plan"
        title="Places"
        description={places.length ? `${places.length} sights and spots · ${places.filter((p) => p.status === "visited").length} visited` : "Sights, food spots, cafés — everything worth a detour."}
        actions={
          <Button onClick={() => ws.openQuickAdd({ kind: "place", cityId: city !== "all" ? city : undefined })}>
            <Plus /> Add place
          </Button>
        }
      />
      {!places.length ? (
        <EmptyState
          icon={MapPin}
          title={cities.length ? "Save your first place" : "Add a city first"}
          description={cities.length ? "Search by name, drop a pin, or just type it. Photos are fetched automatically." : "Places belong to cities. Add a few cities, then come back."}
          action={
            <Button onClick={() => ws.openQuickAdd(cities.length ? "place" : "city")}>
              <Plus /> {cities.length ? "Add a place" : "Add cities"}
            </Button>
          }
        />
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search places" className="pl-9" aria-label="Search places" />
            </div>
            <div className="flex gap-2">
              <NativeSelect value={city} onChange={(e) => setCity(e.target.value)} aria-label="City" className="flex-1 sm:w-44">
                <option value="all">All cities</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect value={status} onChange={(e) => setStatus(e.target.value as PlaceStatus | "all")} aria-label="Status" className="flex-1 sm:w-36">
                <option value="all">Any status</option>
                {PLACE_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {PLACE_STATUS_META[s].label}
                  </option>
                ))}
              </NativeSelect>
              <Segmented
                value={view}
                onChange={setView}
                options={[
                  { value: "grid", label: "Cards", icon: <LayoutGrid /> },
                  { value: "table", label: "Table", icon: <Table2 /> },
                  { value: "map", label: "Map", icon: <MapIcon /> },
                ]}
              />
            </div>
          </div>
          <div className="scrollbar-none -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 md:mx-0 md:px-0">
            <FilterChip active={category === "all"} onClick={() => setCategory("all")}>
              All
            </FilterChip>
            {usedCategories.map((c) => {
              const m = PLACE_CATEGORY_META[c];
              return (
                <FilterChip key={c} active={category === c} onClick={() => setCategory(c)}>
                  <m.icon style={{ color: category === c ? undefined : m.color }} /> {m.label}
                </FilterChip>
              );
            })}
          </div>

          {!filtered.length ? (
            <EmptyState compact icon={Search} title="No matches" description="Try different filters." />
          ) : view === "grid" ? (
            <Stagger className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((p) => {
                const m = PLACE_CATEGORY_META[p.category as PlaceCategory] ?? PLACE_CATEGORY_META.other;
                return (
                  <StaggerItem key={p.id}>
                    <div role="button" tabIndex={0} onClick={() => setOpen(p.id)} onKeyDown={(e) => e.key === "Enter" && setOpen(p.id)} className="card card-hover block cursor-pointer overflow-hidden text-left">
                      <Cover src={p.cover_url} alt={p.name} seed={p.id} icon={m.icon} className="aspect-[4/3]">
                        <div className="photo-gradient absolute inset-0" />
                        <div className="absolute inset-x-3 top-3 flex items-start justify-between">
                          {p.country_code ? <FlagChip code={p.country_code} size="sm" onPhoto /> : <span />}
                          <PlaceStatusChip status={p.status as PlaceStatus} onPhoto size="sm" />
                        </div>
                        <div className="absolute inset-x-3.5 bottom-3 text-white">
                          <p className="flex items-center gap-1.5 text-xs text-white/85">
                            <m.icon className="size-3.5" /> {m.label} · {p.city_name}
                          </p>
                          <h3 className="line-clamp-2 text-lg font-semibold leading-tight">{p.name}</h3>
                        </div>
                      </Cover>
                      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5">
                        <span className="flex items-center gap-1 text-sm text-muted">
                          {p.rating ? (
                            <>
                              <Star className="size-3.5 fill-planned text-planned" /> {p.rating}
                            </>
                          ) : (
                            "Not rated"
                          )}
                          {p.cost_estimate != null && <span className="num ml-2">≈ {formatMoney(Number(p.cost_estimate), p.cost_currency ?? "USD")}</span>}
                        </span>
                        <MarkVisitedButton place={p} className="size-8" />
                      </div>
                    </div>
                  </StaggerItem>
                );
              })}
            </Stagger>
          ) : view === "table" ? (
            <div className="card overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="border-b border-border text-left text-xs uppercase tracking-wider text-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium">Place</th>
                    <th className="px-4 py-3 font-medium">City</th>
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 font-medium">Rating</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 text-right font-medium">Visited</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filtered.map((p) => {
                    const m = PLACE_CATEGORY_META[p.category as PlaceCategory] ?? PLACE_CATEGORY_META.other;
                    return (
                      <tr key={p.id} onClick={() => setOpen(p.id)} className="cursor-pointer hover:bg-ink/[0.03]">
                        <td className="px-4 py-2">
                          <span className="flex items-center gap-3">
                            <PlaceThumb place={p} className="size-9 rounded-lg" />
                            <span className="font-medium">{p.name}</span>
                          </span>
                        </td>
                        <td className="px-4 py-2 text-muted">{p.city_name}</td>
                        <td className="px-4 py-2">
                          <span className="flex items-center gap-1.5">
                            <m.icon className="size-4" style={{ color: m.color }} /> {m.label}
                          </span>
                        </td>
                        <td className="num px-4 py-2">{p.rating ? `★ ${p.rating}` : "—"}</td>
                        <td className="px-4 py-2">
                          <PlaceStatusChip status={p.status as PlaceStatus} size="sm" />
                        </td>
                        <td className="px-4 py-2 text-right">
                          <MarkVisitedButton place={p} className="ml-auto size-8" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <MapView
              className="h-[62vh] min-h-96 rounded-[16px] border border-border"
              markers={filtered.filter((p) => p.lat != null && p.lng != null).map((p) => {
                const m = PLACE_CATEGORY_META[p.category as PlaceCategory] ?? PLACE_CATEGORY_META.other;
                return { id: p.id, lat: p.lat!, lng: p.lng!, label: p.name, color: m.color, glyph: p.status === "visited" ? "✓" : "" };
              })}
              onMarkerClick={(id) => setOpen(id)}
              emptyLabel="None of these places has coordinates"
            />
          )}
        </>
      )}
      <ResponsiveSheet open={Boolean(open)} onOpenChange={(o) => !o && setOpen(null)} title={open?.name ?? "Place"}>
        {open && (
          <PlaceDrawerContent
            key={open.id}
            place={open}
            photos={openPhotos}
            attribution={openAttribution}
            stops={openStops}
            onEdit={() => {
              setEditing(open);
              setOpen(null);
            }}
            onDeleted={() => setOpen(null)}
          />
        )}
      </ResponsiveSheet>
      {editing && <PlaceDialog open onOpenChange={(o) => !o && setEditing(null)} place={editing} />}
    </PageTransition>
  );
}
