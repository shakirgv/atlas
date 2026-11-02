import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PrintCountryCard } from "@/components/countries/print-country-card";

export const metadata: Metadata = { title: "Preview: country card" };

const LONG_NOTES = Array.from({ length: 60 }, (_, i) => `Note line ${i + 1}: buy a Suica card at the airport, carry cash for small restaurants.`).join("\n");

/** Development only: `?long=1` fills every free-text field, to prove the card still fits one A4 page. */
export default async function CardPreviewPage({ searchParams }: PageProps<"/dev/preview/card">) {
  if (process.env.NODE_ENV === "production") notFound();
  const sp = await searchParams;
  const long = sp.long === "1";
  return (
    <main className="p-4 sm:p-8 print:p-0">
      <PrintCountryCard
        code="JP"
        countryId="preview"
        override={{
          embassy_name: "Embassy of the Republic of Azerbaijan in Japan",
          embassy_phone: "+81 3 0000 0000",
          embassy_address: "1-2-3 Example, Minato City, Tokyo",
          embassy_url: "https://example.org",
          tipping: long ? "Not customary in Japan. ".repeat(10) : undefined,
          notes: long ? LONG_NOTES : "Carry cash for small restaurants. Buy a Suica card at the airport.",
        }}
      />
    </main>
  );
}
