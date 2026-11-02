import { Bike, Bus, CarFront, Footprints, type LucideIcon, Plane, Route, Ship, TrainFront } from "lucide-react";
import { TRANSPORT_MODES, type TransportMode } from "@/lib/types";

export type ArcStyle = { dash: string | null; width: number; greatCircle: boolean };

export const TRANSPORT_META: Record<TransportMode, { label: string; icon: LucideIcon; arc: ArcStyle }> = {
  flight: { label: "Flight", icon: Plane, arc: { dash: "6 6", width: 2, greatCircle: true } },
  train: { label: "Train", icon: TrainFront, arc: { dash: null, width: 2.2, greatCircle: false } },
  bus: { label: "Bus", icon: Bus, arc: { dash: null, width: 2.2, greatCircle: false } },
  ferry: { label: "Ferry", icon: Ship, arc: { dash: "0.5 5", width: 2.6, greatCircle: false } },
  car: { label: "Car", icon: CarFront, arc: { dash: null, width: 2.2, greatCircle: false } },
  bike: { label: "Bike", icon: Bike, arc: { dash: null, width: 1.2, greatCircle: false } },
  walk: { label: "Walk", icon: Footprints, arc: { dash: null, width: 1.2, greatCircle: false } },
  other: { label: "Other", icon: Route, arc: { dash: null, width: 2, greatCircle: false } },
};

/** Unset mode: neutral dashed line with a generic route icon. */
export const UNSET_TRANSPORT = { label: "How do you get here?", icon: Route, arc: { dash: "3 5", width: 1.5, greatCircle: false } as ArcStyle };

export function transportMeta(mode: string | null | undefined) {
  return mode && (TRANSPORT_MODES as readonly string[]).includes(mode) ? TRANSPORT_META[mode as TransportMode] : UNSET_TRANSPORT;
}

export function isTransportMode(v: unknown): v is TransportMode {
  return typeof v === "string" && (TRANSPORT_MODES as readonly string[]).includes(v);
}

export const TRANSPORT_OPTIONS = TRANSPORT_MODES.map((m) => ({ value: m, label: TRANSPORT_META[m].label, icon: TRANSPORT_META[m].icon }));
