"use client";
import "leaflet/dist/leaflet.css";
import "react-leaflet-cluster/dist/assets/MarkerCluster.css";
import { useEffect, useMemo, useRef, type ReactNode } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, Popup, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { MAP_TILE_ATTRIBUTION, MAP_TILE_URL } from "@/lib/config";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color?: string;
  /** Number shown inside the marker (day map). */
  number?: number;
  /** Emoji or short glyph shown inside the marker. */
  glyph?: string;
  /** Optional photo thumbnail marker (memories map). */
  image?: string | null;
  active?: boolean;
  /** Opens above the marker when it is clicked. */
  popup?: ReactNode;
};

export type LeafletMapProps = {
  markers: MapMarker[];
  polyline?: boolean;
  onMarkerClick?: (id: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  center?: [number, number];
  zoom?: number;
  className?: string;
  fitKey?: string;
  /** Pans to this marker and opens its label. A new `nonce` does it again for the same marker. */
  focus?: { id: string; nonce: number } | null;
  /** Nearby markers merge into one with a count. Clicking it zooms in until they split. */
  cluster?: boolean;
};

export function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function iconFor(m: MapMarker) {
  const color = m.color ?? "var(--accent)";
  if (m.image) {
    return L.divIcon({
      className: "atlas-marker",
      iconSize: [44, 44],
      iconAnchor: [22, 22],
      html: `<div style="width:44px;height:44px;border-radius:12px;overflow:hidden;border:2px solid white;box-shadow:0 4px 12px rgb(0 0 0/.3);background:${color}"><img src="${escapeHtml(m.image)}" alt="" style="width:100%;height:100%;object-fit:cover"/></div>`,
    });
  }
  const inner = m.number !== undefined ? String(m.number) : (m.glyph ?? "");
  const size = m.active ? 34 : 28;
  return L.divIcon({
    className: "atlas-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};color:white;display:grid;place-items:center;font:600 12px/1 var(--font-sans);border:2px solid white;box-shadow:${m.active ? "0 0 0 3px var(--accent),0 4px 14px rgb(0 0 0/.35)" : "0 3px 10px rgb(0 0 0/.28)"};font-variant-numeric:tabular-nums">${escapeHtml(inner)}</div>`,
  });
}

function clusterIcon(cluster: { getChildCount: () => number }) {
  const n = cluster.getChildCount();
  const size = n >= 100 ? 48 : n >= 10 ? 42 : 36;
  return L.divIcon({
    className: "atlas-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `<div data-testid="map-cluster" aria-label="${n} places" style="width:${size}px;height:${size}px;border-radius:999px;display:grid;place-items:center;background:var(--ink);color:var(--bg);font:700 13px/1 var(--font-sans);border:3px solid white;box-shadow:0 4px 14px rgb(0 0 0/.32);font-variant-numeric:tabular-nums">${n}</div>`,
  });
}

function FitBounds({ markers, fitKey }: { markers: MapMarker[]; fitKey?: string }) {
  const map = useMap();
  const key = fitKey ?? markers.map((m) => `${m.id}:${m.lat.toFixed(4)},${m.lng.toFixed(4)}`).join("|");
  useEffect(() => {
    if (!markers.length) return;
    if (markers.length === 1) {
      map.setView([markers[0]!.lat, markers[0]!.lng], Math.max(map.getZoom(), 13), { animate: true });
      return;
    }
    const b = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
    map.fitBounds(b, { padding: [36, 36], maxZoom: 15, animate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, map]);
  return null;
}

function FocusMarker({ markers, focus, refs }: { markers: MapMarker[]; focus?: { id: string; nonce: number } | null; refs: React.RefObject<Map<string, L.Marker>> }) {
  const map = useMap();
  useEffect(() => {
    const m = focus && markers.find((x) => x.id === focus.id);
    if (!m) return;
    map.setView([m.lat, m.lng], Math.max(map.getZoom(), 15), { animate: true });
    refs.current.get(m.id)?.openTooltip();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focus?.id, focus?.nonce, map]);
  return null;
}

function ClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Leaflet map on OpenStreetMap tiles, restyled for light/dark via CSS. Load via next/dynamic with ssr:false. */
export default function LeafletMap({ markers, polyline, onMarkerClick, onMapClick, center, zoom = 12, className, fitKey, focus, cluster }: LeafletMapProps) {
  const refs = useRef(new Map<string, L.Marker>());
  const initial = useMemo<[number, number]>(
    () => center ?? (markers[0] ? [markers[0].lat, markers[0].lng] : [20, 10]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const pins = markers.map((m) => (
    // A photo pin can share its spot with a place, so the smaller marker stays on top and both can be clicked.
    <Marker
      key={m.id}
      ref={(el) => {
        if (el) refs.current.set(m.id, el);
        else refs.current.delete(m.id);
      }}
      position={[m.lat, m.lng]}
      icon={iconFor(m)}
      zIndexOffset={m.image ? 0 : m.active ? 2000 : 1000} eventHandlers={{ click: () => onMarkerClick?.(m.id), popupopen: (e) => e.target.closeTooltip() }} keyboard>
      <Tooltip direction="top" offset={[0, -14]}>
        {m.label}
      </Tooltip>
      {m.popup && <Popup offset={[0, -8]}>{m.popup}</Popup>}
    </Marker>
  ));
  return (
    <MapContainer center={initial} zoom={markers.length || center ? zoom : 2} scrollWheelZoom className={className} style={{ height: "100%", width: "100%" }} attributionControl>
      <TileLayer url={MAP_TILE_URL} attribution={MAP_TILE_ATTRIBUTION} maxZoom={19} className="atlas-tiles" />
      {polyline && markers.length > 1 && (
        <Polyline positions={markers.map((m) => [m.lat, m.lng] as [number, number])} pathOptions={{ color: "#E8532F", weight: 3, opacity: 0.85, dashArray: "6 8" }} />
      )}
      {cluster ? (
        // Spiderfying fans out pins that share one spot, so each can still be clicked at the closest zoom.
        <MarkerClusterGroup chunkedLoading maxClusterRadius={48} showCoverageOnHover={false} spiderfyOnMaxZoom iconCreateFunction={clusterIcon}>
          {pins}
        </MarkerClusterGroup>
      ) : (
        pins
      )}
      <FitBounds markers={markers} fitKey={fitKey} />
      {/* After FitBounds, so a marker focused as its day opens isn't zoomed back out. */}
      <FocusMarker markers={markers} focus={focus} refs={refs} />
      <ClickHandler onMapClick={onMapClick} />
    </MapContainer>
  );
}
