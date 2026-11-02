import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Scope } from "@/lib/scope";
import { countryAnchor, getCountry } from "@/lib/countries";
import { displayStatus, strongerStatus } from "@/lib/status";
import type { GeoStatus, TripCountry } from "@/lib/types";
import type { MapCity, MapCountryState, RoutePoint } from "@/components/map/world-map";

/** Map statuses use every trip (visited if any entry is visited); routes + cities follow the active scope. */
export async function loadMapData(supabase: ServerSupabase, scope: Scope) {
  const { data } = await supabase.from("trip_countries").select("*").order("order_index");
  const all = (data ?? []) as TripCountry[];
  const tripTitle = new Map(scope.trips.map((t) => [t.id, t.title]));
  const states: Record<string, MapCountryState> = {};
  for (const tc of all) {
    const code = tc.country_code.trim();
    const prev = states[code];
    const status = strongerStatus(prev?.status, tc.status as GeoStatus);
    const display = displayStatus(tc.status, tc.arrive_date, tc.depart_date);
    const inScope = scope.tripIds.includes(tc.trip_id);
    const useThis = !prev || (inScope && !scope.tripIds.includes(all.find((x) => x.id === prev.tripCountryId)?.trip_id ?? "")) || status !== prev.status;
    states[code] = {
      status,
      display: display === "ongoing" || prev?.display === "ongoing" ? "ongoing" : status,
      tripCountryId: useThis ? tc.id : prev!.tripCountryId,
      arrive: useThis ? tc.arrive_date : prev!.arrive,
      depart: useThis ? tc.depart_date : prev!.depart,
      tripTitle: useThis ? tripTitle.get(tc.trip_id) : prev!.tripTitle,
    };
  }
  // Only entries in the active scope are "in trip" for click navigation.
  const inScopeIds = new Map(all.filter((t) => scope.tripIds.includes(t.trip_id)).map((t) => [t.country_code.trim(), t.id]));

  const st = scope.settings;
  const home: RoutePoint | null =
    st?.home_lat != null && st?.home_lng != null ? { id: "home", code: "", lat: st.home_lat, lng: st.home_lng, name: st.home_city ?? "Home", home: true } : null;
  const routes: RoutePoint[][] = scope.tripIds
    .map((tid) => {
      const pts = all
        .filter((t) => t.trip_id === tid)
        .sort((a, b) => a.order_index - b.order_index)
        .map((t) => {
          const c = getCountry(t.country_code);
          const [lat, lng] = countryAnchor(c?.cca2) ?? c?.latlng ?? [0, 0];
          return c ? { id: t.id, code: c.cca2, lat, lng, name: c.name, mode: t.transport_mode, note: t.transport_note } : null;
        })
        .filter((p): p is NonNullable<typeof p> => Boolean(p)) as RoutePoint[];
      // The route starts at home when it is set (the first stop's mode means "from home").
      return home && pts.length ? [home, ...pts] : pts;
    })
    .filter((r) => r.length > 0);

  const scopeTc = all.filter((t) => scope.tripIds.includes(t.trip_id)).map((t) => t.id);
  const { data: cities } = scopeTc.length
    ? await supabase.from("cities").select("id, name, lat, lng").in("trip_country_id", scopeTc)
    : { data: [] as { id: string; name: string; lat: number | null; lng: number | null }[] };
  const mapCities: MapCity[] = (cities ?? []).filter((c) => c.lat != null && c.lng != null).map((c) => ({ id: c.id, name: c.name, lat: c.lat!, lng: c.lng! }));

  return { states, routes, cities: mapCities, inScopeIds: Object.fromEntries(inScopeIds) as Record<string, string> };
}
