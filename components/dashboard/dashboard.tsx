"use client";
import Link from "next/link";
import { AlertTriangle, ArrowRight, BellRing, Building2, CalendarDays, Camera, CalendarClock, Earth, FileText, Flag, History, Info, MapPin, Plane, Plus, Wallet } from "lucide-react";
import type { BudgetSummary } from "@/lib/budget";
import type { Alert } from "@/lib/alerts";
import type { CityVM, CountryVM, MemoryVM } from "@/lib/data";
import type { Booking, ItineraryDay, ItineraryItem, StopType, Trip } from "@/lib/types";
import { countdownLabel, daysBetween, fmtDate, fmtRange, fmtTime, todayIso } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { STOP_TYPE_META, BOOKING_TYPE_META } from "@/lib/icons";
import { cn, pluralize } from "@/lib/utils";
import { CategoryDonut, DonutLegend, Ring } from "@/components/charts/charts";
import { Cover } from "@/components/common/cover";
import { EmptyState } from "@/components/common/empty-state";
import { CountUp, PageTransition, Stagger, StaggerItem } from "@/components/common/motion";
import { GeoStatusChip } from "@/components/common/status-chip";
import { MemoryMini } from "@/components/memories/memory-mini";
import { WorldMap, type MapCity, type MapCountryState, type RoutePoint } from "@/components/map/world-map";
import { Button } from "@/components/ui/button";
import { SetupBanner } from "@/components/common/setup-banner";
import { useWorkspace } from "@/components/shell/workspace";

type Stats = { visited: number; planned: number; cities: number; daysOnRoad: number; placesVisited: number; places: number; photos: number };
type UpDay = { day: ItineraryDay; country: CountryVM | null; city: CityVM | null; stops: ItineraryItem[]; bookings: Booking[] };

function greeting() {
  const h = new Date().getHours();
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

function Tile({ icon: Icon, label, children, tone }: { icon: typeof Flag; label: string; children: React.ReactNode; tone: string }) {
  return (
    <div className="card flex min-h-[104px] flex-col justify-between gap-2 p-4">
      <div className="flex items-center gap-2 text-[13px] text-muted">
        <span className="grid size-7 place-items-center rounded-lg" style={{ background: `color-mix(in srgb, ${tone} 15%, transparent)` }}>
          <Icon className="size-4" style={{ color: tone }} />
        </span>
        {label}
      </div>
      {children}
    </div>
  );
}

function Panel({ title, icon: Icon, action, children, className }: { title: string; icon: typeof Flag; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("card flex flex-col p-5", className)} aria-label={title}>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          <Icon className="size-5 text-accent" /> {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function NextStopHero({ c, cityCount }: { c: CountryVM | null; cityCount: number }) {
  const ws = useWorkspace();
  if (!c) {
    return (
      <div className="card relative flex h-full min-h-[300px] flex-col justify-end overflow-hidden p-6">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_10%,var(--accent-soft),transparent_60%)]" />
        <p className="eyebrow relative">Next stop</p>
        <p className="relative mt-1 font-display text-[32px] font-semibold leading-tight">Where to next?</p>
        <p className="relative mt-1 max-w-md text-muted">Add countries and give them dates — your next stop and countdown appear here.</p>
        <div className="relative mt-4">
          <Button onClick={() => ws.openQuickAdd("country")}>
            <Plus /> Add countries
          </Button>
        </div>
      </div>
    );
  }
  const today = todayIso();
  const ongoing = c.display === "ongoing";
  const total = daysBetween(c.arrive_date, c.depart_date);
  const dayN = ongoing ? daysBetween(c.arrive_date, today) : 0;
  return (
    <Link href={`/countries/${c.id}`} className="card card-hover group relative block h-full min-h-[300px] overflow-hidden">
      <Cover src={c.cover_url} alt={c.name} seed={c.code} eager className="absolute inset-0">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0/0.2)_0%,rgb(0_0_0/0)_35%,rgb(0_0_0/0.8)_100%)]" />
      </Cover>
      <div className="absolute inset-x-5 top-5 flex items-center justify-between">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-black/40 px-3 text-xs font-medium uppercase tracking-wider text-white backdrop-blur-md">
          <Plane className="size-3.5" /> {ongoing ? "You are here" : "Next stop"}
        </span>
        <GeoStatusChip status={c.display} onPhoto />
      </div>
      <div className="absolute inset-x-5 bottom-5 text-white sm:inset-x-6 sm:bottom-6">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[52px] leading-none">{c.flag}</p>
            <p className="mt-2 truncate font-display text-[40px] font-semibold leading-none sm:text-[48px]">{c.name}</p>
            <p className="mt-2 text-sm text-white/85">
              {fmtRange(c.arrive_date, c.depart_date)} · {pluralize(cityCount, "city", "cities")}
            </p>
          </div>
          <div className="shrink-0 text-right">
            {ongoing ? (
              <>
                <p className="num font-display text-[44px] font-semibold leading-none">
                  {dayN}
                  <span className="text-2xl text-white/70">/{total}</span>
                </p>
                <p className="text-sm text-white/85">Day {dayN} of {total} in {c.name}</p>
              </>
            ) : (
              <>
                <p className="num font-display text-[44px] font-semibold leading-none">{countdownLabel(c.arrive_date).replace(/^in /, "").replace(" days", "")}</p>
                <p className="text-sm text-white/85">{/^\d/.test(countdownLabel(c.arrive_date).replace(/^in /, "")) ? "days to go" : ""}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}

export function Dashboard({
  displayName,
  baseCurrency,
  activeTrip,
  hasTrips,
  nextStop,
  nextStopCityCount,
  stats,
  budget,
  map,
  upcomingDays,
  memories,
  onThisDay,
  alerts,
  setup,
}: {
  displayName: string;
  baseCurrency: string;
  activeTrip: Trip | null;
  hasTrips: boolean;
  nextStop: CountryVM | null;
  nextStopCityCount: number;
  stats: Stats;
  budget: BudgetSummary;
  map: { states: Record<string, MapCountryState>; routes: RoutePoint[][]; cities: MapCity[] };
  upcomingDays: UpDay[];
  memories: MemoryVM[];
  onThisDay: MemoryVM[];
  alerts: Alert[];
  setup: { missingHome: boolean; missingPassport: boolean };
}) {
  const ws = useWorkspace();
  const money = (n: number) => formatMoney(n, baseCurrency);
  const used = budget.totalBudget ? budget.spent / budget.totalBudget : 0;
  const first = displayName.split(" ")[0];

  if (!hasTrips) {
    return (
      <PageTransition className="flex flex-col gap-6">
        <div>
          <p className="eyebrow">{fmtDate(new Date(), "EEEE, dd MMMM")}</p>
          <h1 className="mt-1 text-[36px] font-semibold sm:text-[44px]">
            {greeting()}
            {first ? `, ${first}` : ""}.
          </h1>
        </div>
        <EmptyState
          icon={Earth}
          title="Let's plan your first trip"
          description="Create a trip, add countries in bulk, pin cities, generate days — Atlas guides you step by step."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={() => ws.openQuickAdd("trip")}>
                <Plus /> Create a trip
              </Button>
              <Button variant="secondary" asChild>
                <Link href="/settings#sample">Load sample data</Link>
              </Button>
            </div>
          }
        />
      </PageTransition>
    );
  }

  return (
    <PageTransition className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">{fmtDate(new Date(), "EEEE, dd MMMM")}{activeTrip ? ` · ${activeTrip.title}` : " · All trips"}</p>
          <h1 className="mt-1 text-[34px] font-semibold sm:text-[44px]">
            {greeting()}
            {first ? `, ${first}` : ""}.
          </h1>
        </div>
        <div className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Quick actions">
          {[
            { kind: "country" as const, label: "Country", icon: Flag },
            { kind: "expense" as const, label: "Expense", icon: Wallet },
            { kind: "memory" as const, label: "Memory", icon: Camera },
            { kind: "document" as const, label: "Document", icon: FileText },
          ].map((a) => (
            <Button key={a.kind} variant="secondary" size="sm" onClick={() => ws.openQuickAdd(a.kind)} className="h-9 shrink-0">
              <Plus className="!size-3.5 text-accent" /> {a.label}
            </Button>
          ))}
        </div>
      </div>

      <SetupBanner {...setup} />

      <Stagger className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-12">
        <StaggerItem className="md:col-span-2 lg:col-span-7">
          <NextStopHero c={nextStop} cityCount={nextStopCityCount} />
        </StaggerItem>
        <StaggerItem className="grid grid-cols-2 gap-3 md:col-span-2 lg:col-span-5 lg:gap-4">
          <Tile icon={Flag} label="Countries" tone="var(--visited)">
            <p className="num font-display text-[28px] font-semibold leading-none">
              <CountUp value={stats.visited} />
              <span className="text-lg text-muted"> / <CountUp value={stats.planned} /></span>
            </p>
            <p className="-mt-1 text-xs text-muted">visited / planned</p>
          </Tile>
          <Tile icon={Building2} label="Cities" tone="var(--wishlist)">
            <CountUp value={stats.cities} className="num font-display text-[28px] font-semibold leading-none" />
          </Tile>
          <Tile icon={CalendarDays} label="Days on the road" tone="var(--planned)">
            <CountUp value={stats.daysOnRoad} className="num font-display text-[28px] font-semibold leading-none" />
          </Tile>
          <Tile icon={MapPin} label="Places visited" tone="var(--accent)">
            <p className="num font-display text-[28px] font-semibold leading-none">
              <CountUp value={stats.placesVisited} />
              <span className="text-lg text-muted"> / {stats.places}</span>
            </p>
          </Tile>
          <Tile icon={Wallet} label="Budget used" tone="var(--visited)">
            <div className="flex items-center justify-between gap-2">
              <CountUp value={Math.round(used * 100)} format={(n) => `${Math.round(n)}%`} className="num font-display text-[28px] font-semibold leading-none" />
              <Ring value={used} size={44} stroke={5} />
            </div>
          </Tile>
          <Tile icon={Camera} label="Photos" tone="var(--wishlist)">
            <CountUp value={stats.photos} className="num font-display text-[28px] font-semibold leading-none" />
          </Tile>
        </StaggerItem>

        <StaggerItem className="md:col-span-2 lg:col-span-8">
          <section className="card relative h-full min-h-[300px] overflow-hidden" aria-label="World map">
            <div className="absolute left-5 top-4 z-10">
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <Earth className="size-5 text-accent" /> Your world
              </h2>
            </div>
            <Link href="/map" className="absolute right-4 top-4 z-10 flex items-center gap-1 rounded-full bg-surface/85 px-3 py-1.5 text-sm font-medium text-accent backdrop-blur hover:underline">
              Open map <ArrowRight className="size-4" />
            </Link>
            <Link href="/map" aria-label="Open world map" className="block h-full bg-ocean pt-10">
              <WorldMap compact states={map.states} routes={map.routes} cities={map.cities} className="h-full min-h-[260px]" />
            </Link>
          </section>
        </StaggerItem>

        <StaggerItem className="md:col-span-1 lg:col-span-4">
          <Panel title="Up next" icon={CalendarClock} action={<Link href="/itinerary" className="text-sm font-medium text-accent hover:underline">Itinerary</Link>} className="h-full">
            {upcomingDays.length ? (
              <ol className="relative flex flex-col gap-4 before:absolute before:bottom-2 before:left-[19px] before:top-2 before:w-px before:bg-border">
                {upcomingDays.map(({ day, country, city, stops, bookings }) => (
                  <li key={day.id} className="relative flex gap-3">
                    <Link href={`/itinerary?country=${day.trip_country_id}&day=${day.id}`} className="relative z-10 flex size-10 shrink-0 flex-col items-center justify-center rounded-xl bg-surface ring-1 ring-border hover:ring-accent">
                      <span className="text-[10px] uppercase leading-none text-muted">{fmtDate(day.date, "MMM")}</span>
                      <span className="num font-display text-base font-semibold leading-tight">{fmtDate(day.date, "dd")}</span>
                    </Link>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {country?.flag} {day.title ?? city?.name ?? `Day ${day.day_number}`}
                        {day.date === todayIso() && <span className="ml-2 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">Today</span>}
                      </p>
                      <ul className="mt-1 flex flex-col gap-0.5">
                        {bookings.map((b) => {
                          const Icon = BOOKING_TYPE_META[b.type as keyof typeof BOOKING_TYPE_META]?.icon ?? Plane;
                          return (
                            <li key={b.id} className="flex items-center gap-1.5 truncate text-xs text-muted">
                              <Icon className="size-3 text-accent" /> {b.start_at?.slice(11, 16)} {b.title}
                            </li>
                          );
                        })}
                        {stops.slice(0, 3).map((s) => {
                          const Icon = STOP_TYPE_META[s.type as StopType]?.icon ?? MapPin;
                          return (
                            <li key={s.id} className={cn("flex items-center gap-1.5 truncate text-xs text-muted", s.done && "line-through opacity-70")}>
                              <Icon className="size-3" /> {fmtTime(s.start_time)} {s.title}
                            </li>
                          );
                        })}
                        {stops.length > 3 && <li className="text-xs text-muted">+{stops.length - 3} more</li>}
                        {!stops.length && !bookings.length && <li className="text-xs text-muted">Nothing planned yet</li>}
                      </ul>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="text-sm text-muted">
                No upcoming days.{" "}
                <Link href="/itinerary" className="font-medium text-accent hover:underline">
                  Generate days
                </Link>{" "}
                from your country dates.
              </p>
            )}
          </Panel>
        </StaggerItem>

        <StaggerItem className="md:col-span-1 lg:col-span-5">
          <Panel title="Budget" icon={Wallet} action={<Link href="/budget" className="text-sm font-medium text-accent hover:underline">Details</Link>} className="h-full">
            <div className="grid grid-cols-[140px_1fr] items-center gap-4">
              <CategoryDonut
                height={140}
                currency={baseCurrency}
                data={budget.byCategory.map((c) => ({ category: c.category, value: c.actual }))}
                center={
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted">Spent</p>
                    <p className="num font-display text-base font-semibold">{formatMoney(budget.spent, baseCurrency, { compact: budget.spent >= 10000 })}</p>
                  </div>
                }
              />
              <div className="flex flex-col gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">Planned</span>
                  <span className="num font-medium">{money(budget.planned)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">Spent</span>
                  <span className="num font-medium">{money(budget.spent)}</span>
                </div>
                {budget.totalBudget > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted">Remaining</span>
                    <span className={cn("num font-medium", budget.remaining < 0 && "text-danger")}>{money(budget.remaining)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-muted">Left per day</span>
                  <span className="num font-semibold">{budget.remainingPerDay !== null ? money(budget.remainingPerDay) : "—"}</span>
                </div>
              </div>
            </div>
            <div className="mt-4 hidden sm:block">
              <DonutLegend currency={baseCurrency} data={budget.byCategory.map((c) => ({ category: c.category, value: c.actual })).sort((a, b) => b.value - a.value).slice(0, 4)} />
            </div>
          </Panel>
        </StaggerItem>

        <StaggerItem className="md:col-span-1 lg:col-span-4">
          <Panel title="Heads-up" icon={BellRing} className="h-full">
            {alerts.length ? (
              <ul className="flex flex-col gap-2">
                {alerts.slice(0, 5).map((a) => (
                  <li key={a.id}>
                    <Link href={a.href} className={cn("flex items-start gap-3 rounded-xl p-2.5 transition-colors", a.level === "danger" ? "bg-danger-soft hover:bg-danger/15" : a.level === "warning" ? "bg-planned-soft hover:bg-planned/25" : "bg-surface-2 hover:bg-ink/5")}>
                      {a.level === "info" ? <Info className="mt-0.5 size-4 shrink-0 text-wishlist" /> : <AlertTriangle className={cn("mt-0.5 size-4 shrink-0", a.level === "danger" ? "text-danger" : "text-[#b57a14] dark:text-planned")} />}
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">{a.title}</span>
                        <span className="block text-xs text-muted">{a.detail}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-sm text-muted">
                <span className="grid size-10 place-items-center rounded-full bg-visited-soft text-visited">✓</span>
                All clear — documents valid, dates set, budgets on track.
              </div>
            )}
          </Panel>
        </StaggerItem>

        <StaggerItem className="md:col-span-1 lg:col-span-3">
          {onThisDay.length ? (
            <Panel title="On this day" icon={History} className="h-full">
              <div className="flex flex-col gap-3">
                {onThisDay.slice(0, 2).map((m) => (
                  <div key={m.id}>
                    <p className="mb-1 text-xs font-medium text-accent">{new Date().getFullYear() - Number(m.date.slice(0, 4))} year(s) ago</p>
                    <MemoryMini m={m} />
                  </div>
                ))}
              </div>
            </Panel>
          ) : (
            <Panel title="Trip at a glance" icon={Plane} className="h-full">
              <dl className="flex flex-col gap-3 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted">Avg. per day</dt>
                  <dd className="num font-medium">{money(budget.avgPerDay)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Days remaining</dt>
                  <dd className="num font-medium">{budget.daysRemaining || "—"}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Total budget</dt>
                  <dd className="num font-medium">{budget.totalBudget ? money(budget.totalBudget) : "—"}</dd>
                </div>
              </dl>
              <p className="mt-auto pt-4 text-xs text-muted">Memories from this date in past years will show up here.</p>
            </Panel>
          )}
        </StaggerItem>

        <StaggerItem className="md:col-span-2 lg:col-span-12">
          <section aria-label="Recent memories">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-xl font-semibold">
                <Camera className="size-5 text-accent" /> Recent memories
              </h2>
              <Link href="/memories" className="flex shrink-0 items-center gap-1 whitespace-nowrap text-sm font-medium text-accent hover:underline">
                See all <ArrowRight className="size-4" />
              </Link>
            </div>
            {memories.length ? (
              <div className="grid gap-4 sm:grid-cols-3">
                {memories.map((m) => (
                  <MemoryMini key={m.id} m={m} />
                ))}
              </div>
            ) : (
              <EmptyState compact icon={Camera} title="No memories yet" description="Post a few lines and photos before, during and after the trip." action={<Button size="sm" onClick={() => ws.openQuickAdd("memory")}><Plus /> New memory</Button>} />
            )}
          </section>
        </StaggerItem>
      </Stagger>
    </PageTransition>
  );
}
