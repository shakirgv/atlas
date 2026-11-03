"use client";
import { useEffect, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { BookOpenCheck, CircleCheck, CircleDashed, CircleX, Pencil, Plus, Search, X } from "lucide-react";
import { toast } from "sonner";
import { dismissCountryReview, saveCountryReview } from "@/actions/country-reviews";
import { nextVisitGroups, placesLeft, reviewHasContent } from "@/lib/closing-notes";
import { matchesName } from "@/lib/normalize-name";
import { daysBetween } from "@/lib/dates";
import type { CountryReview, ReturnAgain } from "@/lib/types";
import { pluralize } from "@/lib/utils";
import { countryReviewSchema, type z } from "@/lib/validation";
import { SectionTitle } from "@/components/common/page-header";
import { ChoiceChips, SubmitButton } from "@/components/forms/form-bits";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/misc";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";

type In = z.input<typeof countryReviewSchema>;
type Out = z.output<typeof countryReviewSchema>;

/** Only what the form needs to know about the country. */
export type ClosingCountry = { id: string; name: string; flag: string; arrive_date: string | null; depart_date: string | null };
export type ClosingPlace = { name: string; status: string; city_name?: string | null };

const RETURN_OPTIONS = [
  { value: "yes" as const, label: "Yes", icon: CircleCheck, color: "var(--visited)" },
  { value: "maybe" as const, label: "Maybe", icon: CircleDashed, color: "var(--planned)" },
  { value: "no" as const, label: "No", icon: CircleX, color: "var(--danger)" },
];
const RETURN_LABEL: Record<ReturnAgain, string> = { yes: "Yes, I'd come back", maybe: "Maybe", no: "Once was enough" };

/** Long lists stay manageable: search narrows them, ticks show what's in, and a name nobody saved can be added from the same box. */
function NextVisit({ value, onChange, places }: { value: string[]; onChange: (v: string[]) => void; places: ClosingPlace[] }) {
  const [query, setQuery] = useState("");
  const typed = query.trim();
  const groups = nextVisitGroups(places, value);
  const shown = groups.map((g) => ({ ...g, places: g.places.filter((name) => matchesName(name, typed)) })).filter((g) => g.places.length > 0);
  const known = groups.some((g) => g.places.some((name) => name.toLowerCase() === typed.toLowerCase()));
  const toggle = (name: string, on: boolean) => onChange(on ? [...value, name] : value.filter((v) => v !== name));
  const add = () => {
    if (!typed) return;
    const existing = groups.flatMap((g) => g.places).find((name) => name.toLowerCase() === typed.toLowerCase());
    if (!existing) onChange([...value, typed]);
    else if (!value.includes(existing)) onChange([...value, existing]);
    setQuery("");
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <Input
          value={query}
          aria-label="Search places, or add one for next time"
          placeholder="Search or add a place"
          className="pl-9"
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
        />
      </div>
      {typed && !known && (
        <Button variant="secondary" size="sm" className="self-start" onClick={add}>
          <Plus /> <span className="max-w-56 truncate">Add {typed}</span>
        </Button>
      )}
      {shown.length > 0 && (
        <div className="max-h-56 overflow-y-auto rounded-xl border border-border" data-testid="next-visit-list">
          {shown.map((g) => (
            <div key={g.name} role="group" aria-label={g.name}>
              <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-border bg-surface-2 px-3 py-1.5 text-xs font-medium text-muted">
                <span className="truncate">{g.name}</span>
                <span className="num shrink-0">
                  {g.places.filter((name) => value.includes(name)).length} of {g.places.length}
                </span>
              </div>
              <ul>
                {g.places.map((name) => (
                  <li key={name}>
                    <label className="flex min-h-10 cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm hover:bg-ink/[0.03]">
                      <Checkbox checked={value.includes(name)} onCheckedChange={(on) => toggle(name, on === true)} />
                      <span className="min-w-0 break-words">{name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {!shown.length && !typed && <p className="text-xs text-muted">Nothing saved here is left to see. Type a place above to add one.</p>}
      {value.length > 0 && <p className="num text-xs text-muted">{pluralize(value.length, "place")} selected</p>}
    </div>
  );
}

/** The short form for leaving a country. Every field is optional: a few honest lines beat a complete form. */
export function ClosingNotesDialog({
  country,
  review,
  places,
  hotels,
  onOpenChange,
  canDismiss,
}: {
  country: ClosingCountry;
  review: CountryReview | null;
  places: ClosingPlace[];
  hotels: string[];
  onOpenChange: (open: boolean) => void;
  /** Asked unprompted: closing the form can also mean "stop asking". */
  canDismiss?: boolean;
}) {
  const [pending, start] = useTransition();
  const [dismissing, startDismiss] = useTransition();
  const offered = placesLeft(places);
  const stayed = daysBetween(country.arrive_date, country.depart_date);
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(countryReviewSchema),
    defaultValues: {
      best_experience: review?.best_experience ?? "",
      best_food: review?.best_food ?? "",
      overpriced: review?.overpriced ?? "",
      recommended_hotel: review?.recommended_hotel ?? "",
      enough_days: review?.enough_days ?? "",
      return_again: (review?.return_again ?? "") as In["return_again"],
      next_visit: review?.completed_at ? review.next_visit : offered,
    },
  });
  const { register, handleSubmit, control, formState } = form;
  const onSubmit = handleSubmit((v) =>
    start(async () => {
      const res = await saveCountryReview(country.id, v);
      if (!res.ok) return void toast.error(res.error);
      toast.success(`Saved your notes on ${country.name}`);
      onOpenChange(false);
    }),
  );
  const notNow = () =>
    startDismiss(async () => {
      const res = await dismissCountryReview(country.id);
      if (!res.ok) return void toast.error(res.error);
      onOpenChange(false);
    });

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title={`Closing ${country.name} ${country.flag}`}
      description="A minute now is worth more than any star rating when you look back in a few years. Skip what doesn't apply."
      className="max-w-xl"
      footer={
        <>
          {canDismiss ? (
            <Button variant="ghost" onClick={notNow} disabled={dismissing} className="sm:mr-auto">
              Not now
            </Button>
          ) : (
            <Button variant="secondary" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
          )}
          <SubmitButton form="closing-form" pending={pending}>
            Save notes
          </SubmitButton>
        </>
      }
    >
      <form id="closing-form" noValidate onSubmit={onSubmit} className="flex flex-col gap-4 pb-2" data-testid="closing-form">
        <Field label="Best experience" htmlFor="cn-best">
          <Textarea id="cn-best" className="min-h-16" placeholder="What you'd tell a friend first" {...register("best_experience")} />
        </Field>
        <Field label="Best food" htmlFor="cn-food">
          <Input id="cn-food" placeholder="The dish, and where" {...register("best_food")} />
        </Field>
        <Field label="Not worth what you paid" htmlFor="cn-over">
          <Input id="cn-over" placeholder="An activity you'd skip next time" {...register("overpriced")} />
        </Field>
        <Field label="Hotel you'd recommend" htmlFor="cn-hotel">
          <Input id="cn-hotel" list="cn-hotels" placeholder="Name and why" {...register("recommended_hotel")} />
          {hotels.length > 0 && (
            <datalist id="cn-hotels">
              {hotels.map((h) => (
                <option key={h} value={h} />
              ))}
            </datalist>
          )}
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="How many days would have been enough?" htmlFor="cn-days" error={formState.errors.enough_days?.message} hint={stayed ? `You stayed ${pluralize(stayed, "day")}.` : undefined}>
            <Input id="cn-days" type="number" inputMode="numeric" min={1} className="num" {...register("enough_days")} />
          </Field>
          <Field label="Would you come back?">
            <Controller control={control} name="return_again" render={({ field }) => <ChoiceChips name="Would you come back?" value={(field.value ?? "") as ReturnAgain} onChange={(v) => field.onChange(field.value === v ? "" : v)} options={RETURN_OPTIONS} />} />
          </Field>
        </div>
        <Field label="Places left for next time" hint={offered.length ? "Places you saved here and didn't get to. Untick any you won't need." : undefined}>
          <Controller control={control} name="next_visit" render={({ field }) => <NextVisit value={field.value ?? []} onChange={field.onChange} places={places} />} />
        </Field>
      </form>
    </ResponsiveDialog>
  );
}

function Note({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5 first:pt-0 last:pb-0">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-wrap break-words text-sm">{children}</dd>
    </div>
  );
}

/** What I wrote when I left, on the country's page. */
export function ClosingNotesCard({ review, stayed, available, onEdit }: { review: CountryReview | null; stayed: number; available: boolean; onEdit: () => void }) {
  if (!available) {
    return (
      <section className="card p-5" aria-label="Closing notes">
        <SectionTitle>Closing notes</SectionTitle>
        <p className="text-sm text-muted">Closing notes need one more SQL step: run supabase/migrations/005_route_tools.sql in the Supabase SQL editor.</p>
      </section>
    );
  }
  const written = reviewHasContent(review);
  return (
    <section className="card p-5" aria-label="Closing notes" data-testid="closing-card">
      <SectionTitle
        action={
          <Button size="sm" variant={written ? "ghost" : "secondary"} onClick={onEdit}>
            {written ? <Pencil /> : <BookOpenCheck />} {written ? "Edit" : "Write"}
          </Button>
        }
      >
        Closing notes
      </SectionTitle>
      {!written || !review ? (
        <p className="text-sm text-muted">The best of it, what wasn&apos;t worth it, and what&apos;s left for next time. Short notes now are what you&apos;ll want in a few years.</p>
      ) : (
        <dl className="flex flex-col divide-y divide-border">
          {review.best_experience && <Note label="Best experience">{review.best_experience}</Note>}
          {review.best_food && <Note label="Best food">{review.best_food}</Note>}
          {review.overpriced && <Note label="Not worth what I paid">{review.overpriced}</Note>}
          {review.recommended_hotel && <Note label="Hotel I'd recommend">{review.recommended_hotel}</Note>}
          {review.enough_days && (
            <Note label="Days that would have been enough">
              {pluralize(review.enough_days, "day")}
              {stayed ? <span className="text-muted"> (stayed {stayed})</span> : null}
            </Note>
          )}
          {review.return_again && <Note label="Come back?">{RETURN_LABEL[review.return_again as ReturnAgain] ?? review.return_again}</Note>}
          {review.next_visit.length > 0 && <Note label="Left for next time">{review.next_visit.join(", ")}</Note>}
        </dl>
      )}
    </section>
  );
}

const askedKey = (id: string) => `atlas:closing-asked:${id}`;

/** On the dashboard after leaving a country. The form opens by itself once per country on this device, then this stays until answered. */
export function ClosingPrompt({ country, places, hotels }: { country: ClosingCountry; places: ClosingPlace[]; hotels: string[] }) {
  const [open, setOpen] = useState(false);
  const [, startDismiss] = useTransition();
  const [gone, setGone] = useState(false);
  useEffect(() => {
    let asked = true;
    try {
      asked = localStorage.getItem(askedKey(country.id)) === "1";
      localStorage.setItem(askedKey(country.id), "1");
    } catch {}
    if (asked) return;
    const t = setTimeout(() => setOpen(true), 0);
    return () => clearTimeout(t);
  }, [country.id]);
  if (gone) return null;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 text-sm shadow-[var(--shadow-card)]" data-testid="closing-prompt">
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent-soft text-lg leading-none">{country.flag}</span>
        <p className="min-w-0 flex-1 basis-48">You left {country.name}. A minute of closing notes now, while it&apos;s fresh?</p>
        <div className="flex items-center gap-1.5">
          <Button size="sm" onClick={() => setOpen(true)}>
            Write notes
          </Button>
          <Button
            size="icon-sm"
            variant="ghost"
            aria-label={`Don't ask about ${country.name} again`}
            onClick={() => {
              setGone(true);
              startDismiss(async () => {
                const res = await dismissCountryReview(country.id);
                if (!res.ok) {
                  setGone(false);
                  toast.error(res.error);
                }
              });
            }}
          >
            <X />
          </Button>
        </div>
      </div>
      {open && <ClosingNotesDialog country={country} review={null} places={places} hotels={hotels} onOpenChange={setOpen} canDismiss />}
    </>
  );
}
