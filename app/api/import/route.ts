import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError, apiUser } from "@/lib/server/api";

type Row = Record<string, unknown> & { id?: string };

const fileSchema = z.object({
  version: z.number().optional(),
  trips: z.array(z.record(z.string(), z.unknown())).default([]),
  trip_countries: z.array(z.record(z.string(), z.unknown())).default([]),
  cities: z.array(z.record(z.string(), z.unknown())).default([]),
  places: z.array(z.record(z.string(), z.unknown())).default([]),
  itinerary_days: z.array(z.record(z.string(), z.unknown())).default([]),
  itinerary_items: z.array(z.record(z.string(), z.unknown())).default([]),
  expenses: z.array(z.record(z.string(), z.unknown())).default([]),
  memories: z.array(z.record(z.string(), z.unknown())).default([]),
  documents: z.array(z.record(z.string(), z.unknown())).default([]),
  bookings: z.array(z.record(z.string(), z.unknown())).default([]),
  packing_items: z.array(z.record(z.string(), z.unknown())).default([]),
  packing_templates: z.array(z.record(z.string(), z.unknown())).default([]),
});

const STRIP = ["id", "user_id", "created_at"];

/**
 * POST /api/import — import a JSON export as NEW rows (ids are remapped, nothing is overwritten).
 * Photos and document files are not included in exports, so covers and attachments are skipped.
 */
export async function POST(req: Request) {
  const auth = await apiUser();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;
  try {
    const text = await req.text();
    if (text.length > 20 * 1024 * 1024) throw new Error("File is too large (max 20 MB).");
    const data = fileSchema.parse(JSON.parse(text));
    const map = new Map<string, string>();
    const remap = (v: unknown) => (typeof v === "string" ? (map.get(v) ?? null) : null);

    const insert = async (table: string, rows: Row[], fks: Record<string, boolean>, extra?: (r: Row) => Row) => {
      let count = 0;
      for (const r of rows) {
        const clean: Row = {};
        for (const [k, v] of Object.entries(r)) if (!STRIP.includes(k)) clean[k] = v;
        clean.cover_path = clean.cover_path === undefined ? undefined : null;
        if ("file_path" in clean) clean.file_path = null;
        let skip = false;
        for (const [fk, required] of Object.entries(fks)) {
          const id = remap(r[fk]);
          if (!id && required) skip = true;
          clean[fk] = id;
        }
        if (skip) continue;
        const row = extra ? extra(clean) : clean;
        Object.keys(row).forEach((k) => row[k] === undefined && delete row[k]);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- generic table insert from a validated export file
        const { data: ins, error } = await (supabase.from(table as any) as any).insert(row).select("id").single();
        if (error) throw new Error(`${table}: ${error.message}`);
        if (r.id) map.set(String(r.id), (ins as { id: string }).id);
        count++;
      }
      return count;
    };

    const counts = {
      trips: await insert("trips", data.trips, {}, (r) => ({ ...r, is_sample: false })),
      countries: await insert("trip_countries", data.trip_countries, { trip_id: true }),
      cities: await insert("cities", data.cities, { trip_country_id: true }),
      places: await insert("places", data.places, { city_id: true }),
      days: await insert("itinerary_days", data.itinerary_days, { trip_country_id: true, city_id: false }),
      stops: await insert("itinerary_items", data.itinerary_items, { day_id: true, place_id: false }),
      expenses: await insert("expenses", data.expenses, { trip_id: true, trip_country_id: false, city_id: false }),
      memories: await insert("memories", data.memories, { trip_id: true, trip_country_id: false, city_id: false, place_id: false }),
      documents: await insert("documents", data.documents, { trip_id: false, trip_country_id: false }, (r) => ({ ...r, is_sample: false, file_name: null, mime_type: null, size_bytes: null })),
      bookings: 0,
      packing: 0,
    };
    try {
      counts.bookings = await insert("bookings", data.bookings, { trip_id: true, trip_country_id: false, city_id: false, document_id: false });
      counts.packing = await insert("packing_items", data.packing_items, { trip_id: true });
      await insert("packing_templates", data.packing_templates, {});
    } catch {
      // Phase 2 tables may be missing (002_extras.sql not applied).
    }
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, counts });
  } catch (e) {
    return apiError(e instanceof SyntaxError ? new Error("That file is not valid JSON.") : e);
  }
}
