import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Where to go after signing in: only a path inside this app, never another site. */
export function safeNextPath(next: string | null | undefined) {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : "/";
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid() {
  return crypto.randomUUID();
}

export function sum(values: number[]) {
  return values.reduce((a, b) => a + b, 0);
}

export function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

export function groupBy<T, K extends string | number>(items: T[], key: (item: T) => K): Record<K, T[]> {
  const out = {} as Record<K, T[]>;
  for (const item of items) {
    const k = key(item);
    (out[k] ??= []).push(item);
  }
  return out;
}

export function pluralize(n: number, one: string, many = `${one}s`) {
  return `${n} ${n === 1 ? one : many}`;
}

export function initials(name: string | null | undefined) {
  if (!name) return "A";
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Deterministic hash used to pick gradient fallbacks. */
export function hashString(input: string) {
  let h = 0;
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const GRADIENTS = [
  ["#E8532F", "#F2A93B"],
  ["#0E7C7B", "#7C8DB5"],
  ["#7C8DB5", "#E8532F"],
  ["#F2A93B", "#0E7C7B"],
  ["#15181E", "#0E7C7B"],
  ["#C9421F", "#7C8DB5"],
  ["#2CC4B8", "#F5B84B"],
  ["#8FA2CF", "#FF6B45"],
] as const;

export function gradientFor(seed: string) {
  const [a, b] = GRADIENTS[hashString(seed) % GRADIENTS.length]!;
  return `linear-gradient(135deg, ${a} 0%, ${b} 100%)`;
}

export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function errorMessage(e: unknown) {
  if (e instanceof Error) return e.message;
  if (typeof e === "string") return e;
  return "Something went wrong";
}
