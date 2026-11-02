"use client";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import { useEffect } from "react";
import L from "leaflet";
import { MapContainer, Marker, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from "@/lib/config";
import { escapeHtml } from "@/components/map/leaflet-map";

export type PhotoMarker = { id: string; lat: number; lng: number; label: string; thumb?: string | null; glyph?: string };

export type PhotoMapInnerProps = {
  markers: PhotoMarker[];
  /** Tapping a single marker, or a cluster with all its marker ids. */
  onSelect: (ids: string[]) => void;
  onMapClick?: (lat: number, lng: number) => void;
  onReady?: (map: L.Map) => void;
  fitKey: string;
};

/** Each marker remembers its id, so a cluster can report what it holds. */
type IdMarker = L.Marker & { options: L.MarkerOptions & { photoId?: string } };

function iconFor(m: PhotoMarker) {
  const size = 44;
  const inner = m.thumb
    ? `<img src="${escapeHtml(m.thumb)}" alt="" style="width:100%;height:100%;object-fit:cover"/>`
    : `<span style="display:grid;place-items:center;width:100%;height:100%;color:white;font:600 14px/1 var(--font-sans)">${escapeHtml(m.glyph ?? "•")}</span>`;
  return L.divIcon({
    className: "atlas-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div data-testid="photo-marker" style="width:${size}px;height:${size}px;border-radius:999px;overflow:hidden;border:2px solid white;box-shadow:0 4px 12px rgb(0 0 0/.3);background:var(--accent)">${inner}</div>`,
  });
}

function clusterIcon(cluster: { getChildCount: () => number }) {
  const size = 46;
  return L.divIcon({
    className: "atlas-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div data-testid="photo-cluster" style="width:${size}px;height:${size}px;border-radius:999px;display:grid;place-items:center;background:var(--accent);color:white;font:700 14px/1 var(--font-sans);border:3px solid white;box-shadow:0 4px 14px rgb(0 0 0/.32);font-variant-numeric:tabular-nums">${cluster.getChildCount()}</div>`,
  });
}

function MapBridge({ markers, fitKey, onMapClick, onReady }: Pick<PhotoMapInnerProps, "markers" | "fitKey" | "onMapClick" | "onReady">) {
  const map = useMap();
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  useEffect(() => {
    onReady?.(map);
  }, [map, onReady]);
  useEffect(() => {
    if (!markers.length) return;
    if (markers.length === 1) map.setView([markers[0]!.lat, markers[0]!.lng], 12);
    else map.fitBounds(L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number])), { padding: [48, 48], maxZoom: 12 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey, map]);
  return null;
}

/** Leaflet with marker clusters. Load through next/dynamic with ssr:false. */
export default function PhotoMapInner({ markers, onSelect, onMapClick, onReady, fitKey }: PhotoMapInnerProps) {
  return (
    <MapContainer center={[20, 10]} zoom={2} scrollWheelZoom style={{ height: "100%", width: "100%" }} attributionControl>
      <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} maxZoom={19} className="atlas-tiles" />
      <MarkerClusterGroup
        chunkedLoading
        maxClusterRadius={56}
        // A click shows the cluster's photos instead of zooming; the strip has a button to zoom in.
        zoomToBoundsOnClick={false}
        showCoverageOnHover={false}
        spiderfyOnMaxZoom={false}
        iconCreateFunction={clusterIcon}
        eventHandlers={{
          clusterclick: (e: L.LeafletEvent) => {
            const cluster = (e as unknown as { layer: { getAllChildMarkers: () => IdMarker[] } }).layer;
            onSelect(cluster.getAllChildMarkers().flatMap((m) => (m.options.photoId ? [m.options.photoId] : [])));
          },
        }}
      >
        {markers.map((m) => (
          <Marker key={m.id} position={[m.lat, m.lng]} icon={iconFor(m)} {...({ photoId: m.id } as object)} eventHandlers={{ click: () => onSelect([m.id]) }} keyboard>
            {m.label && (
              <Tooltip direction="top" offset={[0, -18]}>
                {m.label}
              </Tooltip>
            )}
          </Marker>
        ))}
      </MarkerClusterGroup>
      <MapBridge markers={markers} fitKey={fitKey} onMapClick={onMapClick} onReady={onReady} />
    </MapContainer>
  );
}
