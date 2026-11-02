import type { Metadata } from "next";
import { getScope } from "@/lib/scope";
import { getVaultState } from "@/lib/vault";
import { isSharingEnabled } from "@/lib/supabase/admin";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { supabase, scope } = await getScope();
  const [{ data: factors }, vault] = await Promise.all([supabase.auth.mfa.listFactors(), getVaultState()]);
  return <SettingsView settings={scope.settings} email={scope.email} hasSample={scope.trips.some((t) => t.is_sample)} mfaEnabled={Boolean(factors?.totp.length)} hasPin={vault.hasPin} sharingEnabled={isSharingEnabled()} />;
}
