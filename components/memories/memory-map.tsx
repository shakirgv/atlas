"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import type { Map as LeafletMapInstance } from "leaflet";
import { Crosshair, ImageOff, MapPinned } from "lucide-react";
import { toast } from "sonner";
import { setPhotoLocation } from "@/actions/photos";
import type { MemoryVM } from "@/lib/data";
import { fmtDate } from "@/lib/dates";
import { memoryLocation } from "@/lib/memory-filters";
import type { LinkPlace } from "@/lib/memory-links";
import { cn, pluralize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import type { PhotoMarker } from "@/components/photos/photo-map-inner";

const PhotoMapInner = dynamic(() => import("@/components/photos/photo-map-inner"), { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> });

type GeoCity = { id: string; lat: number | null; lng: number | null };
type Placed = Record<string, { lat: number; lng: number }>;

/**
 * One marker per memory: its main photo, or a journal icon when it has none.
 * A cluster zooms in; a single marker opens the memory.
 */
export function MemoryMap({ memories, places, cities, onOpen }: { memories: MemoryVM[]; places: LinkPlace[]; cities: GeoCity[]; onOpen: (id: string) => void }) {
  const [placing, setPlacing] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  // Placed photos move to the map straight away; a failed save moves them back.
  const [placed, setPlaced] = useState<Placed>({});
  const [, start] = useTransition();
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { located, unlocated } = useMemo(() => {
    const located: { m: MemoryVM; lat: number; lng: number }[] = [];
    const unlocated: MemoryVM[] = [];
    for (const m of memories) {
      const photos = m.photos.map((p) => (placed[p.id] ? { ...p, ...placed[p.id] } : p));
      const at = memoryLocation({ ...m, photos }, places, cities);
      if (at) located.push({ m, ...at });
      else unlocated.push(m);
    }
    return { located, unlocated };
  }, [memories, places, cities, placed]);

  const markers = useMemo<PhotoMarker[]>(
    () =>
      located.map(({ m, lat, lng }) => ({
        id: m.id,
        lat,
        lng,
        label: [m.title ?? (m.body ?? "").slice(0, 40), fmtDate(m.date)].filter(Boolean).join(" · "),
        thumb: m.photos[0]?.thumb_url ?? null,
        journal: !m.photos.length,
      })),
    [located],
  );
  // Refit when the filters change the set of memories, not when a photo gets placed.
  const fitKey = useMemo(() => memories.map((m) => m.id).join(","), [memories]);
  const photoCount = located.reduce((n, x) => n + x.m.photos.length, 0);
  const tray = unlocated.flatMap((m) => m.photos.map((p) => ({ photo: p, memory: m })));
  const textOnlyUnlocated = unlocated.filter((m) => !m.photos.length).length;

  const place = (id: string, lat: number, lng: number) => {
    setPlacing(null);
    setPlaced((s) => ({ ...s, [id]: { lat, lng } }));
    start(async () => {
      const res = await setPhotoLocation(id, lat, lng);
      if (res.ok) return;
      toast.error(res.error);
      setPlaced((s) => {
        const next = { ...s };
        delete next[id];
        return next;
      });
    });
  };

  if (!memories.length) {
    return (
      <div className="grid h-[50vh] min-h-72 place-items-center rounded-[16px] border border-border bg-surface-2 text-center">
        <div className="flex flex-col items-center gap-2 p-6 text-sm text-muted">
          <MapPinned className="size-6 text-accent" />
          No memories match these filters.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="num text-sm text-muted" data-testid="memory-map-count">
        <b className="font-semibold text-ink">{pluralize(located.length, "memory", "memories")}</b> on the map · {pluralize(photoCount, "photo")}
        {unlocated.length > 0 && <> · {unlocated.length} without a location</>}
      </p>
      <div
        ref={wrapRef}
        data-testid="memory-map"
        className={cn("relative isolate h-[62vh] min-h-96 overflow-hidden rounded-[16px] border border-border bg-surface-2", over && "ring-2 ring-accent", placing && "[&_.leaflet-container]:!cursor-crosshair")}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const id = e.dataTransfer.getData("text/atlas-photo");
          const map = mapRef.current;
          const box = wrapRef.current?.getBoundingClientRect();
          if (!id || !map || !box) return;
          const at = map.containerPointToLatLng([e.clientX - box.left, e.clientY - box.top]);
          place(id, at.lat, at.lng);
        }}
      >
        <PhotoMapInner
          markers={markers}
          clusterClick="zoom"
          onSelect={(ids) => {
            if (!placing && ids[0]) onOpen(ids[0]);
          }}
          fitKey={fitKey}
          onReady={(m) => {
            mapRef.current = m;
          }}
          onMapClick={(lat, lng) => {
            if (placing) place(placing, lat, lng);
          }}
        />
        {placing && (
          <div className="absolute inset-x-3 top-3 z-[500] flex flex-wrap items-center justify-between gap-2 rounded-xl bg-ink px-3 py-2 text-sm text-bg shadow-lg">
            <span>Click the map where this photo was taken.</span>
            <span className="flex gap-1.5">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  const c = mapRef.current?.getCenter();
                  if (c) place(placing, c.lat, c.lng);
                }}
              >
                <Crosshair /> Map center
              </Button>
              <Button size="sm" variant="secondary" onClick={() => setPlacing(null)}>
                Cancel
              </Button>
            </span>
          </div>
        )}
      </div>
      <p className="text-xs text-muted">Placed by photo GPS when there is one, otherwise by the linked place or city.</p>

      {tray.length > 0 && (
        <section className="card p-4" aria-label="Photos without location">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <ImageOff className="size-4 text-accent" /> Photos without location
            <span className="num text-xs font-normal text-muted">{tray.length}</span>
          </h3>
          <p className="mb-3 mt-0.5 text-xs text-muted">Drag one onto the map, or tap it and then tap the map. Its memory moves there too.</p>
          <ul className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
            {tray.map(({ photo, memory }) => (
              <li key={photo.id} className="shrink-0">
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/atlas-photo", photo.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => setPlacing((c) => (c === photo.id ? null : photo.id))}
                  aria-pressed={placing === photo.id}
                  aria-label={`Place a photo from ${memory.title ?? fmtDate(memory.date)} on the map`}
                  className={cn("block size-16 cursor-grab overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border active:cursor-grabbing", placing === photo.id && "ring-2 ring-accent")}
                >
                  {photo.thumb_url && <img src={photo.thumb_url} alt="" draggable={false} className="size-full object-cover" loading="lazy" />}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {textOnlyUnlocated > 0 && <p className="text-xs text-muted">{pluralize(textOnlyUnlocated, "text-only memory", "text-only memories")} without a place or city. Edit one to link it and it appears here.</p>}
    </div>
  );
}
