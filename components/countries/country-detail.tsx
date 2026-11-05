"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpenCheck,
  Building2,
  CalendarClock,
  CalendarDays,
  Camera,
  Coins,
  FileText,
  Globe2,
  Info,
  Languages,
  Landmark,
  LifeBuoy,
  MapPin,
  MoreHorizontal,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  ShieldCheck,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { deleteTripCountry, saveCountryNotes } from "@/actions/countries";
import { getCountry } from "@/lib/countries";
import { daysBetween, durationLabel, fmtRange, todayIso } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import type { CityVM, CountryVM, MemoryVM, PlaceVM } from "@/lib/data";
import type { DocumentRow, Expense, ItineraryDay, ItineraryItem } from "@/lib/types";
import { passportProblem } from "@/lib/entry";
import type { PlaceLinks } from "@/lib/place-duplicates";
import { DOCUMENT_TYPE_META } from "@/lib/icons";
import { pluralize } from "@/lib/utils";
import { CitySortGrid } from "@/components/countries/city-sort-grid";
import { CoverActions } from "@/components/cover/cover-actions";
import { EmptyState } from "@/components/common/empty-state";
import { FlagChip } from "@/components/common/flag";
import { Hero, HeroButton } from "@/components/common/hero";
import { PageTransition } from "@/components/common/motion";
import { NotesEditor } from "@/components/common/notes-editor";
import { SectionTitle } from "@/components/common/page-header";
import { GeoStatusChip } from "@/components/common/status-chip";
import { ExpiryChip } from "@/components/documents/expiry-chip";
import { MemoryMini } from "@/components/memories/memory-mini";
import { MapView } from "@/components/map/map";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/misc";
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
import { EntryTab, type EntryDocument } from "@/components/entry/entry-tab";
import { EntryWarningChip } from "@/components/entry/entry-chips";
import { listReturnHref } from "@/hooks/use-list-return";
import { BudgetTab } from "./budget-tab";
import { ItineraryTab } from "./itinerary-tab";
import { PlacesTab } from "./places-tab";
import type { CountryReview, EntryRequirement } from "@/lib/types";
import { hasLeft } from "@/lib/closing-notes";
import { DateShiftDialog } from "@/components/route/date-shift-dialog";
import { ClosingNotesCard, ClosingNotesDialog } from "./closing-notes";

const TABS = [
  { value: "overview", label: "Overview", icon: Info },
  { value: "entry", label: "Entry", icon: ShieldCheck },
  { value: "essentials", label: "Essentials", icon: LifeBuoy },
  { value: "cities", label: "Cities", icon: Building2 },
  { value: "itinerary", label: "Itinerary", icon: CalendarDays },
  { value: "places", label: "Places", icon: MapPin },
  { value: "budget", label: "Budget", icon: Wallet },
  { value: "memories", label: "Memories", icon: Camera },
  { value: "documents", label: "Documents", icon: FileText },
  { value: "notes", label: "Notes", icon: NotebookPen },
];

export function CountryDetail({
  legs,
  climateStops,
  infoOverride,
  entry,
  country,
  attribution,
  cities,
  places,
  days,
  items,
  expenses,
  memories,
  documents,
  passportId,
  placeLinks,
  baseCurrency,
  initialTab,
  openEdit,
  closing,
}: {
  legs: LegView[];
  climateStops: ClimateStop[];
  infoOverride: InfoOverride;
  entry: { requirement: EntryRequirement | null; passportCountry: string | null; passportExpiry: string | null; documents: EntryDocument[] };
  country: CountryVM;
  attribution: string | null;
  cities: CityVM[];
  places: PlaceVM[];
  days: ItineraryDay[];
  items: ItineraryItem[];
  expenses: Expense[];
  memories: MemoryVM[];
  documents: DocumentRow[];
  /** The passport that counts for this stay. Its row carries what its expiry means for these dates. */
  passportId: string | null;
  placeLinks: Record<string, PlaceLinks>;
  baseCurrency: string;
  initialTab: string;
  openEdit: boolean;
  closing: { available: boolean; review: CountryReview | null; hotels: string[] };
}) {
  const ws = useWorkspace();
  const router = useRouter();
  const confirm = useConfirm();
  const [tab, setTab] = useState(TABS.some((t) => t.value === initialTab) ? initialTab : "overview");
  const [editOpen, setEditOpen] = useState(openEdit);
  const [closingOpen, setClosingOpen] = useState(false);
  const [shifting, setShifting] = useState(false);
  const [, start] = useTransition();
  const info = getCountry(country.code);
  const money = (n: number) => formatMoney(n, baseCurrency);
  const spent = expenses.filter((e) => e.kind === "actual").reduce((s, e) => s + Number(e.amount_base), 0);
  const cap = Number(country.budget ?? 0);
  const citiesWithDays = cities.filter((c) => days.some((d) => d.city_id === c.id)).length;
  const nights = daysBetween(country.arrive_date, country.depart_date);
  const markers = cities.filter((c) => c.lat != null && c.lng != null).map((c, i) => ({ id: c.id, lat: c.lat!, lng: c.lng!, label: c.name, number: i + 1 }));

  const legIn = legs.find((l) => l.fromTripCountryId !== country.id) ?? null;
  const passportIssue = passportProblem(entry.requirement, { arrive: country.arrive_date, depart: country.depart_date, today: todayIso(), passportExpiry: entry.passportExpiry, passportCountry: entry.passportCountry });
  const tabsRoot = useRef<HTMLDivElement>(null);
  const tabsList = useRef<HTMLDivElement>(null);

  // On a phone the tabs scroll sideways: keep the open one in view, including when the page opens on it.
  useEffect(() => {
    const list = tabsList.current;
    const active = list?.querySelector<HTMLElement>('[data-state="active"]');
    if (list && active) list.scrollTo({ left: active.offsetLeft - (list.clientWidth - active.offsetWidth) / 2 });
  }, [tab]);

  const changeTab = (v: string) => {
    setTab(v);
    // Past the top of the tabs, a shorter tab would otherwise drop the page somewhere unrelated. Start the new one at its top.
    const root = tabsRoot.current;
    const list = tabsList.current;
    if (root && list) {
      const stuckAt = parseFloat(getComputedStyle(list).top) || 0;
      const top = root.getBoundingClientRect().top;
      if (top < stuckAt) window.scrollBy({ top: top - stuckAt });
    }
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
    <PageTransition className="flex flex-col gap-4 sm:gap-6">
      <nav aria-label="Breadcrumb" className="-mb-1 sm:-mb-2">
        <ol className="flex min-w-0 items-center gap-1.5 text-sm">
          <li className="shrink-0">
            <Link
              href="/countries"
              onClick={(e) => {
                const href = listReturnHref();
                if (!href || e.metaKey || e.ctrlKey || e.shiftKey) return;
                e.preventDefault();
                router.push(href);
              }}
              className="inline-flex min-h-9 items-center font-medium text-muted hover:text-ink hover:underline"
            >
              Countries
            </Link>
          </li>
          <li aria-hidden className="shrink-0 text-muted">
            →
          </li>
          <li aria-current="page" className="min-w-0 truncate font-medium">
            {country.name}
          </li>
        </ol>
      </nav>
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
                <DropdownMenuItem onSelect={() => setShifting(true)}>
                  <CalendarClock /> Shift dates from here
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setClosingOpen(true)}>
                  <BookOpenCheck /> Closing notes
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
          <FlagChip code={country.code} size="lg" onPhoto />
          <GeoStatusChip status={country.display} onPhoto />
          <JetLagChip jetlag={legIn?.jetlag} onPhoto from={legIn?.fromName} />
        </div>
        <h1 className="mt-3 text-[40px] font-semibold leading-none sm:text-[56px]">{country.name}</h1>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/85">
          <span>{fmtRange(country.arrive_date, country.depart_date)} · {durationLabel(country.arrive_date, country.depart_date, days.length)}</span>
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

      <Tabs ref={tabsRoot} value={tab} onValueChange={changeTab}>
        {/* Just under the top bar, which is 56px tall and 64px from md up. */}
        <TabsList ref={tabsList} aria-label="Country sections" className="sticky top-14 z-20 bg-bg md:top-16">
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
              {(hasLeft(country) || country.status === "visited" || closing.review?.completed_at) && <ClosingNotesCard review={closing.review} stayed={nights} available={closing.available} onEdit={() => setClosingOpen(true)} />}
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

        <TabsContent value="entry">
          <EntryTab tripCountryId={country.id} arrive={country.arrive_date} depart={country.depart_date} {...entry} />
        </TabsContent>

        <TabsContent value="essentials">
          <EssentialsTab code={country.code} countryId={country.id} override={infoOverride} />
        </TabsContent>

        <TabsContent value="cities">
          <SectionTitle action={<Button size="sm" onClick={() => ws.openQuickAdd({ kind: "city", tripCountryId: country.id })}><Plus /> Add cities</Button>}>
            {pluralize(cities.length, "city", "cities")}
          </SectionTitle>
          {cities.length ? (
            <CitySortGrid cities={cities} places={places} days={days} />
          ) : (
            <EmptyState icon={Building2} title="No cities yet" description="Search as you type — each city is pinned and gets a photo." action={<Button onClick={() => ws.openQuickAdd({ kind: "city", tripCountryId: country.id })}><Plus /> Add cities</Button>} />
          )}
        </TabsContent>

        <TabsContent value="itinerary">
          <ItineraryTab country={country} cities={cities} days={days} items={items} places={places} />
        </TabsContent>

        <TabsContent value="places">
          <PlacesTab countryId={country.id} cities={cities} places={places} links={placeLinks} />
        </TabsContent>

        <TabsContent value="budget">
          <BudgetTab country={country} cities={cities} expenses={expenses} baseCurrency={baseCurrency} />
        </TabsContent>

        <TabsContent value="memories">
          <SectionTitle action={<Button size="sm" onClick={() => ws.openQuickAdd({ kind: "memory", tripCountryId: country.id })}><Plus /> New memory</Button>}>{pluralize(memories.length, "memory", "memories")}</SectionTitle>
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
                const issue = d.id === passportId ? passportIssue : null;
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
                      <span className="flex shrink-0 flex-col items-end gap-1">
                        {issue && <EntryWarningChip warning={{ id: "passport", ...issue }} />}
                        <ExpiryChip expiry={d.expiry_date} />
                      </span>
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
      {editOpen && (
        <CountryEditDialog
          open
          onOpenChange={setEditOpen}
          country={country}
          name={country.name}
          baseCurrency={baseCurrency}
          onSaved={(status) => {
            // Marking it visited is the moment of leaving, so that's when the notes get asked for.
            if (status === "visited" && country.status !== "visited" && closing.available && !closing.review?.completed_at) setClosingOpen(true);
          }}
        />
      )}
      {closingOpen && <ClosingNotesDialog country={country} review={closing.review} places={places} hotels={closing.hotels} onOpenChange={setClosingOpen} />}
      {shifting && <DateShiftDialog tripId={country.trip_id} initialCountryId={country.id} onOpenChange={setShifting} />}
    </PageTransition>
  );
}
