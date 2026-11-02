import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Scope } from "@/lib/scope";
import { countryAnchor, getCountry } from "@/lib/countries";
import { buildStops } from "@/lib/route";
import { displayStatus, strongerStatus } from "@/lib/status";
import type { City, GeoStatus, TripCountry } from "@/lib/types";
import type { MapCity, MapCountryState, RoutePoint } from "@/components/map/world-map";
import type { ExportTrip } from "@/components/map/export-dialog";

/** Map statuses use every trip (visited if any entry is visited); routes + cities follow the active scope. */
export async function loadMapData(supabase: ServerSupabase, scope: Scope) {
  const [{ data }, { data: cities }] = await Promise.all([supabase.from("trip_countries").select("*").order("order_index"), supabase.from("cities").select("*")]);
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
  const scopeTc = new Set(all.filter((t) => scope.tripIds.includes(t.trip_id)).map((t) => t.id));
  const cityRows: City[] = cities ?? [];
  const mapCities: MapCity[] = cityRows.filter((c) => scopeTc.has(c.trip_country_id) && c.lat != null && c.lng != null).map((c) => ({ id: c.id, name: c.name, lat: c.lat!, lng: c.lng! }));

  // Routes run stop by stop (so train and ferry legs between cities are drawn too). Only the first
  // stop of each country is numbered, which keeps the numbers in step with the route panel.
  const routeFor = (tid: string): RoutePoint[] => {
    const tcs = all
      .filter((t) => t.trip_id === tid && getCountry(t.country_code))
      .map((t) => {
        const c = getCountry(t.country_code)!;
        const [lat, lng] = countryAnchor(c.cca2) ?? c.latlng ?? [0, 0];
        return { ...t, code: c.cca2, name: c.name, lat, lng };
      });
    const seen = new Set<string>();
    const pts: RoutePoint[] = buildStops(tcs, cityRows)
      .filter((s) => s.lat != null && s.lng != null)
      .map((s) => {
        const minor = seen.has(s.tripCountryId);
        seen.add(s.tripCountryId);
        return { id: s.id, code: s.countryCode, lat: s.lat!, lng: s.lng!, name: s.name, mode: s.transport, note: s.transportNote, minor };
      });
    // The route starts at home when it is set (the first stop's mode means "from home").
    return home && pts.length ? [home, ...pts] : pts;
  };
  const routes: RoutePoint[][] = scope.tripIds.map(routeFor).filter((r) => r.length > 0);

  /** Everything the map export needs, per trip, whichever trip is active right now. */
  const exportTrips = (): ExportTrip[] =>
    scope.trips.map((t) => {
      const own = all.filter((c) => c.trip_id === t.id);
      const ids = new Set(own.map((c) => c.id));
      const route = routeFor(t.id);
      return {
        id: t.id,
        title: t.title,
        routes: route.length ? [route] : [],
        cities: cityRows.filter((c) => ids.has(c.trip_country_id) && c.lat != null && c.lng != null).map((c) => ({ id: c.id, name: c.name, lat: c.lat!, lng: c.lng! })),
        countries: own.map((c) => ({ code: c.country_code.trim(), status: c.status })),
      };
    });

  return { states, routes, cities: mapCities, inScopeIds: Object.fromEntries(inScopeIds) as Record<string, string>, exportTrips };
}
