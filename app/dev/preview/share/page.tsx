import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicShareView } from "@/components/share/public-view";
import { buildMemoryView, buildTripView, shareConfigSchema } from "@/lib/share";

export const metadata: Metadata = { title: "Preview: shared page", robots: { index: false, follow: false } };

const photo = (id: string, entity_id = "m1", caption: string | null = null) => ({ id, entity_id, width: 800, height: 600, caption, lat: 41.890251, lng: 12.492373 });

/** Development only: the visitor's page on fixtures. `?kind=trip` and `?exact=1` show the other states. */
export default async function SharePreviewPage({ searchParams }: PageProps<"/dev/preview/share">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const config = shareConfigSchema.parse({ exact_locations: sp.exact === "1", include_itinerary: sp.kind === "trip" });
  const city = { id: "rome", trip_country_id: "it", name: "Rome", lat: 41.890251, lng: 12.492373 };
  const view =
    sp.kind === "trip"
      ? buildTripView({
          trip: { title: "Three Countries", description: "Istanbul's bazaars, Roman evenings and Kyoto's temples.", start_date: "2026-05-01", end_date: "2026-05-30" },
          countries: [
            { id: "it", code: "IT", name: "Italy", flag: "🇮🇹", arrive_date: "2026-05-01", depart_date: "2026-05-10" },
            { id: "jp", code: "JP", name: "Japan", flag: "🇯🇵", arrive_date: "2026-05-11", depart_date: "2026-05-30" },
          ],
          cities: [city, { id: "tyo", trip_country_id: "jp", name: "Tokyo", lat: 35.6762, lng: 139.6503 }],
          memories: [{ id: "m1", date: "2026-05-02", title: "Lost in Monti", body: "No map, just **ivy walls** and tiny wine bars.", trip_country_id: "it", city_id: "rome" }],
          photos: [photo("p1"), photo("p2")],
          days: [{ id: "d1", trip_country_id: "jp", title: "Arrival in Tokyo", day_number: 1, date: "2026-05-11" }],
          items: [{ day_id: "d1", title: "Shibuya Crossing", start_time: "18:00:00" }],
          cover: null,
          config,
        })
      : buildMemoryView({
          memory: { id: "m1", date: "2026-05-02", title: "Lost in Monti", body: "No map, just **ivy walls**, tiny wine bars and a cat that followed us for three streets." },
          city,
          place: { name: "Via Urbana", lat: 41.8964, lng: 12.4951 },
          country: { code: "IT", name: "Italy" },
          photos: [photo("p1", "m1", "Ivy"), photo("p2"), photo("p3")],
          config,
        });
  return <PublicShareView view={view} base="/dev/preview/share" />;
}
