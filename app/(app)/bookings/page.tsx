import type { Metadata } from "next";
import { getScope } from "@/lib/scope";
import { loadGraph } from "@/lib/data";
import { BookingsView } from "@/components/bookings/bookings-view";

export const metadata: Metadata = { title: "Bookings" };

export default async function BookingsPage() {
  const { supabase, scope } = await getScope();
  const g = await loadGraph(supabase, scope.trips, scope.tripIds, { bookings: true, documents: true });
  const { error } = await supabase.from("bookings").select("id", { head: true, count: "exact" }).limit(1);
  return (
    <BookingsView
      bookings={g.bookings}
      countries={g.countries.map((c) => ({ id: c.id, name: c.name, flag: c.flag }))}
      cities={g.cities.map((c) => ({ id: c.id, name: c.name }))}
      documents={g.documents.map((d) => ({ id: d.id, title: d.title }))}
      missingTable={Boolean(error)}
    />
  );
}
