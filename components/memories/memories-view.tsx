"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { Camera, Images, Map as MapIcon, MapPin, MoreHorizontal, Pencil, Rows3, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteMemory } from "@/actions/memories";
import type { MemoryVM } from "@/lib/data";
import type { PhotoView } from "@/lib/types";
import { fmtDate, fmtMonth, monthKey } from "@/lib/dates";
import { cn, pluralize } from "@/lib/utils";
import { EmptyState } from "@/components/common/empty-state";
import { Markdown } from "@/components/common/markdown";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/motion";
import { MemoryComposerCard, type PlaceLite } from "@/components/forms/memory-composer";
import { PhotoGrid, PhotoLightbox } from "@/components/photos/photo-grid";
import { MapView } from "@/components/map/map";
import { useConfirm } from "@/components/ui/confirm";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { NativeSelect } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemoryEditDialog } from "./memory-edit-dialog";

type CityLite = { id: string; name: string; trip_country_id: string; lat: number | null; lng: number | null };
type CountryLite = { id: string; name: string; flag: string };

function MemoryCard({ m, country, city, place, highlighted, onEdit }: { m: MemoryVM; country?: CountryLite; city?: CityLite; place?: PlaceLite; highlighted: boolean; onEdit: () => void }) {
  const confirm = useConfirm();
  const [, start] = useTransition();
  return (
    <article id={`memory-${m.id}`} className={cn("card scroll-mt-24 overflow-hidden transition-shadow", highlighted && "ring-2 ring-accent")}>
      {m.photos.length > 0 && (
        <div className="p-2 pb-0">
          <PhotoGrid photos={m.photos} entityType="memory" entityId={m.id} columns={m.photos.length === 1 ? "grid-cols-1 [&>div:first-child]:aspect-[4/3]" : m.photos.length === 2 ? "grid-cols-2" : "grid-cols-3"} canUpload={false} />
        </div>
      )}
      <div className="flex flex-col gap-2 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted">
              {fmtDate(m.date, "EEEE, dd MMM yyyy")}
              {m.mood ? <span className="ml-1.5 text-base">{m.mood}</span> : null}
            </p>
            {m.title && <h3 className="mt-0.5 text-[22px] font-semibold leading-tight">{m.title}</h3>}
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger className="grid size-9 shrink-0 place-items-center rounded-lg text-muted hover:bg-ink/5" aria-label="Memory actions">
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onSelect={onEdit}>
                <Pencil /> Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                destructive
                onSelect={async () => {
                  if (!(await confirm({ title: "Delete this memory?", description: m.photos.length ? `Its ${pluralize(m.photos.length, "photo")} will be deleted too.` : undefined, confirmLabel: "Delete memory" }))) return;
                  start(async () => {
                    const res = await deleteMemory(m.id);
                    if (!res.ok) toast.error(res.error);
                    else toast.success("Memory deleted");
                  });
                }}
              >
                <Trash2 /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
        {m.body && <Markdown>{m.body}</Markdown>}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {(place || city || country) && (
            <Link href={place ? `/places?open=${place.id}` : city ? `/cities/${city.id}` : `/countries/${country!.id}`} className="inline-flex h-7 items-center gap-1 rounded-full bg-accent-soft px-2.5 text-xs font-medium hover:underline">
              <MapPin className="size-3.5 text-accent" />
              {[place?.name, city?.name, country ? `${country.flag} ${country.name}` : null].filter(Boolean).join(" · ")}
            </Link>
          )}
          {m.tags.map((t) => (
            <span key={t} className="inline-flex h-7 items-center rounded-full bg-surface-2 px-2.5 text-xs font-medium text-muted ring-1 ring-border">
              #{t}
            </span>
          ))}
        </div>
        <div className="pt-1">
          <PhotoGrid photos={[]} entityType="memory" entityId={m.id} addVariant="pill" columns="hidden" />
        </div>
      </div>
    </article>
  );
}

export function MemoriesView({
  memories,
  countries,
  cities,
  places,
  focus,
  initialTab,
}: {
  memories: MemoryVM[];
  countries: CountryLite[];
  cities: CityLite[];
  places: PlaceLite[];
  focus: string | null;
  initialTab: string;
}) {
  const [tab, setTab] = useState(["timeline", "gallery", "map"].includes(initialTab) ? initialTab : "timeline");
  const [editing, setEditing] = useState<MemoryVM | null>(null);
  const [country, setCountry] = useState("all");
  const [city, setCity] = useState("all");
  const [lightbox, setLightbox] = useState<{ photos: PhotoView[]; index: number } | null>(null);

  useEffect(() => {
    if (!focus) return;
    const t = setTimeout(() => document.getElementById(`memory-${focus}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 300);
    return () => clearTimeout(t);
  }, [focus]);

  const months = useMemo(() => {
    const groups = new Map<string, MemoryVM[]>();
    for (const m of memories) {
      const k = monthKey(m.date);
      groups.set(k, [...(groups.get(k) ?? []), m]);
    }
    return Array.from(groups.entries());
  }, [memories]);

  const galleryPhotos = useMemo(
    () =>
      memories
        .filter((m) => (country === "all" || m.trip_country_id === country) && (city === "all" || m.city_id === city))
        .flatMap((m) => m.photos.map((p) => ({ ...p, caption: p.caption ?? m.title ?? null }))),
    [memories, country, city],
  );

  // Map: photo GPS first, then the linked place, then the linked city.
  const mapMarkers = useMemo(() => {
    const out: { id: string; lat: number; lng: number; label: string; image?: string | null; color?: string; glyph?: string }[] = [];
    for (const m of memories) {
      const geo = m.photos.filter((p) => p.lat != null && p.lng != null);
      if (geo.length) {
        geo.forEach((p) => out.push({ id: `${m.id}:${p.id}`, lat: p.lat!, lng: p.lng!, label: m.title ?? fmtDate(m.date), image: p.thumb_url }));
        continue;
      }
      const pl = places.find((p) => p.id === m.place_id);
      const ci = cities.find((c) => c.id === m.city_id);
      const loc = pl?.lat != null && pl?.lng != null ? { lat: pl.lat, lng: pl.lng } : ci?.lat != null && ci?.lng != null ? { lat: ci.lat, lng: ci.lng } : null;
      if (loc) out.push({ id: m.id, lat: loc.lat + (out.length % 5) * 0.0007, lng: loc.lng, label: m.title ?? fmtDate(m.date), image: m.photos[0]?.thumb_url ?? null, glyph: m.mood ?? "•" });
    }
    return out;
  }, [memories, places, cities]);

  const onTab = (v: string) => {
    setTab(v);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", v);
    window.history.replaceState(null, "", url);
  };

  return (
    <PageTransition className="flex flex-col gap-6">
      <PageHeader eyebrow="Track" title="Memories" description={memories.length ? `${pluralize(memories.length, "memory", "memories")} · ${pluralize(memories.reduce((s, m) => s + m.photos.length, 0), "photo")}` : "Notes and photos from before, during and after the trip."} />
      <MemoryComposerCard places={places} />
      {!memories.length ? (
        <EmptyState icon={Camera} title="Your journal is empty" description="Write the first memory above — a sentence, a mood, a handful of photos. Dates and GPS come from your photos." />
      ) : (
        <Tabs value={tab} onValueChange={onTab}>
          <TabsList aria-label="Memory views">
            <TabsTrigger value="timeline">
              <Rows3 /> Timeline
            </TabsTrigger>
            <TabsTrigger value="gallery">
              <Images /> Gallery
            </TabsTrigger>
            <TabsTrigger value="map">
              <MapIcon /> Map
            </TabsTrigger>
          </TabsList>
          <TabsContent value="timeline">
            <div className="flex flex-col gap-10">
              {months.map(([key, list]) => (
                <section key={key} aria-label={fmtMonth(key)}>
                  <h2 className="sticky top-16 z-10 -mx-1 mb-4 bg-bg/85 px-1 py-2 text-[26px] font-semibold backdrop-blur md:top-[72px]">
                    {fmtMonth(key)} <span className="num text-sm font-normal text-muted">{list.length}</span>
                  </h2>
                  <div className="columns-1 gap-5 md:columns-2 [&>*]:mb-5 [&>*]:break-inside-avoid">
                    {list.map((m) => (
                      <MemoryCard
                        key={m.id}
                        m={m}
                        country={countries.find((c) => c.id === m.trip_country_id)}
                        city={cities.find((c) => c.id === m.city_id)}
                        place={places.find((p) => p.id === m.place_id)}
                        highlighted={focus === m.id}
                        onEdit={() => setEditing(m)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </TabsContent>
          <TabsContent value="gallery">
            <div className="mb-4 flex flex-wrap gap-2">
              <NativeSelect value={country} onChange={(e) => { setCountry(e.target.value); setCity("all"); }} aria-label="Country" className="w-48">
                <option value="all">All countries</option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.flag} {c.name}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect value={city} onChange={(e) => setCity(e.target.value)} aria-label="City" className="w-44">
                <option value="all">All cities</option>
                {cities.filter((c) => country === "all" || c.trip_country_id === country).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {galleryPhotos.length ? (
              <div className="columns-2 gap-3 sm:columns-3 lg:columns-4 [&>*]:mb-3">
                {galleryPhotos.map((p, i) => (
                  <button key={p.id} type="button" onClick={() => setLightbox({ photos: galleryPhotos, index: i })} className="group block w-full overflow-hidden rounded-xl bg-surface-2" style={{ aspectRatio: p.width && p.height ? `${p.width}/${p.height}` : "4/3" }}>
                    {p.thumb_url && <img src={p.thumb_url} alt={p.caption ?? ""} loading="lazy" className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />}
                  </button>
                ))}
              </div>
            ) : (
              <EmptyState compact icon={Images} title="No photos here yet" description="Add photos to a memory and they appear in this gallery." />
            )}
          </TabsContent>
          <TabsContent value="map">
            <MapView
              className="h-[62vh] min-h-96 rounded-[16px] border border-border"
              markers={mapMarkers}
              onMarkerClick={(id) => {
                setTab("timeline");
                setTimeout(() => document.getElementById(`memory-${id.split(":")[0]}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
              }}
              emptyLabel="Photos with GPS, or memories linked to a place or city, appear here"
            />
            <p className="mt-2 text-xs text-muted">Pinned by photo GPS when available, otherwise by the linked place or city.</p>
          </TabsContent>
        </Tabs>
      )}
      {lightbox && <PhotoLightbox photos={lightbox.photos} index={lightbox.index} onClose={() => setLightbox(null)} />}
      {editing && <MemoryEditDialog memory={editing} onOpenChange={(o) => !o && setEditing(null)} />}
    </PageTransition>
  );
}
