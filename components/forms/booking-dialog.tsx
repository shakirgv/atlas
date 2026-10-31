"use client";
import { useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { saveBooking } from "@/actions/bookings";
import { bookingSchema, type z } from "@/lib/validation";
import { BOOKING_STATUSES, BOOKING_TYPES, type Booking } from "@/lib/types";
import { BOOKING_TYPE_META } from "@/lib/icons";
import { CURRENCIES } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Switch } from "@/components/ui/misc";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useDefaultTripId, useWorkspace } from "@/components/shell/workspace";
import { ChoiceChips, MoreDetails, SubmitButton } from "./form-bits";

type In = z.input<typeof bookingSchema>;
type Out = z.output<typeof bookingSchema>;

const toLocal = (iso: string | null | undefined) => (iso ? iso.slice(0, 16) : "");

export function BookingDialog({
  open,
  onOpenChange,
  booking,
  documents = [],
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  booking?: Booking | null;
  documents?: { id: string; title: string }[];
}) {
  const ws = useWorkspace();
  const defaultTrip = useDefaultTripId();
  const [pending, start] = useTransition();
  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(bookingSchema),
    values: {
      trip_id: booking?.trip_id ?? defaultTrip ?? "",
      trip_country_id: booking?.trip_country_id ?? "",
      city_id: booking?.city_id ?? "",
      document_id: booking?.document_id ?? "",
      type: (booking?.type as Out["type"]) ?? "flight",
      title: booking?.title ?? "",
      from_label: booking?.from_label ?? "",
      to_label: booking?.to_label ?? "",
      start_at: toLocal(booking?.start_at),
      end_at: toLocal(booking?.end_at),
      confirmation_no: booking?.confirmation_no ?? "",
      cost: booking?.cost ?? "",
      currency: booking?.currency ?? ws.baseCurrency,
      status: (booking?.status as Out["status"]) ?? "booked",
      add_expense: false,
    },
  });
  const { register, handleSubmit, control, watch, setValue, formState } = form;
  const tripId = watch("trip_id");
  const countryId = watch("trip_country_id");

  const onSubmit = handleSubmit((values) =>
    start(async () => {
      // datetime-local values are local wall-clock times; keep them as-is (no timezone shift).
      const res = await saveBooking(booking?.id ?? null, values);
      if (!res.ok) return void toast.error(res.error);
      toast.success(booking ? "Booking updated" : values.add_expense ? "Booking and expense saved" : "Booking saved");
      onOpenChange(false);
    }),
  );

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={booking ? "Edit booking" : "Add booking"}
      description={booking ? undefined : "Flights, stays and trains appear in the itinerary on their dates."}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <SubmitButton form="booking-form" pending={pending} disabled={!ws.trips.length}>
            {booking ? "Save changes" : "Save booking"}
          </SubmitButton>
        </>
      }
    >
      {!ws.trips.length ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">Create a trip first.</p>
      ) : (
        <form id="booking-form" onSubmit={onSubmit} className="flex flex-col gap-4 pb-2">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <ChoiceChips name="Booking type" value={field.value} onChange={field.onChange} options={BOOKING_TYPES.map((t) => ({ value: t, label: BOOKING_TYPE_META[t].label, icon: BOOKING_TYPE_META[t].icon }))} />
            )}
          />
          <Field label="Title" htmlFor="bk-title" error={formState.errors.title?.message}>
            <Input id="bk-title" placeholder="TK 1861 Istanbul → Rome" autoFocus {...register("title")} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="From" htmlFor="bk-from">
              <Input id="bk-from" placeholder="IST" {...register("from_label")} />
            </Field>
            <Field label="To" htmlFor="bk-to">
              <Input id="bk-to" placeholder="FCO" {...register("to_label")} />
            </Field>
            <Field label="Starts" htmlFor="bk-start">
              <Input id="bk-start" type="datetime-local" {...register("start_at")} />
            </Field>
            <Field label="Ends" htmlFor="bk-end">
              <Input id="bk-end" type="datetime-local" {...register("end_at")} />
            </Field>
          </div>
          <Field label="Confirmation number" htmlFor="bk-conf">
            <Input id="bk-conf" className="font-mono" {...register("confirmation_no")} />
          </Field>
          <MoreDetails defaultOpen={Boolean(booking)}>
            <div className="grid grid-cols-[1fr_110px] gap-3">
              <Field label="Cost" htmlFor="bk-cost" error={formState.errors.cost?.message}>
                <Input id="bk-cost" inputMode="decimal" {...register("cost")} />
              </Field>
              <Field label="Currency" htmlFor="bk-cur">
                <NativeSelect id="bk-cur" {...register("currency")}>
                  {CURRENCIES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            {!booking && (
              <Controller
                control={control}
                name="add_expense"
                render={({ field }) => (
                  <label className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 px-3 py-2.5 text-sm">
                    <span>
                      Also add as a planned expense
                      <span className="block text-xs text-muted">Uses the cost above, converted to {ws.baseCurrency}.</span>
                    </span>
                    <Switch checked={Boolean(field.value)} onCheckedChange={field.onChange} />
                  </label>
                )}
              />
            )}
            <Field label="Status">
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <ChoiceChips name="Status" value={field.value} onChange={field.onChange} options={BOOKING_STATUSES.map((s) => ({ value: s, label: s[0]!.toUpperCase() + s.slice(1) }))} />
                )}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              {ws.trips.length > 1 && (
                <Field label="Trip" htmlFor="bk-trip" className="col-span-2">
                  <NativeSelect id="bk-trip" {...register("trip_id")} onChange={(e) => { setValue("trip_id", e.target.value); setValue("trip_country_id", ""); setValue("city_id", ""); }}>
                    {ws.trips.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.title}
                      </option>
                    ))}
                  </NativeSelect>
                </Field>
              )}
              <Field label="Country" htmlFor="bk-country">
                <NativeSelect id="bk-country" {...register("trip_country_id")} onChange={(e) => { setValue("trip_country_id", e.target.value); setValue("city_id", ""); }}>
                  <option value="">—</option>
                  {ws.countries.filter((c) => c.trip_id === tripId).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="City" htmlFor="bk-city">
                <NativeSelect id="bk-city" {...register("city_id")}>
                  <option value="">—</option>
                  {ws.cities.filter((c) => c.trip_country_id === countryId).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            {documents.length > 0 && (
              <Field label="Linked document" htmlFor="bk-doc">
                <NativeSelect id="bk-doc" {...register("document_id")}>
                  <option value="">—</option>
                  {documents.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
          </MoreDetails>
        </form>
      )}
    </ResponsiveDialog>
  );
}
