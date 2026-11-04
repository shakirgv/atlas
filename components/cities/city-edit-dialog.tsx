"use client";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { updateCity } from "@/actions/cities";
import { citySchema, type z } from "@/lib/validation";
import type { City } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { DatePartsField } from "@/components/forms/date-parts-field";
import { ChoiceChips, MoreDetails, SubmitButton } from "@/components/forms/form-bits";
import { GEO_STATUS_OPTIONS } from "@/components/countries/country-edit-dialog";
import { TransportField } from "@/components/route/transport-field";

type In = z.input<typeof citySchema>;
type Out = z.output<typeof citySchema>;

export function CityEditDialog({ open, onOpenChange, city, previousStop, isFirstStop }: { open: boolean; onOpenChange: (o: boolean) => void; city: City; previousStop: string | null; isFirstStop: boolean }) {
  const [pending, start] = useTransition();
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(citySchema),
    values: { name: city.name, status: city.status as Out["status"], arrive_date: city.arrive_date ?? "", depart_date: city.depart_date ?? "", notes: city.notes ?? "", lat: city.lat, lng: city.lng, timezone: city.timezone ?? "", transport_mode: (city.transport_mode ?? "") as In["transport_mode"], transport_note: city.transport_note ?? "" },
  });
  const { register, handleSubmit, control, formState } = form;
  const onSubmit = handleSubmit((v) =>
    start(async () => {
      const res = await updateCity(city.id, v);
      if (!res.ok) return void toast.error(res.error);
      toast.success("Saved");
      onOpenChange(false);
    }),
  );
  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Edit ${city.name}`}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SubmitButton form="city-form" pending={pending}>
            Save
          </SubmitButton>
        </>
      }
    >
      <form id="city-form" onSubmit={onSubmit} className="flex flex-col gap-4 pb-2">
        <Field label="Name" htmlFor="city-name" error={formState.errors.name?.message}>
          <Input id="city-name" {...register("name")} />
        </Field>
        <div className="flex flex-col gap-3">
          <Field label="Arrive" htmlFor="city-arrive" error={formState.errors.arrive_date?.message}>
            <Controller control={control} name="arrive_date" render={({ field }) => <DatePartsField id="city-arrive" label="Arrive" shortMonths value={field.value} onChange={field.onChange} invalid={Boolean(formState.errors.arrive_date)} />} />
          </Field>
          <Field label="Depart" htmlFor="city-depart" error={formState.errors.depart_date?.message}>
            <Controller control={control} name="depart_date" render={({ field }) => <DatePartsField id="city-depart" label="Depart" shortMonths value={field.value} onChange={field.onChange} invalid={Boolean(formState.errors.depart_date)} />} />
          </Field>
        </div>
        <Field label="Status">
          <Controller control={control} name="status" render={({ field }) => <ChoiceChips name="Status" value={field.value} onChange={field.onChange} options={GEO_STATUS_OPTIONS} />} />
        </Field>
        <Controller
          control={control}
          name="transport_mode"
          render={({ field }) => <TransportField value={field.value} onChange={(v) => field.onChange(v ?? "")} noteProps={register("transport_note")} previousStop={previousStop} isFirst={isFirstStop} />}
        />
        <MoreDetails label="Coordinates & time zone">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" htmlFor="city-lat" error={formState.errors.lat?.message}>
              <Input id="city-lat" inputMode="decimal" {...register("lat")} />
            </Field>
            <Field label="Longitude" htmlFor="city-lng" error={formState.errors.lng?.message}>
              <Input id="city-lng" inputMode="decimal" {...register("lng")} />
            </Field>
          </div>
          <Field label="Time zone (IANA)" htmlFor="city-tz" error={formState.errors.timezone?.message} hint="Filled automatically from the coordinates. Clear it to look it up again.">
            <Input id="city-tz" placeholder="Asia/Tokyo" {...register("timezone")} />
          </Field>
        </MoreDetails>
      </form>
    </ResponsiveDialog>
  );
}
