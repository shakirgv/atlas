"use client";
import * as React from "react";
import type { CityOption, CountryOption, Settings, TripOption } from "@/lib/types";
import type { VaultState } from "@/lib/vault-mask";

export type QuickAddKind = "trip" | "country" | "city" | "place" | "expense" | "memory" | "document" | "booking";

export type QuickAddRequest = {
  kind: QuickAddKind;
  /** Optional pre-selection, e.g. a trip-country id or city id. */
  tripId?: string;
  tripCountryId?: string;
  cityId?: string;
};

export type Workspace = {
  userId: string;
  email: string | null;
  settings: Settings | null;
  baseCurrency: string;
  displayName: string;
  trips: TripOption[];
  activeTripId: string | null;
  isAll: boolean;
  countries: CountryOption[];
  cities: CityOption[];
  vault: VaultState;
  sharingEnabled: boolean;
};

type Ctx = Workspace & {
  openQuickAdd: (req: QuickAddRequest | QuickAddKind) => void;
  openPalette: () => void;
};

const WorkspaceContext = React.createContext<Ctx | null>(null);

export function WorkspaceProvider({ value, children }: { value: Ctx; children: React.ReactNode }) {
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const ctx = React.useContext(WorkspaceContext);
  if (!ctx) throw new Error("useWorkspace must be used inside the app shell");
  return ctx;
}

/** Trip to use for new items: active trip, or the first trip when "All trips" is selected. */
export function useDefaultTripId() {
  const ws = useWorkspace();
  return ws.activeTripId ?? ws.trips[0]?.id ?? null;
}
