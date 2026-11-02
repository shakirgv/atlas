import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Compass } from "lucide-react";
import { signOut } from "@/actions/auth";
import { SetupRequired } from "@/components/common/setup-required";
import { APP_NAME, isSupabaseConfigured } from "@/lib/config";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/utils";
import { MfaForm } from "./mfa-form";

export const metadata: Metadata = { title: "Two-factor code" };

export default async function MfaPage({ searchParams }: PageProps<"/login/mfa">) {
  if (!isSupabaseConfigured) return <SetupRequired />;
  const sp = await searchParams;
  const next = safeNextPath(typeof sp.next === "string" ? sp.next : null);
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  // Nothing to do here without a factor, or once this session has passed it.
  if (aal?.nextLevel !== "aal2" || aal.currentLevel === "aal2") redirect(next);
  return (
    <main className="grid min-h-dvh place-items-center px-6 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-10 flex items-center gap-2.5">
          <div className="grid size-9 place-items-center rounded-xl bg-ink text-bg">
            <Compass className="size-5" />
          </div>
          <span className="font-display text-xl font-semibold">{APP_NAME}</span>
        </div>
        <h1 className="text-[32px] font-semibold">Enter your code</h1>
        <p className="mt-1.5 text-muted">Open your authenticator app and type the 6-digit code.</p>
        <MfaForm next={next} />
        <form action={signOut} className="mt-6 text-center">
          <button type="submit" className="min-h-11 text-sm font-medium text-muted hover:text-ink">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
