/** One place to rename the app. */
export const APP_NAME = "Atlas";
export const APP_TAGLINE = "Your personal travel dashboard";
export const USER_AGENT = "Atlas/1.0 (personal project)";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True when both public Supabase env vars are present. */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const ACTIVE_TRIP_COOKIE = "active_trip";
export const ALL_TRIPS = "all";

export const PHOTO_URL_TTL = 60 * 60; // 1 hour
export const DOCUMENT_URL_TTL = 60 * 5; // 5 minutes
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

export const BUCKETS = { photos: "photos", documents: "documents" } as const;
