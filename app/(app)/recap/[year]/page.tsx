import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadGraph } from "@/lib/data";
import { todayIso } from "@/lib/dates";
import { computeRecap, recapSlides, recapYears, type RecapPeriod } from "@/lib/recap";
import { getScope } from "@/lib/scope";
import { loadRecapInput } from "@/lib/server/recap";
import { RecapView } from "@/components/recap/recap-view";
import { RecapShareButton } from "@/components/share/share-button";

export const metadata: Metadata = { title: "Recap" };

export default async function RecapPage({ params }: PageProps<"/recap/[year]">) {
  const { year } = await params;
  if (year !== "all" && !/^\d{4}$/.test(year)) notFound();
  const period: RecapPeriod = year === "all" ? "all" : Number(year);
  const { supabase, scope } = await getScope();
  // A recap covers every trip, whichever one is active.
  const g = await loadGraph(supabase, scope.trips, scope.trips.map((t) => t.id), { places: true, expenses: true, memories: true });
  const input = await loadRecapInput(supabase, scope.settings, g, todayIso());
  const stats = computeRecap(input, period);
  return <RecapView stats={stats} slides={recapSlides(stats)} currency={scope.baseCurrency} years={recapYears(input)} share={<RecapShareButton stats={stats} />} />;
}
