"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Database, Download, FileJson, House, LockKeyhole, LogOut, Monitor, Moon, Palette, Sparkles, Sun, Trash2, Upload, User } from "lucide-react";
import { toast } from "sonner";
import { signOut } from "@/actions/auth";
import { deleteSampleData, loadSampleData } from "@/actions/sample";
import { updateSettings } from "@/actions/settings";
import { APP_NAME } from "@/lib/config";
import { CURRENCIES } from "@/lib/money";
import type { Settings } from "@/lib/types";
import { settingsSchema, type z } from "@/lib/validation";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/motion";
import { SubmitButton } from "@/components/forms/form-bits";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { HomeSection } from "./home-section";
import { SecuritySection } from "./security-section";

type In = z.input<typeof settingsSchema>;
type Out = z.output<typeof settingsSchema>;

function Section({ id, icon: Icon, title, description, children }: { id?: string; icon: typeof User; title: string; description: string; children: React.ReactNode }) {
  return (
    <section id={id} className="card grid gap-5 p-5 sm:p-6 md:grid-cols-[260px_1fr]">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-semibold">
          <Icon className="size-5 text-accent" /> {title}
        </h2>
        <p className="mt-1 text-sm text-muted">{description}</p>
      </div>
      <div className="flex flex-col gap-4">{children}</div>
    </section>
  );
}

export function SettingsView({ settings, email, hasSample, mfaEnabled, hasPin }: { settings: Settings | null; email: string | null; hasSample: boolean; mfaEnabled: boolean; hasPin: boolean }) {
  const router = useRouter();
  const confirm = useConfirm();
  const { setTheme } = useTheme();
  const [pending, start] = useTransition();
  const [sampleBusy, startSample] = useTransition();
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(settingsSchema),
    values: { display_name: settings?.display_name ?? "", base_currency: settings?.base_currency ?? "USD", theme: (settings?.theme as Out["theme"]) ?? "system" },
  });
  const { register, handleSubmit, watch, setValue, formState } = form;
  const theme = watch("theme");

  const onSubmit = handleSubmit((v) =>
    start(async () => {
      const baseChanged = settings && v.base_currency !== settings.base_currency;
      if (baseChanged && !(await confirm({ title: `Switch base currency to ${v.base_currency}?`, description: "All expenses are converted to the new base currency with today's rates.", confirmLabel: "Switch currency", destructive: false }))) return;
      const res = await updateSettings(v);
      if (!res.ok) return void toast.error(res.error);
      setTheme(v.theme);
      toast.success("Settings saved");
    }),
  );

  const doImport = async (file: File) => {
    setImporting(true);
    try {
      const res = await fetch("/api/import", { method: "POST", body: await file.text(), headers: { "Content-Type": "application/json" } });
      const json = (await res.json()) as { ok?: boolean; error?: string; counts?: Record<string, number> };
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Import failed");
      toast.success("Import complete", { description: `${json.counts?.trips ?? 0} trips, ${json.counts?.countries ?? 0} countries, ${json.counts?.expenses ?? 0} expenses` });
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  return (
    <PageTransition className="flex flex-col gap-5">
      <PageHeader eyebrow="Account" title="Settings" description={email ? `Signed in as ${email}` : undefined} />
      <form onSubmit={onSubmit} className="contents">
        <Section icon={User} title="Profile" description="How Atlas greets you, and the currency used for every total.">
          <Field label="Display name" htmlFor="s-name" error={formState.errors.display_name?.message}>
            <Input id="s-name" {...register("display_name")} placeholder="Your name" />
          </Field>
          <Field label="Base currency" htmlFor="s-cur" hint="Budgets, charts and totals are shown in this currency.">
            <NativeSelect id="s-cur" {...register("base_currency")}>
              {CURRENCIES.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </NativeSelect>
          </Field>
        </Section>
        <Section icon={Palette} title="Appearance" description="Dark mode is first-class. System follows your device.">
          <div role="radiogroup" aria-label="Theme" className="grid grid-cols-3 gap-2">
            {[
              { v: "system" as const, label: "System", icon: Monitor },
              { v: "light" as const, label: "Light", icon: Sun },
              { v: "dark" as const, label: "Dark", icon: Moon },
            ].map((o) => (
              <button
                key={o.v}
                type="button"
                role="radio"
                aria-checked={theme === o.v}
                onClick={() => {
                  setValue("theme", o.v);
                  setTheme(o.v);
                }}
                className={cn("flex h-20 flex-col items-center justify-center gap-2 rounded-xl border text-sm font-medium transition-colors", theme === o.v ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2")}
              >
                <o.icon className="size-5" /> {o.label}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <SubmitButton pending={pending}>Save settings</SubmitButton>
          </div>
        </Section>
      </form>

      <Section id="home" icon={House} title="Home & passport" description="Unlocks jet lag (first leg from home), the home-time clock and visa checks for your passport.">
        <HomeSection settings={settings} />
      </Section>

      <Section id="security" icon={LockKeyhole} title="Security" description="Protects your data even if your password leaks or your phone is unlocked.">
        <SecuritySection mfaEnabled={mfaEnabled} hasPin={hasPin} timeout={settings?.lock_timeout_minutes ?? 5} />
      </Section>

      <Section icon={Download} title="Export & import" description="Your data, portable. JSON includes everything except photo and document files.">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" asChild>
            <a href="/api/export?format=json">
              <FileJson /> Export all (JSON)
            </a>
          </Button>
          <Button variant="secondary" asChild>
            <a href="/api/export?format=csv">
              <Download /> Expenses (CSV)
            </a>
          </Button>
          <Button variant="secondary" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload /> {importing ? "Importing…" : "Import JSON"}
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ""; }} />
        </div>
        <p className="text-xs text-muted">Import adds everything as new items — nothing is overwritten.</p>
      </Section>

      <Section id="sample" icon={Database} title="Sample data" description="A ready-made trip — Türkiye, Italy and Japan — to explore every screen.">
        <div className="flex flex-wrap gap-2">
          <Button
            disabled={hasSample || sampleBusy}
            onClick={() =>
              startSample(async () => {
                const res = await loadSampleData();
                if (!res.ok) return void toast.error(res.error);
                toast.success("Sample trip loaded", { description: "Covers are fetched in the background." });
                router.push(`/trips/${res.data.tripId}`);
                // Fill covers for the sample entities.
                void fetch(`/api/cover/sample`, { method: "POST" }).then(() => router.refresh()).catch(() => {});
              })
            }
          >
            <Sparkles /> {hasSample ? "Sample data loaded" : "Load sample data"}
          </Button>
          <Button
            variant="ghost"
            className="text-danger hover:bg-danger-soft"
            disabled={!hasSample || sampleBusy}
            onClick={async () => {
              if (!(await confirm({ title: "Delete sample data?", description: "Removes the sample trip and its documents. Your own data is untouched.", confirmLabel: "Delete sample data" }))) return;
              startSample(async () => {
                const res = await deleteSampleData();
                if (!res.ok) return void toast.error(res.error);
                toast.success("Sample data deleted");
              });
            }}
          >
            <Trash2 /> Delete sample data
          </Button>
        </div>
      </Section>

      <Section icon={LogOut} title="Session" description={`${APP_NAME} is a private, single-account app. Sign-ups are disabled.`}>
        <form action={signOut}>
          <Button type="submit" variant="secondary">
            <LogOut /> Sign out
          </Button>
        </form>
      </Section>
    </PageTransition>
  );
}
