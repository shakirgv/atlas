"use client";
import { useMemo, useRef, useState, useTransition } from "react";
import dynamic from "next/dynamic";
import type { Map as LeafletMapInstance } from "leaflet";
import { Crosshair, ImageOff, MapPinned, X, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { setPhotoLocation } from "@/actions/photos";
import { filterPins, pinYears, type PhotoPin, type UnlocatedPhoto } from "@/lib/photo-pins";
import type { ActionResult } from "@/lib/types";
import { cn, pluralize } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { PhotoLightbox } from "./photo-grid";
import type { PhotoMarker } from "./photo-map-inner";

// Leaflet and the cluster plugin load only when a map is actually shown.
const PhotoMapInner = dynamic(() => import("./photo-map-inner"), { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> });

export type MemoryPin = { id: string; lat: number; lng: number; label: string; glyph: string };

export function PhotoMap({
  pins,
  unlocated,
  memoryPins = [],
  trips,
  countries,
  onMemory,
  saveLocation = setPhotoLocation,
}: {
  pins: PhotoPin[];
  unlocated: UnlocatedPhoto[];
  /** Memories with no photos at all, still shown where they happened. */
  memoryPins?: MemoryPin[];
  trips: { id: string; title: string }[];
  countries: { id: string; name: string; flag: string }[];
  onMemory?: (id: string) => void;
  saveLocation?: (id: string, lat: number, lng: number) => Promise<ActionResult>;
}) {
  const [trip, setTrip] = useState("");
  const [country, setCountry] = useState("");
  const [year, setYear] = useState("");
  const [strip, setStrip] = useState<string[] | null>(null);
  const [lightbox, setLightbox] = useState(-1);
  const [placing, setPlacing] = useState<string | null>(null);
  const [over, setOver] = useState(false);
  // Placed photos move to the map straight away; a failed save moves them back.
  const [placed, setPlaced] = useState<Record<string, { lat: number; lng: number }>>({});
  const [, start] = useTransition();
  const mapRef = useRef<LeafletMapInstance | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const allPins = useMemo<PhotoPin[]>(() => {
    const moved = unlocated.flatMap((u) => (placed[u.photo.id] ? [{ ...u, ...placed[u.photo.id]!, source: "gps" as const }] : []));
    return [...pins, ...moved];
  }, [pins, unlocated, placed]);
  const f = { trip: trip || undefined, country: country || undefined, year: year || undefined };
  const visible = useMemo(() => filterPins(allPins, f), [allPins, trip, country, year]); // eslint-disable-line react-hooks/exhaustive-deps
  const tray = useMemo(() => filterPins(unlocated.filter((u) => !placed[u.photo.id]), f), [unlocated, placed, trip, country, year]); // eslint-disable-line react-hooks/exhaustive-deps
  const years = useMemo(() => pinYears([...allPins, ...unlocated]), [allPins, unlocated]);
  const showMemories = !trip && !country && !year;

  const markers = useMemo<PhotoMarker[]>(
    () => [
      ...visible.map((p) => ({ id: p.photo.id, lat: p.lat, lng: p.lng, label: p.label, thumb: p.photo.thumb_url })),
      ...(showMemories ? memoryPins.map((m) => ({ id: `memory:${m.id}`, lat: m.lat, lng: m.lng, label: m.label, glyph: m.glyph })) : []),
    ],
    [visible, memoryPins, showMemories],
  );
  const stripPhotos = useMemo(() => (strip ? visible.filter((p) => strip.includes(p.photo.id)).map((p) => p.photo) : []), [strip, visible]);

  const select = (ids: string[]) => {
    if (placing) return;
    const memory = ids.length === 1 && ids[0]!.startsWith("memory:") ? ids[0]!.slice(7) : null;
    if (memory) return onMemory?.(memory);
    setStrip(ids.filter((id) => !id.startsWith("memory:")));
  };

  const place = (id: string, lat: number, lng: number) => {
    setPlacing(null);
    setPlaced((s) => ({ ...s, [id]: { lat, lng } }));
    start(async () => {
      const res = await saveLocation(id, lat, lng);
      if (res.ok) return;
      toast.error(res.error);
      setPlaced((s) => {
        const next = { ...s };
        delete next[id];
        return next;
      });
    });
  };

  const zoomToStrip = () => {
    const map = mapRef.current;
    const list = visible.filter((p) => strip?.includes(p.photo.id));
    if (!map || !list.length) return;
    map.fitBounds(list.map((p) => [p.lat, p.lng] as [number, number]), { padding: [64, 64], maxZoom: 18 });
    setStrip(null);
  };

  const hasAny = allPins.length > 0 || unlocated.length > 0 || memoryPins.length > 0;
  if (!hasAny) {
    return (
      <div className="grid h-[50vh] min-h-72 place-items-center rounded-[16px] border border-border bg-surface-2 text-center">
        <div className="flex flex-col items-center gap-2 p-6 text-sm text-muted">
          <MapPinned className="size-6 text-accent" />
          Photos with GPS, or linked to a place or city, appear here.
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter photos">
        {trips.length > 1 && (
          <NativeSelect value={trip} onChange={(e) => setTrip(e.target.value)} aria-label="Trip" className="w-44">
            <option value="">All trips</option>
            {trips.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </NativeSelect>
        )}
        <NativeSelect value={country} onChange={(e) => setCountry(e.target.value)} aria-label="Country" className="w-44">
          <option value="">All countries</option>
          {countries.map((c) => (
            <option key={c.id} value={c.id}>
              {c.flag} {c.name}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect value={year} onChange={(e) => setYear(e.target.value)} aria-label="Year" className="w-32">
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </NativeSelect>
        <span className="num self-center text-xs text-muted">{pluralize(visible.length, "photo")} on the map</span>
      </div>

      <div
        ref={wrapRef}
        data-testid="photo-map"
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
          onSelect={select}
          fitKey={`${trip}|${country}|${year}|${pins.length}`}
          onReady={(m) => {
            mapRef.current = m;
          }}
          onMapClick={(lat, lng) => {
            if (placing) place(placing, lat, lng);
            else setStrip(null);
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
        {stripPhotos.length > 0 && (
          <div data-testid="photo-strip" className="absolute inset-x-3 bottom-3 z-[500] rounded-2xl border border-border bg-surface/95 p-2.5 shadow-xl backdrop-blur">
            <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
              <span className="text-sm font-medium">{pluralize(stripPhotos.length, "photo")}</span>
              <span className="flex gap-1">
                {stripPhotos.length > 1 && (
                  <Button size="sm" variant="ghost" onClick={zoomToStrip}>
                    <ZoomIn /> Zoom in
                  </Button>
                )}
                <button type="button" onClick={() => setStrip(null)} className="grid size-9 place-items-center rounded-lg text-muted hover:bg-ink/5" aria-label="Close photos">
                  <X className="size-4" />
                </button>
              </span>
            </div>
            <ul className="scrollbar-none flex gap-2 overflow-x-auto">
              {stripPhotos.map((p, i) => (
                <li key={p.id} className="shrink-0">
                  <button type="button" onClick={() => setLightbox(i)} className="block size-20 overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border" aria-label={`Open photo ${i + 1}`}>
                    {p.thumb_url && <img src={p.thumb_url} alt={p.caption ?? ""} className="size-full object-cover" loading="lazy" />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {tray.length > 0 && (
        <section className="card p-4" aria-label="Photos without location">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <ImageOff className="size-4 text-accent" /> Photos without location
            <span className="num text-xs font-normal text-muted">{tray.length}</span>
          </h3>
          <p className="mb-3 mt-0.5 text-xs text-muted">Drag one onto the map, or tap it and then tap the map.</p>
          <ul className="scrollbar-none flex gap-2 overflow-x-auto pb-1">
            {tray.map((u) => (
              <li key={u.photo.id} className="shrink-0">
                <button
                  type="button"
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/atlas-photo", u.photo.id);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  onClick={() => setPlacing((c) => (c === u.photo.id ? null : u.photo.id))}
                  aria-pressed={placing === u.photo.id}
                  aria-label={`Place ${u.label || "photo"} on the map`}
                  className={cn("block size-16 cursor-grab overflow-hidden rounded-xl bg-surface-2 ring-1 ring-border active:cursor-grabbing", placing === u.photo.id && "ring-2 ring-accent")}
                >
                  {u.photo.thumb_url && <img src={u.photo.thumb_url} alt="" draggable={false} className="size-full object-cover" loading="lazy" />}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
      {stripPhotos.length > 0 && <PhotoLightbox photos={stripPhotos} index={lightbox} onClose={() => setLightbox(-1)} />}
    </div>
  );
}
