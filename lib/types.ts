import type { Database } from "@/lib/database.types";

type Tables = Database["public"]["Tables"];
export type Row<T extends keyof Tables> = Tables[T]["Row"];
export type Insert<T extends keyof Tables> = Tables[T]["Insert"];
export type Update<T extends keyof Tables> = Tables[T]["Update"];

export type Settings = Row<"settings">;
export type Trip = Row<"trips">;
export type TripCountry = Row<"trip_countries">;
export type City = Row<"cities">;
export type Place = Row<"places">;
export type ItineraryDay = Row<"itinerary_days">;
export type ItineraryItem = Row<"itinerary_items">;
export type Expense = Row<"expenses">;
export type Memory = Row<"memories">;
export type DocumentRow = Row<"documents">;
export type Photo = Row<"photos">;
export type Booking = Row<"bookings">;
export type PackingItem = Row<"packing_items">;
export type PackingTemplate = Row<"packing_templates">;
export type EntryRequirement = Row<"entry_requirements">;
export type CountryInfoOverride = Row<"country_info_overrides">;
export type CashWallet = Row<"cash_wallets">;
export type CashTransaction = Row<"cash_transactions">;
export type Share = Row<"shares">;
export type CountryReview = Row<"country_reviews">;
export type DateShift = Row<"date_shifts">;

export const TRIP_STATUSES = ["dreaming", "planning", "ongoing", "completed"] as const;
export type TripStatus = (typeof TRIP_STATUSES)[number];

export const GEO_STATUSES = ["wishlist", "planned", "visited"] as const;
export type GeoStatus = (typeof GEO_STATUSES)[number];
/** Display status adds the derived "ongoing" state (never stored). */
export type DisplayStatus = GeoStatus | "ongoing";

export const PLACE_CATEGORIES = [
  "sight",
  "museum",
  "food",
  "cafe",
  "nightlife",
  "nature",
  "shopping",
  "activity",
  "stay",
  "transport",
  "other",
] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export const PLACE_STATUSES = ["want", "planned", "visited"] as const;
export type PlaceStatus = (typeof PLACE_STATUSES)[number];

export const STOP_TYPES = ["activity", "food", "transport", "stay", "free"] as const;
export type StopType = (typeof STOP_TYPES)[number];

export const EXPENSE_CATEGORIES = [
  "flights",
  "accommodation",
  "food",
  "transport",
  "activities",
  "shopping",
  "visa",
  "insurance",
  "fees",
  "other",
] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_KINDS = ["planned", "actual"] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export const DOCUMENT_TYPES = [
  "passport",
  "id",
  "visa",
  "flight",
  "accommodation",
  "insurance",
  "vaccination",
  "ticket",
  "other",
] as const;
export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const PHOTO_ENTITY_TYPES = ["trip", "country", "city", "place", "memory", "expense"] as const;
export type PhotoEntityType = (typeof PHOTO_ENTITY_TYPES)[number];

export const BOOKING_TYPES = [
  "flight",
  "train",
  "bus",
  "ferry",
  "car",
  "hotel",
  "hostel",
  "apartment",
  "tour",
  "other",
] as const;
export type BookingType = (typeof BOOKING_TYPES)[number];

export const BOOKING_STATUSES = ["booked", "pending", "cancelled"] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export const TRANSPORT_MODES = ["flight", "train", "bus", "ferry", "car", "bike", "walk", "other"] as const;
export type TransportMode = (typeof TRANSPORT_MODES)[number];

export const PAYMENT_METHODS = ["card", "cash", "other"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const CASH_TX_TYPES = ["withdrawal", "exchange_in", "exchange_out", "spend", "received", "adjustment"] as const;
export type CashTxType = (typeof CASH_TX_TYPES)[number];

export const REQUIREMENT_TYPES = ["not_checked", "visa_free", "e_visa", "visa_on_arrival", "visa_required", "other"] as const;
export type RequirementType = (typeof REQUIREMENT_TYPES)[number];

export const ENTRY_STATUSES = ["not_checked", "not_needed", "to_apply", "applied", "approved", "rejected"] as const;
export type EntryStatus = (typeof ENTRY_STATUSES)[number];

export const SHARE_KINDS = ["memory", "trip", "recap"] as const;
export type ShareKind = (typeof SHARE_KINDS)[number];

export const RETURN_AGAIN = ["yes", "maybe", "no"] as const;
export type ReturnAgain = (typeof RETURN_AGAIN)[number];

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

/** A photo with signed URLs attached (server → client). */
export type PhotoView = Photo & { url: string | null; thumb_url: string | null };

/** Lightweight trip-country summary used across the shell and forms. */
export type CountryOption = {
  id: string;
  trip_id: string;
  country_code: string;
  name: string;
  flag: string;
  order_index: number;
  arrive_date: string | null;
  depart_date: string | null;
  status: string;
};

export type CityOption = {
  id: string;
  trip_country_id: string;
  name: string;
  lat: number | null;
  lng: number | null;
  country_code: string;
};

export type TripOption = Pick<Trip, "id" | "title" | "status" | "start_date" | "end_date" | "is_sample">;
