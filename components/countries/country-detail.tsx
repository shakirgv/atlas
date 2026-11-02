"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Camera,
  Coins,
  FileText,
  Globe2,
  Info,
  Languages,
  Landmark,
  LifeBuoy,
  Loader2,
  MapPin,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { deleteTripCountry, saveCountryNotes } from "@/actions/countries";
import { generateDays } from "@/actions/itinerary";
import { getCountry } from "@/lib/countries";
import { daysBetween, fmtDate, fmtRange, fmtTime } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { CityVM, CountryVM, MemoryVM, PlaceVM } from "@/lib/data";
import type { DocumentRow, Expense, ItineraryDay, ItineraryItem } from "@/lib/types";
import { DOCUMENT_TYPE_META } from "@/lib/icons";
import { pluralize } from "@/lib/utils";
import { CityCard } from "@/components/cards/cards";
import { CoverActions } from "@/components/cover/cover-actions";
import { EmptyState } from "@/components/common/empty-state";
import { Hero, HeroButton } from "@/components/common/hero";
import { PageTransition } from "@/components/common/motion";
import { NotesEditor } from "@/components/common/notes-editor";
import { SectionTitle } from "@/components/common/page-header";
import { GeoStatusChip } from "@/components/common/status-chip";
import { ExpenseRow } from "@/components/budget/expense-row";
import { ExpiryChip } from "@/components/documents/expiry-chip";
import { MemoryMini } from "@/components/memories/memory-mini";
import { PlaceRow } from "@/components/places/place-row";
import { MapView } from "@/components/map/map";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/misc";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useWorkspace } from "@/components/shell/workspace";
import { CountryEditDialog } from "./country-edit-dialog";
import type { LegView } from "@/lib/server/route-data";
import { JetLagChip } from "@/components/route/jetlag-chip";
import { TransportChip } from "@/components/route/transport-chip";
import { zoneCity } from "@/lib/timezones";
import type { ClimateStop } from "@/lib/climate";
import { CityVerdicts } from "@/components/climate/city-verdicts";
import type { InfoOverride } from "@/lib/country-info";
import { EssentialsTab } from "./essentials-tab";

const TABS = [
  { value: "overview", label: "Overview", icon: Info },
  { value: "essentials", label: "Essentials", icon: LifeBuoy },
  { value: "cities", label: "Cities", icon: Building2 },
  { value: "itinerary", label: "Itinerary", icon: CalendarDays },
  { value: "places", label: "Places", icon: MapPin },
  { value: "budget", label: "Budget", icon: Wallet },
  { value: "memories", label: "Memories", icon: Camera },
  { value: "documents", label: "Documents", icon: FileText },
  { value: "notes", label: "Notes", icon: NotebookPen },
];

export function GenerateDaysButton({ countryId, hasDates, variant = "primary", label = "Generate days" }: { countryId: string; hasDates: boolean; variant?: "primary" | "secondary"; label?: string }) {
  const [pending, start] = useTransition();
  const [count, setCount] = useState("3");
  const [open, setOpen] = useState(false);
  const run = (blank?: number) =>
    start(async () => {
      const res = await generateDays(countryId, blank);
      if (!res.ok) return void toast.error(res.error);
      setOpen(false);
      toast.success(res.data.created ? `Created ${pluralize(res.data.created, "day")}` : "Days are up to date");
    });
  if (hasDates) {
    return (
      <Button variant={variant} disabled={pending} onClick={() => run()}>
        {pending ? <Loader2 className="animate-spin" /> : <Sparkles />} {label}
      </Button>
    );
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant={variant}>
          <Sparkles /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64">
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(Math.max(1, Math.min(60, Number(count) || 3)));
          }}
        >
          <p className="text-sm">No dates yet. How many blank days?</p>
          <Input type="number" min={1} max={60} value={count} onChange={(e) => setCount(e.target.value)} aria-label="Number of days" autoFocus />
          <Button type="submit" size="sm" disabled={pending}>
            {pending && <Loader2 className="animate-spin" />} Create days
          </Button>
        </form>
      </PopoverContent>
    </Popover>
  );
}

export function CountryDetail({
  legs,
  climateStops,
  infoOverride,
  country,
  attribution,
  cities,
  places,
  days,
  items,
  expenses,
  memories,
  documents,
  baseCurrency,
  initialTab,
  openEdit,
}: {
  legs: LegView[];
  climateStops: ClimateStop[];
  infoOverride: InfoOverride;
  country: CountryVM;
  attribution: string | null;
  cities: CityVM[];
  places: PlaceVM[];
  days: ItineraryDay[];
  items: ItineraryItem[];
  expenses: Expense[];
  memories: MemoryVM[];
  documents: DocumentRow[];
  baseCurrency: string;
  initialTab: string;
  openEdit: boolean;
}) {
  const ws = useWorkspace();
  const router = useRouter();
  const confirm = useConfirm();
  const [tab, setTab] = useState(TABS.some((t) => t.value === initialTab) ? initialTab : "overview");
  const [editOpen, setEditOpen] = useState(openEdit);
  const [, start] = useTransition();
  const info = getCountry(country.code);
  const money = (n: number) => formatMoney(n, baseCurrency);
  const spent = expenses.filter((e) => e.kind === "actual").reduce((s, e) => s + Number(e.amount_base), 0);
  const planned = expenses.filter((e) => e.kind === "planned").reduce((s, e) => s + Number(e.amount_base), 0);
  const cap = Number(country.budget ?? 0);
  const citiesWithDays = cities.filter((c) => days.some((d) => d.city_id === c.id)).length;
  const nights = daysBetween(country.arrive_date, country.depart_date);
  const markers = cities.filter((c) => c.lat != null && c.lng != null).map((c, i) => ({ id: c.id, lat: c.lat!, lng: c.lng!, label: c.name, number: i + 1 }));

  const legIn = legs.find((l) => l.fromTripCountryId !== country.id) ?? null;

  const changeTab = (v: string) => {
    setTab(v);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", v);
    url.searchParams.delete("edit");
    window.history.replaceState(null, "", url);
  };

  const onDelete = async () => {
    if (!(await confirm({ title: `Remove ${country.name} from the trip?`, description: "Its cities, places and itinerary days will be deleted too.", confirmLabel: "Remove country" }))) return;
    start(async () => {
      const res = await deleteTripCountry(country.id);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`${country.name} removed`);
      router.push("/countries");
    });
  };

  const facts = [
    { icon: Landmark, label: "Capital", value: info?.capital.join(", ") || "—" },
    { icon: Coins, label: "Currency", value: info?.currencies.map((c) => `${c.name} (${c.code}${c.symbol ? ` · ${c.symbol}` : ""})`).join(", ") || "—" },
    { icon: Languages, label: "Languages", value: info?.languages.join(", ") || "—" },
    { icon: Globe2, label: "Region", value: [info?.subregion, info?.region].filter(Boolean).join(", ") || "—" },
    { icon: Phone, label: "Calling code", value: info?.idd ?? "—" },
    { icon: MapPin, label: "Area", value: info?.area ? `${Math.round(info.area).toLocaleString("en-US")} km²` : "—" },
  ];

  return (
    <PageTransition className="flex flex-col gap-6">
      <Hero
        coverUrl={country.cover_url}
        seed={country.code}
        flag={country.flag}
        alt={country.name}
        topLeft={
          <Link href={`/trips/${country.trip_id}`} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-black/40 px-3 text-xs font-medium text-white backdrop-blur-md hover:bg-black/55">
            ← {country.trip_title}
          </Link>
        }
        actions={
          <>
            <CoverActions kind="country" id={country.id} attribution={attribution} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <HeroButton aria-label="Country actions" className="w-9 justify-center px-0">
                  <MoreHorizontal />
                </HeroButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onSelect={() => setEditOpen(true)}>
                  <Pencil /> Edit dates, status, budget
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={onDelete}>
                  <Trash2 /> Remove from trip
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-12 place-items-center rounded-xl bg-white/90 text-3xl shadow-sm">{country.flag}</span>
          <GeoStatusChip status={country.display} onPhoto />
          <JetLagChip jetlag={legIn?.jetlag} onPhoto from={legIn?.fromName} />
        </div>
        <h1 className="mt-3 text-[40px] font-semibold leading-none sm:text-[56px]">{country.name}</h1>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/85">
          <span>{fmtRange(country.arrive_date, country.depart_date)}{nights ? ` · ${nights} days` : ""}</span>
          {info?.capital[0] && <span>Capital {info.capital[0]}</span>}
          {info?.currencies[0] && <span>{info.currencies[0].code}</span>}
          {info?.languages.length ? <span>{info.languages.slice(0, 2).join(", ")}</span> : null}
        </p>
        <div className="mt-4">
          <Button size="sm" variant="secondary" onClick={() => setEditOpen(true)} className="border-white/20 bg-white/15 text-white backdrop-blur hover:bg-white/25">
            <Pencil /> {country.arrive_date ? "Edit details" : "Set dates"}
          </Button>
        </div>
      </Hero>

      <Tabs value={tab} onValueChange={changeTab}>
        <TabsList aria-label="Country sections">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value}>
              <t.icon /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="flex min-w-0 flex-col gap-6 lg:col-span-7">
              <section className="card overflow-hidden">
                <MapView className="h-72" markers={markers} polyline emptyLabel="Add cities to pin them here" onMarkerClick={(id) => router.push(`/cities/${id}`)} />
                <div className="flex flex-col gap-2 p-5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">Planning progress</span>
                    <span className="num text-muted">
                      {citiesWithDays} of {pluralize(cities.length, "city", "cities")} have days planned
                    </span>
                  </div>
                  <Progress value={cities.length ? (citiesWithDays / cities.length) * 100 : 0} color="var(--visited)" />
                </div>
              </section>
              {legs.length > 0 && (
                <section className="card p-5" aria-label="Getting here and around">
                  <SectionTitle>Getting here</SectionTitle>
                  <ol className="flex flex-col gap-3">
                    {legs.map((l) => (
                      <li key={l.key} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between">
                        <span className="min-w-0 text-sm">
                          <span className="text-muted">{l.fromHome ? "Home" : l.fromName}</span> → <span className="font-medium">{l.toName}</span>
                          {l.toTz && <span className="ml-1.5 text-xs text-muted">{zoneCity(l.toTz)} time</span>}
                        </span>
                        <span className="flex flex-wrap items-center gap-1.5">
                          <TransportChip mode={l.mode} note={l.note} owner={l.owner} toName={l.toName} />
                          <JetLagChip jetlag={l.jetlag} from={l.fromName} />
                        </span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
              <CityVerdicts stops={climateStops} />
              {cap > 0 && (
                <section className="card p-5">
                  <SectionTitle>Budget cap</SectionTitle>
                  <div className="flex items-baseline justify-between">
                    <span className="num font-display text-2xl font-semibold">{money(spent)}</span>
                    <span className="num text-sm text-muted">of {money(cap)}</span>
                  </div>
                  <Progress className="mt-2" value={(spent / cap) * 100} color={spent > cap ? "var(--danger)" : "var(--visited)"} />
                </section>
              )}
            </div>
            <section className="card min-w-0 p-5 lg:col-span-5">
              <SectionTitle>Quick facts</SectionTitle>
              <dl className="flex flex-col divide-y divide-border">
                {facts.map((f) => (
                  <div key={f.label} className="flex items-start gap-3 py-3">
                    <f.icon className="mt-0.5 size-4 shrink-0 text-accent" />
                    <dt className="w-28 shrink-0 text-sm text-muted">{f.label}</dt>
                    <dd className="text-sm">{f.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="essentials">
          <EssentialsTab code={country.code} countryId={country.id} override={infoOverride} />
        </TabsContent>

        <TabsContent value="cities">
          <SectionTitle action={<Button size="sm" onClick={() => ws.openQuickAdd({ kind: "city", tripCountryId: country.id })}><Plus /> Add cities</Button>}>
            {pluralize(cities.length, "city", "cities")}
          </SectionTitle>
          {cities.length ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {cities.map((c) => (
                <CityCard key={c.id} c={c} placeCount={places.filter((p) => p.city_id === c.id).length} dayCount={days.filter((d) => d.city_id === c.id).length} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Building2} title="No cities yet" description="Search as you type — each city is pinned and gets a photo." action={<Button onClick={() => ws.openQuickAdd({ kind: "city", tripCountryId: country.id })}><Plus /> Add cities</Button>} />
          )}
        </TabsContent>

        <TabsContent value="itinerary">
          <SectionTitle
            action={
              <div className="flex gap-2">
                <GenerateDaysButton countryId={country.id} hasDates={Boolean(country.arrive_date && country.depart_date)} variant="secondary" />
                {days.length > 0 && (
                  <Button size="md" asChild>
                    <Link href={`/itinerary?country=${country.id}`}>
                      Open planner <ArrowRight />
                    </Link>
                  </Button>
                )}
              </div>
            }
          >
            {pluralize(days.length, "day")}
          </SectionTitle>
          {days.length ? (
            <ol className="card divide-y divide-border">
              {days.map((d) => {
                const stops = items.filter((i) => i.day_id === d.id);
                const city = cities.find((c) => c.id === d.city_id);
                return (
                  <li key={d.id}>
                    <Link href={`/itinerary?country=${country.id}&day=${d.id}`} className="flex items-center gap-4 p-4 hover:bg-ink/[0.03]">
                      <span className="flex w-12 shrink-0 flex-col items-center">
                        <span className="text-[11px] uppercase tracking-wider text-muted">Day</span>
                        <span className="num font-display text-2xl font-semibold leading-none">{d.day_number}</span>
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{d.title ?? (city ? city.name : "Untitled day")}</span>
                        <span className="truncate text-xs text-muted">
                          {d.date ? fmtDate(d.date, "EEE, dd MMM") : "No date"} · {pluralize(stops.length, "stop")}
                          {stops[0] ? ` · ${[fmtTime(stops[0].start_time), stops[0].title].filter(Boolean).join(" ")}` : ""}
                        </span>
                      </span>
                      <ArrowRight className="size-4 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ol>
          ) : (
            <EmptyState icon={CalendarDays} title="No days yet" description={country.arrive_date ? "Generate one day per date, then fill them with stops." : "Set the country dates first, or create blank days."} action={<GenerateDaysButton countryId={country.id} hasDates={Boolean(country.arrive_date && country.depart_date)} />} />
          )}
        </TabsContent>

        <TabsContent value="places">
          <SectionTitle action={cities.length ? <Button size="sm" onClick={() => ws.openQuickAdd({ kind: "place", cityId: cities[0]?.id })}><Plus /> Add place</Button> : null}>
            {pluralize(places.length, "place")}
          </SectionTitle>
          {places.length ? (
            <div className="card divide-y divide-border p-2">
              {places.map((p) => (
                <PlaceRow key={p.id} place={p} />
              ))}
            </div>
          ) : (
            <EmptyState icon={MapPin} title="No places yet" description={cities.length ? "Sights, food spots, cafés — save them here." : "Add a city first, then save places in it."} action={<Button onClick={() => ws.openQuickAdd(cities.length ? { kind: "place", cityId: cities[0]?.id } : { kind: "city", tripCountryId: country.id })}><Plus /> {cities.length ? "Add place" : "Add cities"}</Button>} />
          )}
        </TabsContent>

        <TabsContent value="budget">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="card p-4">
              <p className="text-sm text-muted">Spent</p>
              <p className="num font-display text-2xl font-semibold">{money(spent)}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-muted">Planned</p>
              <p className="num font-display text-2xl font-semibold">{money(planned)}</p>
            </div>
            <div className="card p-4">
              <p className="text-sm text-muted">Cap</p>
              <p className="num font-display text-2xl font-semibold">{cap ? money(cap) : "—"}</p>
              {cap > 0 && <Progress className="mt-2" value={(spent / cap) * 100} color={spent > cap ? "var(--danger)" : "var(--visited)"} />}
            </div>
          </div>
          <div className="mt-6">
            <SectionTitle action={<Button size="sm" onClick={() => ws.openQuickAdd({ kind: "expense", tripCountryId: country.id })}><Plus /> Add expense</Button>}>Expenses</SectionTitle>
            {expenses.length ? (
              <ul className="card divide-y divide-border px-4">
                {expenses.map((e) => (
                  <ExpenseRow key={e.id} e={e} base={baseCurrency} />
                ))}
              </ul>
            ) : (
              <EmptyState compact icon={Wallet} title="No expenses yet" description="Log what you plan to spend or already spent here." />
            )}
          </div>
        </TabsContent>

        <TabsContent value="memories">
          <SectionTitle action={<Button size="sm" onClick={() => ws.openQuickAdd("memory")}><Plus /> New memory</Button>}>{pluralize(memories.length, "memory", "memories")}</SectionTitle>
          {memories.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {memories.map((m) => (
                <MemoryMini key={m.id} m={m} />
              ))}
            </div>
          ) : (
            <EmptyState icon={Camera} title="No memories yet" description="Write a few lines and drop in photos — before, during or after." />
          )}
        </TabsContent>

        <TabsContent value="documents">
          <SectionTitle action={<Button size="sm" onClick={() => ws.openQuickAdd("document")}><Plus /> Upload</Button>}>{pluralize(documents.length, "document")}</SectionTitle>
          {documents.length ? (
            <ul className="card divide-y divide-border">
              {documents.map((d) => {
                const meta = DOCUMENT_TYPE_META[d.type as keyof typeof DOCUMENT_TYPE_META] ?? DOCUMENT_TYPE_META.other;
                return (
                  <li key={d.id}>
                    <Link href={`/documents?open=${d.id}`} className="flex items-center gap-3 p-4 hover:bg-ink/[0.03]">
                      <span className="grid size-10 place-items-center rounded-xl bg-surface-2 ring-1 ring-border">
                        <meta.icon className="size-5 text-accent" />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate font-medium">{d.title}</span>
                        <span className="text-xs text-muted">{meta.label}{d.reference_no ? ` · ${d.reference_no}` : ""}</span>
                      </span>
                      <ExpiryChip expiry={d.expiry_date} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState compact icon={FileText} title="No documents for this country" description="Visas, tickets and bookings live here." />
          )}
        </TabsContent>

        <TabsContent value="notes">
          <NotesEditor initial={country.notes} onSave={(v) => saveCountryNotes(country.id, v)} />
        </TabsContent>
      </Tabs>
      {editOpen && <CountryEditDialog open onOpenChange={setEditOpen} country={country} name={country.name} baseCurrency={baseCurrency} />}
    </PageTransition>
  );
}
