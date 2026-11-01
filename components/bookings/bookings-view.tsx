"use client";
import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { ArrowRight, MoreHorizontal, Paperclip, Pencil, Plus, Ticket, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteBooking } from "@/actions/bookings";
import type { Booking, BookingType } from "@/lib/types";
import { BOOKING_TYPE_META } from "@/lib/icons";
import { fmtDate, todayIso } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { cn, pluralize } from "@/lib/utils";
import { EmptyState } from "@/components/common/empty-state";
import { MigrationNotice } from "@/components/common/migration-notice";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition, Stagger, StaggerItem } from "@/components/common/motion";
import { BookingDialog } from "@/components/forms/booking-dialog";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { FilterChip } from "@/components/ui/misc";
import { useWorkspace } from "@/components/shell/workspace";

const STATUS_STYLE: Record<string, string> = {
  booked: "bg-visited-soft text-ink",
  pending: "bg-planned-soft text-ink",
  cancelled: "bg-danger-soft text-danger line-through",
};

export function BookingsView({
  bookings,
  countries,
  cities,
  documents,
  missingTable,
}: {
  bookings: Booking[];
  countries: { id: string; name: string; flag: string }[];
  cities: { id: string; name: string }[];
  documents: { id: string; title: string }[];
  missingTable: boolean;
}) {
  const ws = useWorkspace();
  const confirm = useConfirm();
  const [dialog, setDialog] = useState<{ booking: Booking | null } | null>(null);
  const [filter, setFilter] = useState<"upcoming" | "past" | "all">("upcoming");
  const [, start] = useTransition();
  const today = todayIso();

  const filtered = useMemo(
    () =>
      bookings
        .filter((b) => {
          const d = (b.end_at ?? b.start_at ?? "").slice(0, 10);
          if (filter === "all" || !d) return true;
          return filter === "upcoming" ? d >= today : d < today;
        })
        .sort((a, b) => (a.start_at ?? "9999").localeCompare(b.start_at ?? "9999") * (filter === "past" ? -1 : 1)),
    [bookings, filter, today],
  );
  const groups = useMemo(() => {
    const m = new Map<string, Booking[]>();
    for (const b of filtered) {
      const k = b.start_at?.slice(0, 10) ?? "No date";
      m.set(k, [...(m.get(k) ?? []), b]);
    }
    return Array.from(m.entries());
  }, [filtered]);

  if (missingTable) {
    return (
      <PageTransition>
        <PageHeader eyebrow="Plan" title="Bookings" />
        <MigrationNotice />
      </PageTransition>
    );
  }

  return (
    <PageTransition className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Plan"
        title="Bookings"
        description={bookings.length ? `${pluralize(bookings.length, "booking")} · shown in the itinerary on their dates` : "Flights, trains and stays — with confirmation numbers at hand."}
        actions={
          <Button onClick={() => setDialog({ booking: null })}>
            <Plus /> Add booking
          </Button>
        }
      />
      {!bookings.length ? (
        <EmptyState icon={Ticket} title="No bookings yet" description="Add flights, trains and hotels. They appear on the right day in your itinerary, and can be added as expenses in one tap." action={<Button onClick={() => setDialog({ booking: null })}><Plus /> Add your first booking</Button>} />
      ) : (
        <>
          <div className="flex gap-2">
            {(["upcoming", "past", "all"] as const).map((f) => (
              <FilterChip key={f} active={filter === f} onClick={() => setFilter(f)}>
                {f[0]!.toUpperCase() + f.slice(1)}
              </FilterChip>
            ))}
          </div>
          {!filtered.length ? (
            <EmptyState compact icon={Ticket} title={`No ${filter} bookings`} />
          ) : (
            <div className="flex flex-col gap-8">
              {groups.map(([day, list]) => (
                <section key={day} aria-label={day}>
                  <h2 className="mb-3 flex items-baseline gap-3 text-xl font-semibold">
                    {day === "No date" ? day : fmtDate(day, "EEEE, dd MMM yyyy")}
                    {day === today && <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">TODAY</span>}
                  </h2>
                  <Stagger className="grid gap-3 md:grid-cols-2">
                    {list.map((b) => {
                      const meta = BOOKING_TYPE_META[b.type as BookingType] ?? BOOKING_TYPE_META.other;
                      const country = countries.find((c) => c.id === b.trip_country_id);
                      const city = cities.find((c) => c.id === b.city_id);
                      const doc = documents.find((d) => d.id === b.document_id);
                      return (
                        <StaggerItem key={b.id}>
                          <div className="card flex h-full flex-col gap-3 p-4 sm:p-5">
                            <div className="flex items-start gap-3">
                              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-wishlist-soft">
                                <meta.icon className="size-5 text-wishlist" />
                              </span>
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-medium uppercase tracking-wider text-muted">{meta.label}</p>
                                <h3 className="truncate font-display text-lg font-semibold">{b.title}</h3>
                              </div>
                              <span className={cn("rounded-full px-2 py-1 text-[11px] font-medium capitalize", STATUS_STYLE[b.status])}>{b.status}</span>
                              <DropdownMenu>
                                <DropdownMenuTrigger className="grid size-8 place-items-center rounded-lg text-muted hover:bg-ink/5" aria-label="Booking actions">
                                  <MoreHorizontal className="size-4" />
                                </DropdownMenuTrigger>
                                <DropdownMenuContent>
                                  <DropdownMenuItem onSelect={() => setDialog({ booking: b })}>
                                    <Pencil /> Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    destructive
                                    onSelect={async () => {
                                      if (!(await confirm({ title: `Delete “${b.title}”?`, confirmLabel: "Delete booking" }))) return;
                                      start(async () => {
                                        const res = await deleteBooking(b.id);
                                        if (!res.ok) toast.error(res.error);
                                        else toast.success("Booking deleted");
                                      });
                                    }}
                                  >
                                    <Trash2 /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                            {(b.from_label || b.to_label) && (
                              <div className="flex items-center gap-3 rounded-xl bg-surface-2 px-3 py-2.5">
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-display text-xl font-semibold">{b.from_label ?? "—"}</p>
                                  <p className="num text-xs text-muted">{b.start_at ? `${fmtDate(b.start_at.slice(0, 10), "dd MMM")} · ${b.start_at.slice(11, 16)}` : ""}</p>
                                </div>
                                <ArrowRight className="size-4 shrink-0 text-accent" />
                                <div className="min-w-0 flex-1 text-right">
                                  <p className="truncate font-display text-xl font-semibold">{b.to_label ?? "—"}</p>
                                  <p className="num text-xs text-muted">{b.end_at ? `${fmtDate(b.end_at.slice(0, 10), "dd MMM")} · ${b.end_at.slice(11, 16)}` : ""}</p>
                                </div>
                              </div>
                            )}
                            <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                              {b.confirmation_no && (
                                <span className="font-mono text-[13px]">
                                  <span className="text-muted">Ref </span>
                                  {b.confirmation_no}
                                </span>
                              )}
                              {b.cost != null && <span className="num text-muted">{formatMoney(Number(b.cost), b.currency ?? ws.baseCurrency)}</span>}
                              {(country || city) && <span className="text-muted">{[country ? `${country.flag} ${country.name}` : null, city?.name].filter(Boolean).join(" · ")}</span>}
                              {doc && (
                                <Link href={`/documents?open=${doc.id}`} className="inline-flex items-center gap-1 text-accent hover:underline">
                                  <Paperclip className="size-3.5" /> {doc.title}
                                </Link>
                              )}
                            </div>
                          </div>
                        </StaggerItem>
                      );
                    })}
                  </Stagger>
                </section>
              ))}
            </div>
          )}
        </>
      )}
      {dialog && <BookingDialog open onOpenChange={(o) => !o && setDialog(null)} booking={dialog.booking} documents={documents} />}
    </PageTransition>
  );
}
