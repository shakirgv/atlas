import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ToolsPreview } from "./tools-preview";

export const metadata: Metadata = { title: "Preview: route tools" };

/** Development-only: reorder route, shift dates, manage covers and closing notes on fixtures. */
export default async function ToolsPreviewPage({ searchParams }: { searchParams: Promise<{ open?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { open } = await searchParams;
  return <ToolsPreview initial={open ?? null} />;
}
