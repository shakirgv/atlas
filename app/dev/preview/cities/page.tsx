import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CitiesPreview } from "./cities-preview";

export const metadata: Metadata = { title: "Preview: cities" };

/** Development only: the Cities list, a city's page and Edit details, on fixtures. Add ?show=detail or ?show=edit, and ?view=list or ?view=map. */
export default async function CitiesPreviewPage({ searchParams }: { searchParams: Promise<{ show?: string; few?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { show, few } = await searchParams;
  return <CitiesPreview show={show === "detail" || show === "edit" ? show : "list"} few={few === "1"} />;
}
