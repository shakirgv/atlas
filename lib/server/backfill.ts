import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { tzForCoords } from "@/lib/server/tz-lookup";

/**
 * Fill `cities.timezone` for every city that has coordinates but no zone (idempotent: rows that
 * already have a zone are never touched, so manual edits win). Returns the number of rows updated.
 */
export async function fillMissingTimezones(supabase: ServerSupabase, limit = 500): Promise<number> {
  const { data, error } = await supabase.from("cities").select("id, lat, lng").is("timezone", null).not("lat", "is", null).not("lng", "is", null).limit(limit);
  if (error || !data?.length) return 0;
  let n = 0;
  await Promise.all(
    data.map(async (c) => {
      const tz = tzForCoords(c.lat, c.lng);
      if (!tz) return;
      const { error: e } = await supabase.from("cities").update({ timezone: tz }).eq("id", c.id).is("timezone", null);
      if (!e) n++;
    }),
  );
  return n;
}
