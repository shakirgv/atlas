import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getClimate, getForecast } from "@/lib/server/weather";
import { PreviewClient } from "./preview-client";

export const metadata: Metadata = { title: "Preview" };

/** Development-only gallery of feature states on fixtures, so UI can be checked without a database. */
export default async function PreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  // Goes through the real fetch and cache, so this also checks the live weather API.
  const [bangkok, reykjavik, tokyoForecast] = await Promise.all([getClimate(13.7563, 100.5018), getClimate(64.1466, -21.9426), getForecast(35.6762, 139.6503)]);
  return <PreviewClient liveClimate={{ bangkok, reykjavik }} liveForecast={tokyoForecast} />;
}
