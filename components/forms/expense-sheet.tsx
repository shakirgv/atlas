"use client";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { createExpense, updateExpense } from "@/actions/expenses";
import { expenseSchema, type z } from "@/lib/validation";
import { EXPENSE_CATEGORIES, type Expense } from "@/lib/types";
import { CURRENCIES, EXPENSE_CATEGORY_META, formatMoney, rateToBase, round2 } from "@/lib/money";
import { EXPENSE_CATEGORY_ICON } from "@/lib/icons";
import { primaryCurrency } from "@/lib/countries";
import { todayIso } from "@/lib/dates";
import { cn } from "@/lib/utils";
import { useRates } from "@/hooks/use-rates";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { useDefaultTripId, useWorkspace } from "@/components/shell/workspace";
import { ChoiceChips, MoreDetails, SubmitButton } from "./form-bits";

type In = z.input<typeof expenseSchema>;
type Out = z.output<typeof expenseSchema>;
const LAST_CURRENCY_KEY = "atlas:last-currency";

export function ExpenseSheet({
  open,
  onOpenChange,
  expense,
  tripCountryId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  expense?: Expense | null;
  tripCountryId?: string | null;
}) {
  const ws = useWorkspace();
  const defaultTrip = useDefaultTripId();
  const base = ws.baseCurrency;
  const { rates, error: ratesError } = useRates(base, open);
  const [pending, start] = useTransition();
  const [count, setCount] = useState(0);
  const amountRef = useRef<HTMLInputElement | null>(null);

  const initialCountry = expense?.trip_country_id ?? tripCountryId ?? "";
  const initialCurrency = () => {
    if (expense) return expense.currency;
    const c = ws.countries.find((x) => x.id === initialCountry);
    const fromCountry = primaryCurrency(c?.country_code);
    if (fromCountry) return fromCountry;
    if (typeof window !== "undefined") return localStorage.getItem(LAST_CURRENCY_KEY) ?? base;
    return base;
  };

  const form = useForm<In, unknown, Out>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      trip_id: expense?.trip_id ?? defaultTrip ?? "",
      trip_country_id: initialCountry,
      city_id: expense?.city_id ?? "",
      date: expense?.date ?? todayIso(),
      title: expense?.title ?? "",
      category: (expense?.category as Out["category"]) ?? "food",
      kind: (expense?.kind as Out["kind"]) ?? "actual",
      amount: expense?.amount ?? "",
      currency: initialCurrency(),
      fx_rate: expense?.fx_rate ?? 1,
      notes: expense?.notes ?? "",
    },
  });
  const { register, handleSubmit, control, watch, setValue, formState, reset } = form;
  const amount = Number(String(watch("amount") ?? "").replace(",", ".")) || 0;
  const currency = watch("currency");
  const fxRate = Number(watch("fx_rate")) || 0;
  const tripId = watch("trip_id");
  const countryId = watch("trip_country_id");
  const [manualRate, setManualRate] = useState(Boolean(expense && expense.currency !== base));

  // Reset the form each time the sheet opens.
  useEffect(() => {
    if (!open) return;
    reset({
      trip_id: expense?.trip_id ?? defaultTrip ?? "",
      trip_country_id: initialCountry,
      city_id: expense?.city_id ?? "",
      date: expense?.date ?? todayIso(),
      title: expense?.title ?? "",
      category: (expense?.category as Out["category"]) ?? "food",
      kind: (expense?.kind as Out["kind"]) ?? "actual",
      amount: expense?.amount ?? "",
      currency: initialCurrency(),
      fx_rate: expense?.fx_rate ?? 1,
      notes: expense?.notes ?? "",
    });
    setCount(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, expense?.id]);

  // Auto rate from the live table unless the user overrides it.
  const autoRate = useMemo(() => (currency === base ? 1 : rateToBase(rates, currency)), [currency, base, rates]);
  useEffect(() => {
    if (!manualRate && autoRate) setValue("fx_rate", Number(autoRate.toFixed(8)));
  }, [autoRate, manualRate, setValue]);
  const needsManual = currency !== base && !autoRate;

  // Default currency follows the chosen country.
  const onCountryChange = (id: string) => {
    setValue("trip_country_id", id);
    setValue("city_id", "");
    const c = ws.countries.find((x) => x.id === id);
    const cur = primaryCurrency(c?.country_code);
    if (cur && !expense) setValue("currency", cur);
  };

  const countryOptions = ws.countries.filter((c) => c.trip_id === tripId);
  const cityOptions = ws.cities.filter((c) => c.trip_country_id === countryId);

  const onSubmit = handleSubmit((values) =>
    start(async () => {
      const res = expense ? await updateExpense(expense.id, values) : await createExpense(values);
      if (!res.ok) return void toast.error(res.error);
      localStorage.setItem(LAST_CURRENCY_KEY, values.currency);
      if (expense) {
        toast.success("Expense updated");
        onOpenChange(false);
        return;
      }
      toast.success(`Saved ${formatMoney(values.amount, values.currency)}`, { description: "Ready for the next one." });
      setCount((n) => n + 1);
      // Stay open for the next entry; keep trip/country/currency/kind/date.
      setValue("amount", "");
      setValue("title", "");
      setValue("notes", "");
      amountRef.current?.focus();
    }),
  );

  const { ref: amountRegRef, ...amountReg } = register("amount");

  return (
    <ResponsiveDialog
      open={open}
      onOpenChange={onOpenChange}
      title={expense ? "Edit expense" : "Add expense"}
      description={count ? `${count} saved this session · press Enter to add another` : "Press Enter to save and add another."}
      footer={
        <>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {count ? "Done" : "Cancel"}
          </Button>
          <SubmitButton form="expense-form" pending={pending}>
            {expense ? "Save changes" : "Save expense"}
          </SubmitButton>
        </>
      }
    >
      {!ws.trips.length ? (
        <p className="rounded-xl bg-surface-2 p-4 text-sm text-muted">Create a trip first to start tracking expenses.</p>
      ) : (
        <form id="expense-form" onSubmit={onSubmit} className="flex flex-col gap-4 pb-2">
          <div className="flex items-stretch gap-2">
            <div className="relative flex-1">
              <Input
                {...amountReg}
                ref={(el) => {
                  amountRegRef(el);
                  amountRef.current = el;
                }}
                autoFocus
                inputMode="decimal"
                placeholder="0.00"
                aria-label="Amount"
                className="num h-14 text-[28px] font-semibold max-md:h-14 max-md:text-[28px]"
              />
            </div>
            <NativeSelect {...register("currency")} aria-label="Currency" className="w-28 [&_select]:h-14 [&_select]:text-base [&_select]:font-medium">
              {[base, ...CURRENCIES.filter((c) => c !== base)].map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </NativeSelect>
          </div>
          {formState.errors.amount && <p className="-mt-2 text-xs text-danger">{formState.errors.amount.message}</p>}
          <div className="-mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="num text-muted">
              {currency === base ? (
                "In your base currency"
              ) : needsManual && !manualRate ? (
                "No live rate — enter one below"
              ) : (
                <>
                  ≈ <span className="font-medium text-ink">{formatMoney(round2(amount * fxRate), base)}</span>
                  <span className="ml-1.5 text-xs">
                    (1 {currency} = {fxRate ? fxRate.toFixed(fxRate < 0.01 ? 6 : 4) : "?"} {base}
                    {rates?.stale ? ", last known" : ""})
                  </span>
                </>
              )}
            </span>
            {currency !== base && (
              <button type="button" onClick={() => setManualRate((m) => !m)} className="text-xs font-medium text-accent hover:underline">
                {manualRate ? "Use live rate" : "Override rate"}
              </button>
            )}
          </div>
          {currency !== base && (manualRate || needsManual) && (
            <Field label={`Rate: 1 ${currency} in ${base}`} htmlFor="fx" error={formState.errors.fx_rate?.message ?? (needsManual && !manualRate ? (ratesError ?? undefined) : undefined)}>
              <Input id="fx" inputMode="decimal" {...register("fx_rate")} onFocus={() => setManualRate(true)} />
            </Field>
          )}
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <div role="radiogroup" aria-label="Kind" className="grid grid-cols-2 rounded-xl border border-border bg-surface-2 p-1">
                {(["actual", "planned"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    role="radio"
                    aria-checked={field.value === k}
                    onClick={() => field.onChange(k)}
                    className={cn(
                      "h-9 rounded-lg text-sm font-medium text-muted transition-colors",
                      field.value === k && "bg-surface text-ink shadow-sm ring-1 ring-border",
                    )}
                  >
                    {k === "actual" ? "Spent" : "Planned"}
                  </button>
                ))}
              </div>
            )}
          />
          <Controller
            control={control}
            name="category"
            render={({ field }) => (
              <ChoiceChips
                name="Category"
                value={field.value}
                onChange={field.onChange}
                options={EXPENSE_CATEGORIES.map((c) => ({ value: c, label: EXPENSE_CATEGORY_META[c].label, icon: EXPENSE_CATEGORY_ICON[c], color: EXPENSE_CATEGORY_META[c].color }))}
              />
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Date" htmlFor="exp-date" error={formState.errors.date?.message}>
              <Input id="exp-date" type="date" {...register("date")} />
            </Field>
            <Field label="Note" htmlFor="exp-title">
              <Input id="exp-title" placeholder="Ramen in Shibuya" {...register("title")} />
            </Field>
          </div>
          <MoreDetails defaultOpen={Boolean(expense?.trip_country_id) || ws.trips.length > 1}>
            {ws.trips.length > 1 && (
              <Field label="Trip" htmlFor="exp-trip" error={formState.errors.trip_id?.message}>
                <NativeSelect id="exp-trip" {...register("trip_id")} onChange={(e) => { setValue("trip_id", e.target.value); setValue("trip_country_id", ""); setValue("city_id", ""); }}>
                  {ws.trips.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.title}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Country" htmlFor="exp-country">
                <NativeSelect id="exp-country" value={countryId ?? ""} onChange={(e) => onCountryChange(e.target.value)}>
                  <option value="">Whole trip</option>
                  {countryOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.flag} {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
              <Field label="City" htmlFor="exp-city">
                <NativeSelect id="exp-city" {...register("city_id")} disabled={!cityOptions.length}>
                  <option value="">—</option>
                  {cityOptions.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </NativeSelect>
              </Field>
            </div>
            <Field label="Details" htmlFor="exp-notes">
              <Input id="exp-notes" {...register("notes")} />
            </Field>
          </MoreDetails>
        </form>
      )}
    </ResponsiveDialog>
  );
}
