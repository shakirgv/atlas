import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { parseFilters } from "@/lib/memory-filters";
import { MemoriesPreview } from "./memories-preview";

export const metadata: Metadata = { title: "Preview: memories" };

/** Development only: the Memories page on fixtures. Add ?tab=gallery or ?tab=map, filters such as ?tag=food, or ?show=new / ?show=edit. */
export default async function MemoriesPreviewPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const show = sp.show === "new" || sp.show === "edit" ? sp.show : null;
  return <MemoriesPreview tab={typeof sp.tab === "string" ? sp.tab : "timeline"} filters={parseFilters(sp)} show={show} />;
}
