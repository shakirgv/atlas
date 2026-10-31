"use client";
import "leaflet/dist/leaflet.css";
import { useEffect, useMemo } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents } from "react-leaflet";
import { useTheme } from "next-themes";

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
};

const ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>';

function escapeHtml(s: string) {
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
    html: `<div style="width:${size}px;height:${size}px;border-radius:999px;background:${color};color:white;display:grid;place-items:center;font:600 12px/1 var(--font-sans);border:2px solid white;box-shadow:0 3px 10px rgb(0 0 0/.28);font-variant-numeric:tabular-nums">${escapeHtml(inner)}</div>`,
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

function ClickHandler({ onMapClick }: { onMapClick?: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick?.(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/** Leaflet map with CARTO basemap (light_all / dark_all). Load via next/dynamic with ssr:false. */
export default function LeafletMap({ markers, polyline, onMarkerClick, onMapClick, center, zoom = 12, className, fitKey }: LeafletMapProps) {
  const { resolvedTheme } = useTheme();
  const style = resolvedTheme === "dark" ? "dark_all" : "light_all";
  const initial = useMemo<[number, number]>(
    () => center ?? (markers[0] ? [markers[0].lat, markers[0].lng] : [20, 10]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  return (
    <MapContainer center={initial} zoom={markers.length || center ? zoom : 2} scrollWheelZoom className={className} style={{ height: "100%", width: "100%" }} attributionControl>
      <TileLayer key={style} url={`https://{s}.basemaps.cartocdn.com/${style}/{z}/{x}/{y}{r}.png`} attribution={ATTRIBUTION} subdomains="abcd" maxZoom={19} />
      {polyline && markers.length > 1 && (
        <Polyline positions={markers.map((m) => [m.lat, m.lng] as [number, number])} pathOptions={{ color: "#E8532F", weight: 3, opacity: 0.85, dashArray: "6 8" }} />
      )}
      {markers.map((m) => (
        <Marker key={m.id} position={[m.lat, m.lng]} icon={iconFor(m)} eventHandlers={{ click: () => onMarkerClick?.(m.id) }} keyboard>
          <Tooltip direction="top" offset={[0, -14]}>
            {m.label}
          </Tooltip>
        </Marker>
      ))}
      <FitBounds markers={markers} fitKey={fitKey} />
      <ClickHandler onMapClick={onMapClick} />
    </MapContainer>
  );
}
