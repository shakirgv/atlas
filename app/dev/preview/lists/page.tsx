import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ListsPreview } from "./lists-preview";

export const metadata: Metadata = { title: "Preview: closed lists" };

/** Development-only: the Cities countries and the Itinerary days that open on click, on fixtures. */
export default async function ListsPreviewPage({ searchParams }: { searchParams: Promise<{ view?: string; day?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { view, day } = await searchParams;
  return <ListsPreview view={view === "itinerary" ? "itinerary" : "cities"} initialDayId={day ?? null} />;
}
