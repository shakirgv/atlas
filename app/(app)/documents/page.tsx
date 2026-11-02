import type { Metadata } from "next";
import { getScope } from "@/lib/scope";
import { loadGraph } from "@/lib/data";
import { passportWarnings } from "@/lib/alerts";
import { todayIso } from "@/lib/dates";
import { entryOverview, latestPassportExpiry } from "@/lib/entry";
import { getVaultState } from "@/lib/vault";
import { DocumentsView } from "@/components/documents/documents-view";

export const metadata: Metadata = { title: "Documents" };

export default async function DocumentsPage({ searchParams }: PageProps<"/documents">) {
  const sp = await searchParams;
  const { supabase, scope } = await getScope();
  const g = await loadGraph(supabase, scope.trips, scope.tripIds, { documents: true, entries: true });
  // Documents not tied to a trip (passport, ID) always show; trip documents follow the trip filter.
  const docs = g.documents.filter((d) => !d.trip_id || scope.tripIds.includes(d.trip_id));
  return (
    <DocumentsView
      documents={docs}
      vault={await getVaultState()}
      warnings={passportWarnings(g.documents, scope.trips)}
      trips={scope.trips.map((t) => ({ id: t.id, title: t.title }))}
      countries={g.countries.map((c) => ({ id: c.id, name: c.name, flag: c.flag }))}
      openId={typeof sp.open === "string" ? sp.open : null}
      initialTab={sp.tab === "entry" ? "entry" : "documents"}
      entryRows={entryOverview(g.countries, g.entries, { today: todayIso(), passportExpiry: latestPassportExpiry(g.documents) })}
      showTrip={scope.isAll}
    />
  );
}
