"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, CalendarDays, Camera, List, Map as MapIcon, MapPin, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteCity, saveCityNotes } from "@/actions/cities";
import { daysBetween, fmtDate, fmtRange, fmtTime } from "@/lib/dates";
import type { CityVM, MemoryVM, PlaceVM } from "@/lib/data";
import type { PlaceLinks } from "@/lib/place-duplicates";
import { cityKey } from "@/lib/memory-filters";
import type { ItineraryDay, ItineraryItem } from "@/lib/types";
import { cn, pluralize } from "@/lib/utils";
import { useViewParam } from "@/hooks/use-open-sections";
import { CityClimateCard } from "@/components/climate/climate-card";
import type { PhotoPin } from "@/lib/photo-pins";
import { CoverActions } from "@/components/cover/cover-actions";
import { EmptyState } from "@/components/common/empty-state";
import { Hero, HeroButton } from "@/components/common/hero";
import { PageTransition } from "@/components/common/motion";
import { NotesEditor } from "@/components/common/notes-editor";
import { SectionTitle } from "@/components/common/page-header";
import { GeoStatusChip } from "@/components/common/status-chip";
import { MemoryMini } from "@/components/memories/memory-mini";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Segmented } from "@/components/ui/misc";
import { useWorkspace } from "@/components/shell/workspace";
import { CityEditDialog } from "./city-edit-dialog";
import { CityMap } from "./city-map";
import { CityPlaces } from "./city-places";

const VIEWS = ["list", "map"] as const;

export function CityDetail({
  city,
  pins,
  stay,
  attribution,
  places,
  days,
  items,
  memories,
  placeLinks,
  previousStop,
  isFirstStop,
}: {
  city: CityVM;
  pins: PhotoPin[];
  stay: { arrive: string | null; depart: string | null };
  attribution: string | null;
  places: PlaceVM[];
  days: ItineraryDay[];
  items: ItineraryItem[];
  memories: MemoryVM[];
  placeLinks: Record<string, PlaceLinks>;
  previousStop: string | null;
  isFirstStop: boolean;
}) {
  const ws = useWorkspace();
  const router = useRouter();
  const confirm = useConfirm();
  const [view, setView] = useViewParam(VIEWS);
  const [editOpen, setEditOpen] = useState(false);
  const [, start] = useTransition();
  const nights = daysBetween(city.arrive_date, city.depart_date);
  const onMap = view === "map";
  // A city with photos but no places still has a map to show.
  const showMap = onMap && (places.length > 0 || pins.length > 0);

  const onDelete = async () => {
    if (!(await confirm({ title: `Delete ${city.name}?`, description: "Its places are deleted too. Days keep their stops but lose the city.", confirmLabel: "Delete city" }))) return;
    start(async () => {
      const res = await deleteCity(city.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${city.name} deleted`);
      router.push(`/countries/${city.trip_country_id}?tab=cities`);
    });
  };

  const memoriesSection = (
    <section aria-labelledby="mem-title">
      <SectionTitle
        action={
          memories.length ? (
            <Button size="sm" variant="secondary" onClick={() => ws.openQuickAdd({ kind: "memory", cityId: city.id })}>
              <Plus /> New memory
            </Button>
          ) : null
        }
      >
        <span id="mem-title" className="flex items-center gap-2">
          <Camera className="size-5 text-accent" /> Memories
        </span>
      </SectionTitle>
      {memories.length ? (
        <div className="grid gap-3">
          {memories.slice(0, 4).map((m) => (
            <MemoryMini key={m.id} m={m} />
          ))}
          {memories.length > 4 && (
            <Link href={`/memories?city=${encodeURIComponent(cityKey(city.country_code, city.name))}`} className="flex items-center gap-1 text-sm font-medium text-accent hover:underline">
              All {pluralize(memories.length, "memory", "memories")} <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>
      ) : (
        <EmptyState compact icon={Camera} title="No memories here yet" action={<Button size="sm" variant="secondary" onClick={() => ws.openQuickAdd({ kind: "memory", cityId: city.id })}>Write one</Button>} />
      )}
    </section>
  );

  return (
    <PageTransition className="flex flex-col gap-6">
      <Hero
        coverUrl={city.cover_url}
        seed={city.id}
        icon={Building2}
        alt={city.name}
        topLeft={
          <Link href={`/countries/${city.trip_country_id}`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-black/40 px-3 text-xs font-medium text-white backdrop-blur-md hover:bg-black/55">
            ← {city.flag} {city.country_name}
          </Link>
        }
        actions={
          <>
            <CoverActions kind="city" id={city.id} attribution={attribution} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <HeroButton aria-label="City actions" className="w-9 justify-center px-0">
                  <MoreHorizontal />
                </HeroButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil /> Edit city
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={onDelete}>
                  <Trash2 /> Delete city
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        <GeoStatusChip status={city.display} onPhoto />
        <h1 className="mt-3 text-[40px] font-semibold leading-none sm:text-[56px]">{city.name}</h1>
        <p className="mt-2 text-sm text-white/85">
          {fmtRange(city.arrive_date, city.depart_date)}
          {nights ? ` · ${nights} days` : ""} · {pluralize(places.length, "place")}
        </p>
        <div className="mt-4">
          <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)} className="border-white/20 bg-white/15 text-white backdrop-blur hover:bg-white/25">
            <Pencil /> Edit details
          </Button>
        </div>
      </Hero>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* The side column can run much longer than the map, so the map follows along. Just under the 64px top bar. */}
        <section className={cn("min-w-0 lg:col-span-8", onMap && "lg:sticky lg:top-20 lg:self-start")} aria-labelledby="places-title">
          <SectionTitle
            action={
              <div className="flex items-center gap-2">
                <Segmented size="sm" value={view} onChange={setView} options={[{ value: "list", label: "List", icon: <List /> }, { value: "map", label: "Map", icon: <MapIcon /> }]} />
                <Button size="sm" onClick={() => ws.openQuickAdd({ kind: "place", cityId: city.id })}>
                  <Plus /> <span className="max-sm:sr-only">Add place</span>
                </Button>
              </div>
            }
          >
            <span id="places-title">Places</span>
          </SectionTitle>
          {showMap ? (
            <CityMap places={places} pins={pins} />
          ) : !places.length ? (
            <EmptyState icon={MapPin} title={`Nothing saved in ${city.name} yet`} description="Search for sights, cafés and food spots — or drop a pin." action={<Button onClick={() => ws.openQuickAdd({ kind: "place", cityId: city.id })}><Plus /> Add a place</Button>} />
          ) : (
            <CityPlaces places={places} links={placeLinks} />
          )}
        </section>
        <aside className="flex min-w-0 flex-col gap-6 lg:col-span-4">
          {city.lat != null && city.lng != null && <CityClimateCard lat={city.lat} lng={city.lng} arrive={stay.arrive} depart={stay.depart} />}
          <section className="card p-5" aria-labelledby="days-title">
            <SectionTitle>
              <span id="days-title" className="flex items-center gap-2">
                <CalendarDays className="size-5 text-accent" /> Days here
              </span>
            </SectionTitle>
            {days.length ? (
              <ol className="flex flex-col gap-1">
                {days.map((d) => (
                  <li key={d.id}>
                    <Link href={`/itinerary?country=${d.trip_country_id}&day=${d.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-ink/[0.04]">
                      <span className="num grid size-10 place-items-center rounded-xl bg-surface-2 font-display text-lg font-semibold ring-1 ring-border">{d.day_number}</span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium">{d.title ?? "Untitled day"}</span>
                        <span className="truncate text-xs text-muted">
                          {d.date ? fmtDate(d.date, "EEE, dd MMM") : "No date"} · {pluralize(items.filter((i) => i.day_id === d.id).length, "stop")}
                        </span>
                      </span>
                      <ArrowRight className="size-4 text-muted" />
                    </Link>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">
                No days assigned to {city.name}.{" "}
                <Link href={`/itinerary?country=${city.trip_country_id}`} className="font-medium text-accent hover:underline">
                  Plan the itinerary
                </Link>
              </p>
            )}
            {items.some((i) => i.start_time) && (
              <p className="mt-3 text-xs text-muted">
                Next: {items.filter((i) => !i.done)[0] ? `${fmtTime(items.filter((i) => !i.done)[0]!.start_time)} ${items.filter((i) => !i.done)[0]!.title}` : "all done"}
              </p>
            )}
          </section>
          {!onMap && memoriesSection}
        </aside>
      </div>
      {/* Notes hold the same spot in both views, so switching view doesn't lose what is being typed. */}
      <div className={cn("grid gap-6", onMap && "lg:grid-cols-12")}>
        <section className={cn("min-w-0", onMap && "lg:col-span-8")} aria-labelledby="notes-title">
          <SectionTitle>
            <span id="notes-title">Notes</span>
          </SectionTitle>
          <NotesEditor initial={city.notes} onSave={(v) => saveCityNotes(city.id, v)} placeholder={`Neighbourhoods, transport tips, what to try in ${city.name}…`} />
        </section>
        {onMap && <div className="min-w-0 lg:col-span-4">{memoriesSection}</div>}
      </div>
      {editOpen && <CityEditDialog open onOpenChange={setEditOpen} city={city} previousStop={previousStop} isFirstStop={isFirstStop} />}
    </PageTransition>
  );
}
