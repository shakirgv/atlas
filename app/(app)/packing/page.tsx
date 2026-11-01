import type { Metadata } from "next";
import { getScope } from "@/lib/scope";
import { PackingView } from "@/components/packing/packing-view";

export const metadata: Metadata = { title: "Packing" };

export default async function PackingPage({ searchParams }: PageProps<"/packing">) {
  const sp = await searchParams;
  const { supabase, scope } = await getScope();
  const requested = typeof sp.trip === "string" ? sp.trip : null;
  const trip = scope.trips.find((t) => t.id === requested) ?? scope.activeTrip ?? scope.trips[0] ?? null;
  const [items, templates] = trip
    ? await Promise.all([
        supabase.from("packing_items").select("*").eq("trip_id", trip.id).order("order_index"),
        supabase.from("packing_templates").select("*").order("created_at", { ascending: false }),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  return (
    <PackingView
      trip={trip ? { id: trip.id, title: trip.title } : null}
      trips={scope.trips.map((t) => ({ id: t.id, title: t.title }))}
      items={items.data ?? []}
      templates={(templates.data ?? []).map((t) => ({ id: t.id, name: t.name, items: (Array.isArray(t.items) ? t.items : []) as { label: string; category: string }[] }))}
      missingTable={Boolean(items.error)}
    />
  );
}
