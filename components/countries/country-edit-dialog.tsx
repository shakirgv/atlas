"use client";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CircleCheck, CircleDashed, Heart } from "lucide-react";
import { updateTripCountry } from "@/actions/countries";
import { tripCountrySchema, type z } from "@/lib/validation";
import type { TripCountry } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ChoiceChips, SubmitButton } from "@/components/forms/form-bits";
import { TransportField } from "@/components/route/transport-field";

type In = z.input<typeof tripCountrySchema>;
type Out = z.output<typeof tripCountrySchema>;

export const GEO_STATUS_OPTIONS = [
  { value: "wishlist" as const, label: "Wishlist", icon: Heart, color: "var(--wishlist)" },
  { value: "planned" as const, label: "Planned", icon: CircleDashed, color: "var(--planned)" },
  { value: "visited" as const, label: "Visited", icon: CircleCheck, color: "var(--visited)" },
];

export function CountryEditDialog({ open, onOpenChange, country, name, baseCurrency, onSaved }: { open: boolean; onOpenChange: (o: boolean) => void; country: TripCountry; name: string; baseCurrency: string; onSaved?: (status: Out["status"]) => void }) {
  const [pending, start] = useTransition();
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(tripCountrySchema),
    values: {
      status: country.status as Out["status"],
      arrive_date: country.arrive_date ?? "",
      depart_date: country.depart_date ?? "",
      budget: country.budget ?? "",
      notes: country.notes ?? "",
      transport_mode: (country.transport_mode ?? "") as In["transport_mode"],
      transport_note: country.transport_note ?? "",
    },
  });
  const { register, handleSubmit, control, formState } = form;
  const onSubmit = handleSubmit((v) =>
    start(async () => {
      const res = await updateTripCountry(country.id, v);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Saved");
      onOpenChange(false);
      onSaved?.(v.status);
    }),
  );
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit ${name}`}
      description="“Ongoing” is set automatically from the dates."
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SubmitButton form="country-form" pending={pending}>
            Save
          </SubmitButton>
        </>
      }
    >
      <form id="country-form" onSubmit={onSubmit} className="flex flex-col gap-4 pb-2">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Arrive" htmlFor="c-arrive" error={formState.errors.arrive_date?.message}>
            <Input id="c-arrive" type="date" autoFocus {...register("arrive_date")} />
          </Field>
          <Field label="Depart" htmlFor="c-depart" error={formState.errors.depart_date?.message}>
            <Input id="c-depart" type="date" {...register("depart_date")} />
          </Field>
        </div>
        <Field label="Status">
          <Controller control={control} name="status" render={({ field }) => <ChoiceChips name="Status" value={field.value} onChange={field.onChange} options={GEO_STATUS_OPTIONS} />} />
        </Field>
        <Controller
          control={control}
          name="transport_mode"
          render={({ field }) => <TransportField value={field.value} onChange={(v) => field.onChange(v ?? "")} noteProps={register("transport_note")} isFirst={country.order_index === 0} />}
        />
        <Field label={`Budget cap (${baseCurrency})`} htmlFor="c-budget" error={formState.errors.budget?.message} hint="Optional. Shows a progress bar on the budget page.">
          <Input id="c-budget" inputMode="decimal" placeholder="2500" {...register("budget")} />
        </Field>
      </form>
    </ResponsiveDialog>
  );
}
