"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { CircleCheck, Compass, Plane, Sparkles } from "lucide-react";
import { createTrip, updateTrip } from "@/actions/trips";
import { tripSchema, type z } from "@/lib/validation";
import type { Trip } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ChoiceChips, MoreDetails, SubmitButton } from "./form-bits";

type In = z.input<typeof tripSchema>;
type Out = z.output<typeof tripSchema>;

const STATUS_OPTIONS = [
  { value: "dreaming" as const, label: "Dreaming", icon: Sparkles, color: "var(--wishlist)" },
  { value: "planning" as const, label: "Planning", icon: Compass, color: "var(--planned)" },
  { value: "ongoing" as const, label: "Ongoing", icon: Plane, color: "var(--accent)" },
  { value: "completed" as const, label: "Completed", icon: CircleCheck, color: "var(--visited)" },
];

export function TripDialog({ open, onOpenChange, trip }: { open: boolean; onOpenChange: (o: boolean) => void; trip?: Trip | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(tripSchema),
    values: {
      title: trip?.title ?? "",
      description: trip?.description ?? "",
      status: (trip?.status as Out["status"]) ?? "planning",
      start_date: trip?.start_date ?? "",
      end_date: trip?.end_date ?? "",
      total_budget: trip?.total_budget ?? "",
    },
  });
  const { register, handleSubmit, control, formState } = form;

  const onSubmit = handleSubmit((values) =>
    start(async () => {
      const res = trip ? await updateTrip(trip.id, values) : await createTrip(values);
      if (!res.ok) return void toast.error(res.error);
      toast.success(trip ? "Trip updated" : "Trip created");
      onOpenChange(false);
      form.reset();
      if (!trip && res.data && typeof res.data === "object" && "id" in res.data) router.push(`/trips/${res.data.id}`);
    }),
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={trip ? "Edit trip" : "New trip"}
      description={trip ? undefined : "Give it a name. You can add countries next."}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SubmitButton form="trip-form" pending={pending}>
            {trip ? "Save changes" : "Create trip"}
          </SubmitButton>
        </>
      }
    >
      <form id="trip-form" onSubmit={onSubmit} className="flex flex-col gap-4 pb-2">
        <Field label="Trip name" htmlFor="trip-title" error={formState.errors.title?.message}>
          <Input id="trip-title" placeholder="World Tour 2027" autoFocus {...register("title")} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Start" htmlFor="trip-start" error={formState.errors.start_date?.message}>
            <Input id="trip-start" type="date" {...register("start_date")} />
          </Field>
          <Field label="End" htmlFor="trip-end" error={formState.errors.end_date?.message}>
            <Input id="trip-end" type="date" {...register("end_date")} />
          </Field>
        </div>
        <Field label="Status">
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <ChoiceChips name="Trip status" value={field.value ?? "planning"} onChange={field.onChange} options={STATUS_OPTIONS} />
            )}
          />
        </Field>
        <MoreDetails defaultOpen={Boolean(trip?.description || trip?.total_budget)}>
          <Field label="Total budget (base currency)" htmlFor="trip-budget" error={formState.errors.total_budget?.message}>
            <Input id="trip-budget" inputMode="decimal" placeholder="12000" {...register("total_budget")} />
          </Field>
          <Field label="Description" htmlFor="trip-desc">
            <Textarea id="trip-desc" placeholder="What is this trip about?" {...register("description")} />
          </Field>
        </MoreDetails>
      </form>
    </ResponsiveDialog>
  );
}
