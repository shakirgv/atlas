import { z } from "zod";
import {
  BOOKING_STATUSES,
  BOOKING_TYPES,
  DOCUMENT_TYPES,
  EXPENSE_CATEGORIES,
  EXPENSE_KINDS,
  GEO_STATUSES,
  PLACE_CATEGORIES,
  PLACE_STATUSES,
  STOP_TYPES,
  TRIP_STATUSES,
} from "@/lib/types";

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date")
  .or(z.literal(""))
  .nullish()
  .transform((v) => (v ? v : null));

const timeStr = z
  .string()
  .regex(/^\d{2}:\d{2}(:\d{2})?$/, "Use HH:MM")
  .or(z.literal(""))
  .nullish()
  .transform((v) => (v ? v : null));

const optText = (max = 5000) =>
  z
    .string()
    .max(max)
    .nullish()
    .transform((v) => (v && v.trim() ? v.trim() : null));

const optNumber = z
  .union([z.number(), z.string()])
  .nullish()
  .transform((v, ctx) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: "custom", message: "Enter a number" });
      return z.NEVER;
    }
    return n;
  });

const optUuid = z
  .string()
  .nullish()
  .transform((v) => (v ? v : null))
  .pipe(z.uuid().nullable());

const currency = z.string().regex(/^[A-Z]{3}$/, "Use a 3-letter currency code");

function endAfterStart<T extends Record<string, unknown>>(startKey: keyof T, endKey: keyof T) {
  return (v: T, ctx: z.RefinementCtx) => {
    const s = v[startKey] as string | null;
    const e = v[endKey] as string | null;
    if (s && e && e < s) ctx.addIssue({ code: "custom", path: [endKey as string], message: "End date must be after start date" });
  };
}

export const tripSchema = z
  .object({
    title: z.string().trim().min(1, "Give your trip a name").max(120),
    description: optText(2000),
    status: z.enum(TRIP_STATUSES).default("planning"),
    start_date: dateStr,
    end_date: dateStr,
    total_budget: optNumber,
  })
  .superRefine(endAfterStart("start_date", "end_date"));
export type TripInput = z.input<typeof tripSchema>;

export const tripCountrySchema = z
  .object({
    status: z.enum(GEO_STATUSES),
    arrive_date: dateStr,
    depart_date: dateStr,
    budget: optNumber,
    notes: optText(20000),
  })
  .superRefine(endAfterStart("arrive_date", "depart_date"));
export type TripCountryInput = z.input<typeof tripCountrySchema>;

export const citySchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(120),
    status: z.enum(GEO_STATUSES),
    arrive_date: dateStr,
    depart_date: dateStr,
    notes: optText(20000),
    lat: optNumber,
    lng: optNumber,
  })
  .superRefine(endAfterStart("arrive_date", "depart_date"));
export type CityInput = z.input<typeof citySchema>;

export const newCitySchema = z.object({
  name: z.string().trim().min(1).max(120),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
});

export const placeSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(160),
  city_id: z.uuid("Pick a city"),
  category: z.enum(PLACE_CATEGORIES),
  status: z.enum(PLACE_STATUSES),
  lat: optNumber,
  lng: optNumber,
  address: optText(300),
  url: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => (v ? v : null))
    .refine((v) => !v || /^https?:\/\//i.test(v), "Link must start with http(s)://"),
  rating: optNumber.refine((v) => v === null || (v >= 1 && v <= 5), "Rating is 1–5"),
  cost_estimate: optNumber,
  cost_currency: z
    .string()
    .nullish()
    .transform((v) => (v ? v : null)),
  opening_hours: optText(300),
  notes: optText(20000),
});
export type PlaceInput = z.input<typeof placeSchema>;

export const stopSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  type: z.enum(STOP_TYPES),
  start_time: timeStr,
  end_time: timeStr,
  place_id: optUuid,
  notes: optText(5000),
});
export type StopInput = z.input<typeof stopSchema>;

export const daySchema = z.object({
  title: optText(160),
  notes: optText(10000),
  city_id: optUuid,
  date: dateStr,
});

export const expenseSchema = z.object({
  trip_id: z.uuid("Pick a trip"),
  trip_country_id: optUuid,
  city_id: optUuid,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  title: optText(160),
  category: z.enum(EXPENSE_CATEGORIES),
  kind: z.enum(EXPENSE_KINDS),
  amount: z.coerce.number<number | string>().positive("Enter an amount"),
  currency,
  fx_rate: z.coerce.number<number | string>().positive("Rate must be positive"),
  notes: optText(2000),
});
export type ExpenseInput = z.input<typeof expenseSchema>;

export const memorySchema = z.object({
  trip_id: z.uuid("Pick a trip"),
  trip_country_id: optUuid,
  city_id: optUuid,
  place_id: optUuid,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  title: optText(160),
  body: optText(50000),
  mood: optText(16),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
});
export type MemoryInput = z.input<typeof memorySchema>;

export const documentSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required").max(160),
    type: z.enum(DOCUMENT_TYPES),
    trip_id: optUuid,
    trip_country_id: optUuid,
    issue_date: dateStr,
    expiry_date: dateStr,
    reference_no: optText(120),
    notes: optText(5000),
  })
  .superRefine(endAfterStart("issue_date", "expiry_date"));
export type DocumentInput = z.input<typeof documentSchema>;

export const settingsSchema = z.object({
  display_name: optText(80),
  base_currency: currency,
  theme: z.enum(["system", "light", "dark"]),
});

export const bookingSchema = z.object({
  trip_id: z.uuid("Pick a trip"),
  trip_country_id: optUuid,
  city_id: optUuid,
  document_id: optUuid,
  type: z.enum(BOOKING_TYPES),
  title: z.string().trim().min(1, "Title is required").max(160),
  from_label: optText(160),
  to_label: optText(160),
  start_at: z
    .string()
    .nullish()
    .transform((v) => (v ? v : null)),
  end_at: z
    .string()
    .nullish()
    .transform((v) => (v ? v : null)),
  confirmation_no: optText(80),
  cost: optNumber,
  currency: z
    .string()
    .nullish()
    .transform((v) => (v ? v : null)),
  status: z.enum(BOOKING_STATUSES),
  add_expense: z.boolean().optional(),
});
export type BookingInput = z.input<typeof bookingSchema>;

export const photoMetaSchema = z.object({
  path: z.string().min(10).max(400),
  thumb_path: z.string().max(400).nullable(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  taken_at: z.string().nullable(),
  lat: z.number().min(-90).max(90).nullable(),
  lng: z.number().min(-180).max(180).nullable(),
  caption: z.string().max(500).nullable().optional(),
});
export type PhotoMeta = z.infer<typeof photoMetaSchema>;

export { z };
