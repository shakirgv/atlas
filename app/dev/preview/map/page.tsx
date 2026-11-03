import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { MapPreview } from "./map-preview";

export const metadata: Metadata = { title: "Preview: world map" };

/** Development only: the World Map page inside the real shell, on fixtures, to check the layout without a database. */
export default function MapPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <MapPreview />;
}
