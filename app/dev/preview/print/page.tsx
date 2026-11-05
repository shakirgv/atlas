import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parsePrint } from "@/lib/print-itinerary";
import { PrintPreview } from "./print-preview";

export const metadata: Metadata = { title: "Preview: printable itinerary" };

/** Development only: the printable itinerary on fixtures. Takes the same address as the real page (?scope=, ?country=, ?city=, ?from=, ?to=, ?notes=0 …). */
export default async function PrintPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { selection, options } = parsePrint(await searchParams);
  return <PrintPreview selection={selection} options={options} />;
}
