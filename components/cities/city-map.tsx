"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, Camera, MapPin } from "lucide-react";
import type { PlaceVM } from "@/lib/data";
import { PLACE_CATEGORY_META } from "@/lib/icons";
import type { PhotoPin } from "@/lib/photo-pins";
import type { PlaceCategory } from "@/lib/types";
import { pluralize } from "@/lib/utils";
import { MapView, type MapMarker } from "@/components/map/map";
import { PhotoLightbox } from "@/components/photos/photo-grid";
import { Button } from "@/components/ui/button";
import { FilterChip } from "@/components/ui/misc";

/** One map for a city, with its places and its photos as layers that switch on and off. */
export function CityMap({ places, pins }: { places: PlaceVM[]; pins: PhotoPin[] }) {
  const [showPlaces, setShowPlaces] = useState(true);
  const [showPhotos, setShowPhotos] = useState(true);
  const [photoIndex, setPhotoIndex] = useState(-1);
  const pinPhotos = useMemo(() => pins.map((p) => p.photo), [pins]);
  const placeMarkers = useMemo<MapMarker[]>(
    () =>
      places.flatMap((p) => {
        if (p.lat == null || p.lng == null) return [];
        const meta = PLACE_CATEGORY_META[p.category as PlaceCategory] ?? PLACE_CATEGORY_META.other;
        return [
          {
            id: p.id,
            lat: p.lat,
            lng: p.lng,
            label: p.name,
            color: meta.color,
            glyph: p.status === "visited" ? "✓" : "",
            popup: (
              <div className="flex min-w-36 flex-col gap-2.5">
                <span className="break-words text-sm font-semibold">{p.name}</span>
                {/* Leaflet colours every link in the map, so the button's text colour has to insist. */}
                <Button asChild size="sm" className="!text-primary-fg">
                  <Link href={`/places?open=${p.id}`}>
                    Open place <ArrowRight />
                  </Link>
                </Button>
              </div>
            ),
          },
        ];
      }),
    [places],
  );
  const photoMarkers = useMemo<MapMarker[]>(() => pins.map((p) => ({ id: p.photo.id, lat: p.lat, lng: p.lng, label: p.label, image: p.photo.thumb_url })), [pins]);
  const markers = useMemo(() => [...(showPhotos ? photoMarkers : []), ...(showPlaces ? placeMarkers : [])], [showPhotos, photoMarkers, showPlaces, placeMarkers]);
  // Everything that could be shown, so switching a layer doesn't throw away where the map has been moved to.
  const fitKey = [...photoMarkers, ...placeMarkers].map((m) => `${m.id}:${m.lat},${m.lng}`).join("|");
  const total = placeMarkers.length + photoMarkers.length;
  const unmapped = places.length - placeMarkers.length;

  return (
    <div className="card overflow-hidden" data-testid="city-map">
      {total > 0 && (
        <div role="group" aria-label="Map layers" className="flex flex-wrap items-center gap-2 border-b border-border p-2.5">
          <FilterChip active={showPlaces && placeMarkers.length > 0} disabled={!placeMarkers.length} onClick={() => setShowPlaces((v) => !v)} className="disabled:opacity-50">
            <MapPin /> Places <span className="num text-xs opacity-60">{placeMarkers.length}</span>
          </FilterChip>
          <FilterChip active={showPhotos && photoMarkers.length > 0} disabled={!photoMarkers.length} onClick={() => setShowPhotos((v) => !v)} className="disabled:opacity-50">
            <Camera /> Photos <span className="num text-xs opacity-60">{photoMarkers.length}</span>
          </FilterChip>
          {unmapped > 0 && <span className="px-1 text-xs text-muted">{pluralize(unmapped, "place")} without coordinates</span>}
        </div>
      )}
      <MapView
        className="h-[420px] lg:h-[clamp(22rem,calc(100vh-14rem),36rem)]"
        markers={markers}
        allowEmpty={total > 0}
        fitKey={fitKey}
        onMarkerClick={(id) => {
          const i = pinPhotos.findIndex((p) => p.id === id);
          if (i >= 0) setPhotoIndex(i);
        }}
        emptyLabel="These places have no coordinates yet"
      />
      {pinPhotos.length > 0 && <PhotoLightbox photos={pinPhotos} index={photoIndex} onClose={() => setPhotoIndex(-1)} />}
    </div>
  );
}
