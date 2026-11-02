import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getScope } from "@/lib/scope";
import { PrintCountryCard } from "@/components/countries/print-country-card";

export const metadata: Metadata = { title: "Country card" };

export default async function CountryCardPage({ params }: PageProps<"/countries/[id]/card">) {
  const { id } = await params;
  const { supabase } = await getScope();
  const { data: tc } = await supabase.from("trip_countries").select("country_code").eq("id", id).maybeSingle();
  if (!tc) notFound();
  const code = tc.country_code.trim();
  const { data: override } = await supabase.from("country_info_overrides").select("*").eq("country_code", code).maybeSingle();
  return <PrintCountryCard code={code} countryId={id} override={override} />;
}
