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
import { ChoiceChips, MoreDetails, SubmitButton } from "@/components/forms/form-bits";
import { GEO_STATUS_OPTIONS } from "@/components/countries/country-edit-dialog";

type In = z.input<typeof citySchema>;
type Out = z.output<typeof citySchema>;

export function CityEditDialog({ open, onOpenChange, city }: { open: boolean; onOpenChange: (o: boolean) => void; city: City }) {
  const [pending, start] = useTransition();
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(citySchema),
    values: { name: city.name, status: city.status as Out["status"], arrive_date: city.arrive_date ?? "", depart_date: city.depart_date ?? "", notes: city.notes ?? "", lat: city.lat, lng: city.lng },
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Arrive" htmlFor="city-arrive" error={formState.errors.arrive_date?.message}>
            <Input id="city-arrive" type="date" {...register("arrive_date")} />
          </Field>
          <Field label="Depart" htmlFor="city-depart" error={formState.errors.depart_date?.message}>
            <Input id="city-depart" type="date" {...register("depart_date")} />
          </Field>
        </div>
        <Field label="Status">
          <Controller control={control} name="status" render={({ field }) => <ChoiceChips name="Status" value={field.value} onChange={field.onChange} options={GEO_STATUS_OPTIONS} />} />
        </Field>
        <MoreDetails label="Coordinates">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" htmlFor="city-lat" error={formState.errors.lat?.message}>
              <Input id="city-lat" inputMode="decimal" {...register("lat")} />
            </Field>
            <Field label="Longitude" htmlFor="city-lng" error={formState.errors.lng?.message}>
              <Input id="city-lng" inputMode="decimal" {...register("lng")} />
            </Field>
          </div>
        </MoreDetails>
      </form>
    </ResponsiveDialog>
  );
}
