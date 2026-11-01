import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { apiError, apiUser } from "@/lib/server/api";

/** POST /api/packing/copy?from=&to= — copy a packing list between trips (unpacked, no duplicates). */
export async function POST(req: Request) {
  const auth = await apiUser();
  if ("error" in auth) return auth.error;
  try {
    const sp = new URL(req.url).searchParams;
    const from = z.uuid().parse(sp.get("from"));
    const to = z.uuid().parse(sp.get("to"));
    const { supabase } = auth;
    const [{ data: src }, { data: dst }] = await Promise.all([
      supabase.from("packing_items").select("label, category, order_index").eq("trip_id", from).order("order_index"),
      supabase.from("packing_items").select("label, order_index").eq("trip_id", to),
    ]);
    const have = new Set((dst ?? []).map((d) => d.label.toLowerCase()));
    let next = (dst ?? []).reduce((m, d) => Math.max(m, d.order_index), -1) + 1;
    const rows = (src ?? []).filter((s) => !have.has(s.label.toLowerCase())).map((s) => ({ trip_id: to, label: s.label, category: s.category, packed: false, order_index: next++ }));
    if (rows.length) {
      const { error } = await supabase.from("packing_items").insert(rows);
      if (error) throw new Error(error.message);
    }
    revalidatePath("/", "layout");
    return NextResponse.json({ ok: true, copied: rows.length });
  } catch (e) {
    return apiError(e);
  }
}
