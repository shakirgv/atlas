"use client";
import { useTransition } from "react";
import { Check, ChevronsUpDown, Globe2, Plane, Plus } from "lucide-react";
import { toast } from "sonner";
import { setActiveTrip } from "@/actions/workspace";
import { ALL_TRIPS } from "@/lib/config";
import { fmtRange } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useWorkspace } from "./workspace";

export function TripSwitcher({ collapsed }: { collapsed?: boolean }) {
  const ws = useWorkspace();
  const [pending, start] = useTransition();
  const active = ws.trips.find((t) => t.id === ws.activeTripId);
  const label = ws.isAll || !active ? "All trips" : active.title;

  const choose = (v: string) =>
    start(async () => {
      const res = await setActiveTrip(v);
      if (!res.ok) toast.error(res.error);
    });

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "group flex w-full items-center gap-2.5 rounded-xl border border-border bg-surface p-2 text-left shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors hover:bg-surface-2",
          collapsed && "justify-center p-1.5",
          pending && "opacity-60",
        )}
        aria-label="Switch trip"
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-accent">
          {ws.isAll || !active ? <Globe2 className="size-4" /> : <Plane className="size-4" />}
        </span>
        {!collapsed && (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] font-medium uppercase tracking-wider text-muted">Trip</span>
              <span className="truncate text-sm font-medium">{label}</span>
            </span>
            <ChevronsUpDown className="size-4 shrink-0 text-muted" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Show data for</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => choose(ALL_TRIPS)}>
          <Globe2 />
          <span className="flex-1">All trips</span>
          {ws.isAll && <Check className="!text-accent" />}
        </DropdownMenuItem>
        {ws.trips.length > 0 && <DropdownMenuSeparator />}
        {ws.trips.map((t) => (
          <DropdownMenuItem key={t.id} onSelect={() => choose(t.id)}>
            <Plane />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate">{t.title}</span>
              <span className="text-xs text-muted">{fmtRange(t.start_date, t.end_date)}</span>
            </span>
            {!ws.isAll && ws.activeTripId === t.id && <Check className="!text-accent" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => ws.openQuickAdd("trip")}>
          <Plus />
          New trip
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
