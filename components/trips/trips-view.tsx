"use client";
import { Plane, Plus } from "lucide-react";
import { TripCard } from "@/components/cards/cards";
import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition, Stagger, StaggerItem } from "@/components/common/motion";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/components/shell/workspace";
import type { Trip, TripStatus } from "@/lib/types";

type Card = { trip: Trip; coverUrl: string | null; flags: string[]; countryCount: number; progress: number };

const ORDER: TripStatus[] = ["ongoing", "planning", "dreaming", "completed"];

export function TripsView({ cards, activeTripId }: { cards: Card[]; activeTripId: string | null }) {
  const ws = useWorkspace();
  const sorted = [...cards].sort(
    (a, b) =>
      ORDER.indexOf(a.trip.status as TripStatus) - ORDER.indexOf(b.trip.status as TripStatus) ||
      (a.trip.start_date ?? "9999").localeCompare(b.trip.start_date ?? "9999"),
  );
  return (
    <PageTransition>
      <PageHeader
        eyebrow="Plan"
        title="Trips"
        description="Every journey, from daydream to done."
        actions={
          <Button onClick={() => ws.openQuickAdd("trip")}>
            <Plus /> New trip
          </Button>
        }
      />
      {!cards.length ? (
        <EmptyState
          icon={Plane}
          title="Your first adventure starts here"
          description="Create a trip like “World Tour 2027”, then add countries in bulk."
          action={
            <Button onClick={() => ws.openQuickAdd("trip")}>
              <Plus /> Create your first trip
            </Button>
          }
        />
      ) : (
        <Stagger className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((c) => (
            <StaggerItem key={c.trip.id} className={c.trip.id === activeTripId ? "relative" : undefined}>
              <TripCard {...c} />
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </PageTransition>
  );
}
