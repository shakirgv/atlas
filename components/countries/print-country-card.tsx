"use client";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { APP_NAME } from "@/lib/config";
import { getCountry } from "@/lib/countries";
import { mergeCountryInfo, tapWaterLabel, type InfoOverride } from "@/lib/country-info";
import { Button } from "@/components/ui/button";

function Fact({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="print-break">
      <dt className="text-[11px] uppercase tracking-wider text-[#61656e]">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm">{value}</dd>
    </div>
  );
}

/** One-page card: stays on a single A4 sheet, so long free text is clamped when printed. */
export function PrintCountryCard({ code, countryId, override }: { code: string; countryId: string; override: InfoOverride }) {
  const info = getCountry(code);
  const m = mergeCountryInfo(code, override);
  const numbers = [
    { label: "General", value: m.emergency_general.value },
    { label: "Police", value: m.emergency_police.value },
    { label: "Ambulance", value: m.emergency_ambulance.value },
    { label: "Fire", value: m.emergency_fire.value },
  ].filter((n) => n.value);
  const embassy = [m.embassy_name.value, m.embassy_phone.value, m.embassy_address.value, m.embassy_url.value].filter(Boolean).join("\n");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-2">
        <Button variant="ghost" asChild>
          <Link href={`/countries/${countryId}?tab=essentials`}>
            <ArrowLeft /> Back to Essentials
          </Link>
        </Button>
        <Button onClick={() => window.print()}>
          <Printer /> Print / Save as PDF
        </Button>
      </div>
      <article data-testid="country-card" className="rounded-[16px] bg-white p-8 text-[#15181E] shadow-card print:p-0 print:shadow-none sm:p-12">
        <header className="flex items-center gap-4 border-b-2 border-[#15181E] pb-4">
          <span className="text-[56px] leading-none">{info?.flag}</span>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.2em] text-[#61656e]">{APP_NAME} · Country card</p>
            <h1 className="mt-1 text-[40px] font-semibold leading-none">{info?.name ?? code}</h1>
          </div>
        </header>

        <section className="mt-5" aria-label="Emergency numbers">
          <h2 className="text-[11px] uppercase tracking-wider text-[#61656e]">Emergency</h2>
          {numbers.length ? (
            <ul className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {numbers.map((n) => (
                <li key={n.label} className="rounded-xl border-2 border-[#15181E] px-3 py-2">
                  <p className="text-xs text-[#61656e]">{n.label}</p>
                  <p className="num font-display text-[34px] font-semibold leading-none">{n.value}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-[#61656e]">No numbers saved. Check before you travel.</p>
          )}
        </section>

        <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-[#E7E1D6] pt-5 sm:grid-cols-3">
          <Fact label="Plug types" value={m.plugs.value?.join(", ")} />
          <Fact label="Voltage" value={[m.voltage.value, m.frequency.value].filter(Boolean).join(" · ")} />
          <Fact label="Driving side" value={m.driving ? `Drive on the ${m.driving}` : null} />
          <Fact label="Calling code" value={info?.idd} />
          <Fact label="Currency" value={info?.currencies.map((c) => c.code).join(", ")} />
          <Fact label="Tap water" value={tapWaterLabel(m.tap_water.value)} />
          <Fact label="Languages" value={info?.languages.slice(0, 4).join(", ")} />
        </dl>

        <dl className="mt-5 grid gap-4 border-t border-[#E7E1D6] pt-5 sm:grid-cols-2 print:grid-cols-2">
          <Fact label="Embassy" value={embassy || null} />
          <Fact label="Tipping" value={m.tipping.value} />
        </dl>

        {m.notes.value && (
          <section className="mt-5 border-t border-[#E7E1D6] pt-5" aria-label="Notes">
            <h2 className="text-[11px] uppercase tracking-wider text-[#61656e]">Notes</h2>
            <p className="mt-1 whitespace-pre-wrap break-words text-sm print:line-clamp-[16]">{m.notes.value}</p>
          </section>
        )}

        <p className="mt-5 text-[11px] text-[#61656e]">General information, verify before you travel.</p>
      </article>
    </div>
  );
}
