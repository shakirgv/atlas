import { NextResponse } from "next/server";
import { apiUser } from "@/lib/server/api";
import { APP_NAME } from "@/lib/config";
import { getVaultState } from "@/lib/vault";
import { maskDocument } from "@/lib/vault-mask";
import type { DocumentRow } from "@/lib/types";

const TABLES = ["settings", "trips", "trip_countries", "cities", "places", "itinerary_days", "itinerary_items", "expenses", "memories", "documents", "photos", "bookings", "packing_items", "packing_templates", "country_info_overrides", "entry_requirements", "cash_wallets", "cash_transactions"] as const;

function csvCell(v: unknown) {
  if (v === null || v === undefined) return "";
  const s = Array.isArray(v) ? v.join("; ") : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** GET /api/export?format=json|csv — all your data (JSON) or expenses (CSV). */
export async function GET(req: Request) {
  const auth = await apiUser();
  if ("error" in auth) return auth.error;
  const { supabase } = auth;
  const format = new URL(req.url).searchParams.get("format") === "csv" ? "csv" : "json";
  const stamp = new Date().toISOString().slice(0, 10);

  if (format === "csv") {
    const [{ data: rows }, { data: trips }, { data: tcs }, { data: cities }] = await Promise.all([
      supabase.from("expenses").select("*").order("date"),
      supabase.from("trips").select("id, title"),
      supabase.from("trip_countries").select("id, country_code"),
      supabase.from("cities").select("id, name"),
    ]);
    const t = new Map((trips ?? []).map((x) => [x.id, x.title]));
    const c = new Map((tcs ?? []).map((x) => [x.id, x.country_code.trim()]));
    const ci = new Map((cities ?? []).map((x) => [x.id, x.name]));
    const header = ["date", "title", "category", "kind", "amount", "currency", "fx_rate", "amount_base", "trip", "country", "city", "notes"];
    const lines = [header.join(",")].concat(
      (rows ?? []).map((r) =>
        [r.date, r.title, r.category, r.kind, r.amount, r.currency, r.fx_rate, r.amount_base, t.get(r.trip_id), r.trip_country_id ? c.get(r.trip_country_id) : "", r.city_id ? ci.get(r.city_id) : "", r.notes].map(csvCell).join(","),
      ),
    );
    return new NextResponse(lines.join("\n"), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${APP_NAME.toLowerCase()}-expenses-${stamp}.csv"` },
    });
  }

  const out: Record<string, unknown> = { app: APP_NAME, version: 1, exported_at: new Date().toISOString() };
  for (const table of TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    out[table] = error ? [] : (data ?? []);
  }
  // A locked vault stays locked in the export: unlock first to include those details.
  const vault = await getVaultState();
  out.documents = (out.documents as DocumentRow[]).map((d) => maskDocument(d, vault));
  return new NextResponse(JSON.stringify(out, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="${APP_NAME.toLowerCase()}-export-${stamp}.json"` },
  });
}
