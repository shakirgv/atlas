"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, CalendarDays, Camera, Crosshair, Flag, MapPin, MoreHorizontal, Pencil, Plus, Trash2, Wallet, Share2 } from "lucide-react";
import { toast } from "sonner";
import { deleteTrip } from "@/actions/trips";
import { setActiveTrip } from "@/actions/workspace";
import { fmtRange, fmtDate, daysBetween } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { CountryVM, MemoryVM } from "@/lib/data";
import type { Step } from "@/lib/trip";
import type { Trip, TripStatus } from "@/lib/types";
import { pluralize } from "@/lib/utils";
import { CountryCard } from "@/components/cards/cards";
import { CoverActions } from "@/components/cover/cover-actions";
import { EmptyState } from "@/components/common/empty-state";
import { Hero, HeroButton } from "@/components/common/hero";
import { PageTransition } from "@/components/common/motion";
import { SectionTitle } from "@/components/common/page-header";
import { StatTile } from "@/components/common/stat-tile";
import { TripStatusChip } from "@/components/common/status-chip";
import { TripDialog } from "@/components/forms/trip-dialog";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/misc";
import { useWorkspace } from "@/components/shell/workspace";
import { NextSteps } from "./next-steps";
import { RouteList } from "./route-list";
import { ShareDialog } from "@/components/share/share-dialog";
import { RouteTimeline } from "./route-timeline";
import type { LegView } from "@/lib/server/route-data";
import type { ClimateStop } from "@/lib/climate";

type Stats = { cities: number; days: number; places: number; placesVisited: number; spent: number; planned: number; budget: number };

export function TripDetail({
  legs,
  climateStops,
  trip,
  attribution,
  countries,
  cityCounts,
  dayCounts,
  steps,
  progress,
  stats,
  memories,
  baseCurrency,
  isActive,
}: {
  legs: Record<string, LegView | null>;
  climateStops: Record<string, ClimateStop[]>;
  trip: Trip & { cover_url: string | null };
  attribution: string | null;
  countries: CountryVM[];
  cityCounts: Record<string, number>;
  dayCounts: Record<string, number>;
  steps: Step[];
  progress: number;
  stats: Stats;
  memories: MemoryVM[];
  baseCurrency: string;
  isActive: boolean;
}) {
  const ws = useWorkspace();
  const router = useRouter();
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [, start] = useTransition();
  const money = (n: number) => formatMoney(n, baseCurrency);
  const totalDays = daysBetween(trip.start_date, trip.end_date);
  const budgetPct = stats.budget ? (stats.spent / stats.budget) * 100 : 0;

  const onDelete = async () => {
    const okd = await confirm({
      title: `Delete “${trip.title}”?`,
      description: "All countries, cities, places, days, expenses and memories in this trip will be deleted, including their photos.",
      confirmLabel: "Delete trip",
    });
    if (!okd) return;
    start(async () => {
      const res = await deleteTrip(trip.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Trip deleted");
      router.push("/trips");
    });
  };

  return (
    <PageTransition className="flex flex-col gap-6">
      <Hero
        coverUrl={trip.cover_url}
        seed={trip.id}
        alt={trip.title}
        icon={Flag}
        topLeft={<TripStatusChip status={trip.status as TripStatus} onPhoto />}
        actions={
          <>
            <CoverActions kind="trip" id={trip.id} attribution={attribution} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <HeroButton aria-label="Trip actions" className="w-9 justify-center px-0">
                  <MoreHorizontal />
                </HeroButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil /> Edit trip
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setSharing(true)}>
                  <Share2 /> Share trip story
                </DropdownMenuItem>
                {!isActive && (
                  <DropdownMenuItem onSelect={() => start(async () => void (await setActiveTrip(trip.id)))}>
                    <Crosshair /> Focus this trip everywhere
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={onDelete}>
                  <Trash2 /> Delete trip
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        <p className="text-sm font-medium text-white/80">{fmtRange(trip.start_date, trip.end_date)}{totalDays ? ` · ${totalDays} days` : ""}</p>
        <h1 className="mt-1 text-[36px] font-semibold leading-[1.02] sm:text-[52px]">{trip.title}</h1>
        {trip.description ? <p className="mt-2 line-clamp-2 max-w-2xl text-[15px] text-white/85">{trip.description}</p> : null}
        <div className="mt-4 flex max-w-sm items-center gap-3">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
            <div className="h-full rounded-full bg-white transition-[width] duration-700" style={{ width: `${Math.round(progress * 100)}%` }} />
          </div>
          <span className="num text-xs font-medium text-white/90">{Math.round(progress * 100)}%</span>
        </div>
      </Hero>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatTile icon={Flag} label="Countries" value={countries.length} />
        <StatTile icon={Building2} label="Cities" value={stats.cities} tone="var(--visited)" />
        <StatTile icon={CalendarDays} label="Days planned" value={stats.days} tone="var(--planned)" />
        <StatTile icon={MapPin} label="Places" value={stats.places} suffix={stats.places ? `${stats.placesVisited} visited` : undefined} tone="var(--wishlist)" />
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">
          <section className="card p-5" aria-labelledby="route-title">
            <SectionTitle
              action={
                <Button size="sm" variant="secondary" onClick={() => ws.openQuickAdd({ kind: "country", tripId: trip.id })}>
                  <Plus /> Add countries
                </Button>
              }
            >
              <span id="route-title">Route</span>
            </SectionTitle>
            {countries.length ? (
              <div className="flex flex-col gap-8">
                <div className="pt-5">
                  <RouteTimeline countries={countries} />
                </div>
                <div>
                  <p className="mb-2 text-xs text-muted">Drag to change the route order. Click a transport chip to change how you get there.</p>
                  <RouteList countries={countries} legs={legs} climateStops={climateStops} />
                </div>
              </div>
            ) : (
              <EmptyState
                compact
                icon={Flag}
                title="No countries yet"
                description="Tick many at once — they land in route order."
                action={
                  <Button onClick={() => ws.openQuickAdd({ kind: "country", tripId: trip.id })}>
                    <Plus /> Add countries
                  </Button>
                }
              />
            )}
          </section>
          {countries.length > 0 && (
            <section aria-labelledby="countries-title">
              <SectionTitle
                action={
                  <Link href="/countries" className="flex items-center gap-1 text-sm font-medium text-accent hover:underline">
                    All countries <ArrowRight className="size-4" />
                  </Link>
                }
              >
                <span id="countries-title">Countries</span>
              </SectionTitle>
              <div className="grid gap-4 sm:grid-cols-2">
                {countries.slice(0, 4).map((c) => (
                  <CountryCard key={c.id} c={c} cityCount={cityCounts[c.id] ?? 0} dayCount={dayCounts[c.id] ?? 0} />
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-6 lg:col-span-4">
          <NextSteps steps={steps} tripId={trip.id} onEditTrip={() => setEditOpen(true)} />
          <section className="card p-5" aria-labelledby="budget-title">
            <SectionTitle
              action={
                <Link href="/budget" className="text-sm font-medium text-accent hover:underline">
                  Open
                </Link>
              }
            >
              <span id="budget-title" className="flex items-center gap-2">
                <Wallet className="size-5 text-accent" /> Budget
              </span>
            </SectionTitle>
            {stats.budget || stats.spent || stats.planned ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <span className="num font-display text-[28px] font-semibold">{money(stats.spent)}</span>
                  <span className="num text-sm text-muted">{stats.budget ? `of ${money(stats.budget)}` : "spent"}</span>
                </div>
                {stats.budget > 0 && <Progress value={budgetPct} color={budgetPct > 100 ? "var(--danger)" : "var(--visited)"} />}
                <div className="flex justify-between text-sm text-muted">
                  <span>Planned {money(stats.planned)}</span>
                  {stats.budget > 0 && <span>Left {money(stats.budget - stats.spent)}</span>}
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted">
                No budget yet.{" "}
                <button type="button" className="font-medium text-accent hover:underline" onClick={() => setEditOpen(true)}>
                  Set a total
                </button>{" "}
                or{" "}
                <button type="button" className="font-medium text-accent hover:underline" onClick={() => ws.openQuickAdd("expense")}>
                  add an expense
                </button>
                .
              </p>
            )}
          </section>
          <section className="card p-5" aria-labelledby="mem-title">
            <SectionTitle
              action={
                <Link href="/memories" className="text-sm font-medium text-accent hover:underline">
                  All
                </Link>
              }
            >
              <span id="mem-title" className="flex items-center gap-2">
                <Camera className="size-5 text-accent" /> Memories
              </span>
            </SectionTitle>
            {memories.length ? (
              <ul className="flex flex-col gap-3">
                {memories.map((m) => (
                  <li key={m.id}>
                    <Link href={`/memories?focus=${m.id}`} className="flex items-center gap-3 rounded-xl p-1 hover:bg-ink/[0.04]">
                      <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-surface-2 text-xl ring-1 ring-border">
                        {m.photos[0]?.thumb_url ? <img src={m.photos[0].thumb_url} alt="" className="size-full object-cover" /> : (m.mood ?? "📝")}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{m.title ?? "Untitled"}</span>
                        <span className="text-xs text-muted">{fmtDate(m.date)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                Nothing yet.{" "}
                <button type="button" className="font-medium text-accent hover:underline" onClick={() => ws.openQuickAdd("memory")}>
                  Write the first one
                </button>
                .
              </p>
            )}
          </section>
          <p className="px-1 text-xs text-muted">{pluralize(countries.length, "country", "countries")} · created {fmtDate(trip.created_at)}</p>
        </div>
      </div>
      {editOpen && <TripDialog open onOpenChange={setEditOpen} trip={trip} />}
      {sharing && <ShareDialog kind="trip" targetId={trip.id} title={trip.title} enabled={ws.sharingEnabled} onOpenChange={setSharing} />}
    </PageTransition>
  );
}
