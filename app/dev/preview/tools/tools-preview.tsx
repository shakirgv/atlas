"use client";
import { useMemo, useState } from "react";
import { COUNTRIES } from "@/lib/countries";
import type { ShiftData } from "@/lib/date-shift";
import type { CoverRow } from "@/actions/covers";
import { ClosingNotesCard, ClosingNotesDialog, ClosingPrompt } from "@/components/countries/closing-notes";
import { RoutePasteDialog } from "@/components/countries/route-paste-dialog";
import { ManageCoversDialog, type CoverBackend } from "@/components/cover/manage-covers-dialog";
import { DateShiftDialog } from "@/components/route/date-shift-dialog";
import { ShareDialog } from "@/components/share/share-dialog";
import { WorkspaceProvider, type Workspace } from "@/components/shell/workspace";
import { Button } from "@/components/ui/button";
import { ConfirmProvider } from "@/components/ui/confirm";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { CountryReview } from "@/lib/types";

const ID = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const flagOf = (code: string) => COUNTRIES.find((c) => c.cca2 === code)!.flag;
const nameOf = (code: string) => COUNTRIES.find((c) => c.cca2 === code)!.name;

const WORKSPACE: Workspace = {
  userId: "u",
  email: null,
  settings: null,
  baseCurrency: "USD",
  displayName: "",
  trips: [],
  activeTripId: "t",
  isAll: false,
  countries: [],
  cities: [],
  vault: { hasPin: false, unlocked: false, pinLength: null, lockedUntil: null },
  sharingEnabled: false,
};

const ROUTE_CODES = ["AL", "AZ", "GE", "GR", "TR", "JP", "IT", "ES"];
const ROUTE = ROUTE_CODES.map((code, order_index) => ({ id: ID(order_index + 1), trip_id: "t", code, name: nameOf(code), flag: flagOf(code), order_index }));
const WORLD = COUNTRIES.map((c, order_index) => ({ id: ID(1000 + order_index), trip_id: "world", code: c.cca2, name: c.name, flag: c.flag, order_index }));

const SHIFT: ShiftData = {
  trip: { id: "t", title: "World Tour 2037", start_date: "2037-05-01", end_date: "2037-06-30" },
  countries: [
    { id: "az", name: "Azerbaijan", flag: flagOf("AZ"), order_index: 0, status: "planned", arrive_date: "2037-05-01", depart_date: "2037-05-10" },
    { id: "ge", name: "Georgia", flag: flagOf("GE"), order_index: 1, status: "planned", arrive_date: "2037-05-10", depart_date: "2037-05-20" },
    { id: "tr", name: "Türkiye", flag: flagOf("TR"), order_index: 2, status: "planned", arrive_date: "2037-05-20", depart_date: "2037-06-05" },
    { id: "it", name: "Italy", flag: flagOf("IT"), order_index: 3, status: "visited", arrive_date: "2037-06-05", depart_date: "2037-06-10" },
    { id: "jp", name: "Japan", flag: flagOf("JP"), order_index: 4, status: "planned", arrive_date: null, depart_date: null },
  ],
  cities: [
    { id: "baku", trip_country_id: "az", name: "Baku", order_index: 0, arrive_date: "2037-05-01", depart_date: "2037-05-06" },
    { id: "sheki", trip_country_id: "az", name: "Sheki", order_index: 1, arrive_date: "2037-05-06", depart_date: "2037-05-10" },
    { id: "tbilisi", trip_country_id: "ge", name: "Tbilisi", order_index: 0, arrive_date: "2037-05-10", depart_date: "2037-05-16" },
    { id: "batumi", trip_country_id: "ge", name: "Batumi", order_index: 1, arrive_date: "2037-05-16", depart_date: "2037-05-20" },
    { id: "ist", trip_country_id: "tr", name: "Istanbul", order_index: 0, arrive_date: "2037-05-20", depart_date: "2037-05-27" },
  ],
  days: [
    { id: "d1", trip_country_id: "az", city_id: "sheki", day_number: 9, date: "2037-05-09", title: "Sheki palace", stops: 2 },
    { id: "d2", trip_country_id: "ge", city_id: "tbilisi", day_number: 1, date: "2037-05-11", title: "Old town", stops: 4 },
    { id: "d3", trip_country_id: "ge", city_id: "tbilisi", day_number: 2, date: "2037-05-12", title: null, stops: 2 },
    { id: "d4", trip_country_id: "tr", city_id: "ist", day_number: 1, date: "2037-05-21", title: "Hagia Sophia", stops: 3 },
  ],
  bookings: [
    { id: "b1", type: "flight", title: "Baku → Tbilisi, AZAL 73", status: "booked", trip_country_id: "ge", city_id: null, start_at: "2037-05-10T09:00:00+00:00", end_at: null },
    { id: "b2", type: "hotel", title: "Stamba Hotel", status: "booked", trip_country_id: "ge", city_id: "tbilisi", start_at: "2037-05-10T14:00:00+00:00", end_at: "2037-05-16T10:00:00+00:00" },
    { id: "b3", type: "hotel", title: "Sheki Saray", status: "booked", trip_country_id: "az", city_id: "sheki", start_at: "2037-05-06T14:00:00+00:00", end_at: "2037-05-10T10:00:00+00:00" },
    { id: "b4", type: "tour", title: "Bosphorus cruise", status: "pending", trip_country_id: "tr", city_id: "ist", start_at: "2037-05-24T17:00:00+00:00", end_at: null },
  ],
};

/** An SVG in place of a photo, so the gallery needs no storage. */
const art = (label: string, hue: number) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="960" height="640"><rect width="960" height="640" fill="hsl(${hue} 55% 45%)"/><text x="480" y="340" font-size="64" fill="white" text-anchor="middle" font-family="sans-serif">${label}</text></svg>`)}`;

const COVER_ROWS: { countries: CoverRow[]; cities: CoverRow[] } = {
  countries: ROUTE_CODES.map((code, i) => ({ id: ID(i + 1), kind: "country" as const, name: nameOf(code), flag: flagOf(code), group: "", countryId: ID(i + 1), url: i === 2 ? null : art(nameOf(code), i * 40), thumb: i === 2 ? null : art(nameOf(code), i * 40) })),
  cities: [
    { id: ID(101), kind: "city", name: "Baku", flag: flagOf("AZ"), group: "Azerbaijan", countryId: ID(2), url: art("Baku", 200), thumb: art("Baku", 200) },
    { id: ID(102), kind: "city", name: "Tbilisi", flag: flagOf("GE"), group: "Georgia", countryId: ID(3), url: null, thumb: null },
    { id: ID(103), kind: "city", name: "Bursa", flag: flagOf("TR"), group: "Türkiye", countryId: ID(5), url: null, thumb: null },
  ],
};

const REVIEW = {
  id: "r",
  user_id: "u",
  created_at: "",
  updated_at: "",
  trip_country_id: "az",
  best_experience: "Walking the old town of Sheki at dusk, then tea on the palace steps.",
  best_food: "Piti in Sheki",
  overpriced: "The Baku funicular tour",
  recommended_hotel: "Sheki Saray, for the courtyard",
  enough_days: 7,
  return_again: "yes",
  next_visit: ["Quba", "Lahij"],
  completed_at: "x",
  dismissed_at: null,
} satisfies CountryReview;

const PLACES = [
  { name: "Sheki Khan's Palace", status: "visited" },
  { name: "Quba", status: "want" },
  { name: "Lahij", status: "planned" },
];

/**
 * Fails the upload of a file named "fail-upload…" once and the save of "fail-save…" once. The attempts are
 * counted in `window.__coverCalls`, so a test can prove a saved row isn't sent again and a retry after a
 * failed save doesn't upload again.
 */
function fakeBackend(): CoverBackend {
  const seen = new Set<string>();
  const log = (what: string) => (((window as unknown as { __coverCalls: string[] }).__coverCalls ??= []).push(what));
  return {
    load: async () => {
      await new Promise((r) => setTimeout(r, 150));
      return COVER_ROWS;
    },
    upload: async (row, file) => {
      log(`upload:${row.name}`);
      await new Promise((r) => setTimeout(r, 400));
      if (file.name.startsWith("fail-upload") && !seen.has(file.name)) {
        seen.add(file.name);
        throw new Error("The connection dropped during the upload.");
      }
      return { path: `u/${row.kind}/${row.id}/${file.name}.webp`, thumb_path: null, width: 1, height: 1, taken_at: null, lat: null, lng: null };
    },
    save: async (row, meta) => {
      log(`save:${row.name}`);
      await new Promise((r) => setTimeout(r, 150));
      if (meta.path.includes("fail-save") && !seen.has(meta.path)) {
        seen.add(meta.path);
        throw new Error("The database didn't answer.");
      }
    },
    refresh: async () => void log("refresh"),
  };
}

type Tool = "reorder" | "reorder-world" | "shift" | "shift-undo" | "covers" | "closing" | "share" | null;

export function ToolsPreview({ initial }: { initial: string | null }) {
  const [tool, setTool] = useState<Tool>(initial as Tool);
  const [applied, setApplied] = useState<string>("");
  const backend = useMemo(() => fakeBackend(), []);
  const value = useMemo(() => ({ ...WORKSPACE, openQuickAdd: () => {}, openPalette: () => {} }), []);
  const close = (open: boolean) => {
    if (!open) setTool(null);
  };
  const apply = async (_trip: string, ids: string[]) => {
    await new Promise((r) => setTimeout(r, 100));
    setApplied(ids.join(","));
    return { ok: true as const, data: undefined };
  };
  return (
    <TooltipProvider>
      <ConfirmProvider>
        <WorkspaceProvider value={value}>
          <main className="mx-auto flex max-w-4xl flex-col gap-4 p-6">
            <h1 className="text-3xl font-semibold">Route tools</h1>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setTool("reorder")}>Reorder route</Button>
              <Button onClick={() => setTool("reorder-world")}>Reorder 250 countries</Button>
              <Button onClick={() => setTool("shift")}>Shift dates</Button>
              <Button onClick={() => setTool("shift-undo")}>Shift dates with undo</Button>
              <Button onClick={() => setTool("covers")}>Manage covers</Button>
              <Button onClick={() => setTool("closing")}>Closing notes</Button>
              <Button onClick={() => setTool("share")}>Share (off)</Button>
            </div>
            <p data-testid="applied" className="break-all text-xs text-muted">
              {applied}
            </p>
            <ClosingPrompt country={{ id: "preview-az", name: "Azerbaijan", flag: flagOf("AZ"), arrive_date: "2037-05-01", depart_date: "2037-05-10" }} places={PLACES} hotels={["Sheki Saray"]} />
            <ClosingNotesCard review={REVIEW} stayed={10} available onEdit={() => setTool("closing")} />
            <ClosingNotesCard review={null} stayed={10} available onEdit={() => setTool("closing")} />
            <ClosingNotesCard review={null} stayed={10} available={false} onEdit={() => {}} />
          </main>
          {tool === "reorder" && <RoutePasteDialog countries={ROUTE} trips={[{ id: "t", title: "World Tour" }]} initialTripId="t" onOpenChange={close} apply={apply} />}
          {tool === "reorder-world" && <RoutePasteDialog countries={WORLD} trips={[{ id: "world", title: "World" }]} initialTripId="world" onOpenChange={close} apply={apply} />}
          {tool === "shift" && <DateShiftDialog tripId="t" initialCountryId="az" initial={{ data: SHIFT, last: null }} onOpenChange={close} applyShift={async () => ({ ok: true, data: { id: "s", label: "+3 days from Azerbaijan", newDays: 3, countryId: "az" } })} undoShift={async () => ({ ok: true, data: { restored: 9, total: 11 } })} />}
          {tool === "shift-undo" && <DateShiftDialog tripId="t" initialCountryId="az" initial={{ data: SHIFT, last: { id: "s", label: "+3 days from Azerbaijan", created_at: "2037-05-02T10:00:00+00:00" } }} onOpenChange={close} undoShift={async () => ({ ok: true, data: { restored: 9, total: 11 } })} />}
          {tool === "covers" && <ManageCoversDialog tab="country" tripIds={["t"]} onOpenChange={close} backend={backend} />}
          {tool === "closing" && <ClosingNotesDialog country={{ id: "az", name: "Azerbaijan", flag: flagOf("AZ"), arrive_date: "2037-05-01", depart_date: "2037-05-10" }} review={null} places={PLACES} hotels={["Sheki Saray"]} onOpenChange={close} canDismiss />}
          {tool === "share" && <ShareDialog kind="memory" targetId={ID(1)} title="A memory" enabled={false} onOpenChange={close} />}
        </WorkspaceProvider>
      </ConfirmProvider>
    </TooltipProvider>
  );
}
