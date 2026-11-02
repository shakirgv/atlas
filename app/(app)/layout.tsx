import { cookies } from "next/headers";
import { AppShell } from "@/components/shell/app-shell";
import { SetupRequired } from "@/components/common/setup-required";
import { isSupabaseConfigured } from "@/lib/config";
import { getScope } from "@/lib/scope";
import { countryFlag, countryName } from "@/lib/countries";
import type { CityOption, CountryOption } from "@/lib/types";
import { fillMissingTimezones } from "@/lib/server/backfill";
import { getVaultState } from "@/lib/vault";
import { isSharingEnabled } from "@/lib/supabase/admin";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  if (!isSupabaseConfigured) return <SetupRequired />;
  const { supabase, scope } = await getScope();
  const cookieStore = await cookies();
  // One-time (idempotent) backfill: cities created before time zones existed get one from tz-lookup.
  await fillMissingTimezones(supabase).catch(() => 0);

  const { data: tcs } = scope.tripIds.length
    ? await supabase.from("trip_countries").select("id, trip_id, country_code, order_index, arrive_date, depart_date, status").in("trip_id", scope.tripIds).order("order_index")
    : { data: [] };
  const tcIds = (tcs ?? []).map((t) => t.id);
  const { data: cities } = tcIds.length
    ? await supabase.from("cities").select("id, trip_country_id, name, lat, lng, order_index").in("trip_country_id", tcIds).order("order_index")
    : { data: [] };

  const tripOrder = new Map(scope.trips.map((t, i) => [t.id, i]));
  const countries: CountryOption[] = (tcs ?? [])
    .map((t) => ({ ...t, country_code: t.country_code.trim(), name: countryName(t.country_code.trim()), flag: countryFlag(t.country_code.trim()) }))
    .sort((a, b) => (tripOrder.get(a.trip_id) ?? 0) - (tripOrder.get(b.trip_id) ?? 0) || a.order_index - b.order_index);
  const codeById = new Map(countries.map((c) => [c.id, c.country_code]));
  const cityOptions: CityOption[] = (cities ?? [])
    .map((c) => ({ id: c.id, trip_country_id: c.trip_country_id, name: c.name, lat: c.lat, lng: c.lng, country_code: codeById.get(c.trip_country_id) ?? "" }))
    .sort((a, b) => countries.findIndex((x) => x.id === a.trip_country_id) - countries.findIndex((x) => x.id === b.trip_country_id));

  return (
    <AppShell
      sidebarCollapsed={cookieStore.get("sidebar")?.value === "collapsed"}
      workspace={{
        userId: scope.userId,
        email: scope.email,
        settings: scope.settings,
        baseCurrency: scope.baseCurrency,
        displayName: scope.settings?.display_name ?? "",
        trips: scope.trips.map((t) => ({ id: t.id, title: t.title, status: t.status, start_date: t.start_date, end_date: t.end_date, is_sample: t.is_sample })),
        activeTripId: scope.activeTrip?.id ?? null,
        isAll: scope.isAll,
        countries,
        cities: cityOptions,
        vault: await getVaultState(),
        sharingEnabled: isSharingEnabled(),
      }}
    >
      {children}
    </AppShell>
  );
}
