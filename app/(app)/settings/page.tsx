import type { Metadata } from "next";
import { getScope } from "@/lib/scope";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { scope } = await getScope();
  return <SettingsView settings={scope.settings} email={scope.email} hasSample={scope.trips.some((t) => t.is_sample)} />;
}
