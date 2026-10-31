"use client";
import dynamic from "next/dynamic";
import { MapPinned } from "lucide-react";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/utils";
import type { LeafletMapProps, MapMarker } from "./leaflet-map";

export type { MapMarker };

const LeafletMap = dynamic(() => import("./leaflet-map"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

/** Client-only Leaflet map with an empty state when nothing has coordinates. */
export function MapView({ className, emptyLabel = "Nothing on the map yet", allowEmpty, ...props }: LeafletMapProps & { emptyLabel?: string; allowEmpty?: boolean }) {
  if (!props.markers.length && !allowEmpty) {
    return (
      <div className={cn("grid place-items-center overflow-hidden bg-surface-2 text-center", className)}>
        <div className="flex flex-col items-center gap-2 p-6 text-sm text-muted">
          <MapPinned className="size-6 text-accent" />
          {emptyLabel}
        </div>
      </div>
    );
  }
  return (
    <div className={cn("relative isolate overflow-hidden bg-surface-2", className)}>
      <LeafletMap {...props} />
    </div>
  );
}
