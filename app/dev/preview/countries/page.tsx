import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CountriesPreview, type CountriesPreviewProps } from "./countries-preview";

export const metadata: Metadata = { title: "Preview: countries" };

type Params = { show?: string; tab?: string; entry?: string; expiry?: string; rule?: string };

/** Development-only: the Countries list, a country's tabs, Edit details and the closing form, on fixtures. */
export default async function CountriesPreviewPage({ searchParams }: { searchParams: Promise<Params> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { show, tab, entry, expiry, rule } = await searchParams;
  const view: CountriesPreviewProps["view"] = show === "detail" || show === "edit" || show === "closing" ? show : "list";
  return <CountriesPreview view={view} tab={tab ?? "overview"} entry={entry === "visa_free" ? "visa_free" : "evisa"} expiry={expiry ?? null} rule={rule ?? null} />;
}
