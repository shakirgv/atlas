import {
  BedDouble,
  Bike,
  BookUser,
  Building2,
  Bus,
  CarFront,
  Circle,
  Coffee,
  Compass,
  FileText,
  Footprints,
  Hotel,
  IdCard,
  Landmark,
  Library,
  type LucideIcon,
  Martini,
  Mountain,
  Package,
  Plane,
  Receipt,
  Sailboat,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Stamp,
  Sun,
  Syringe,
  Tent,
  Ticket,
  TrainFront,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import type { BookingType, DocumentType, ExpenseCategory, PlaceCategory, StopType } from "@/lib/types";

export const PLACE_CATEGORY_META: Record<PlaceCategory, { label: string; icon: LucideIcon; color: string }> = {
  sight: { label: "Sight", icon: Landmark, color: "#E8532F" },
  museum: { label: "Museum", icon: Library, color: "#7C8DB5" },
  food: { label: "Food", icon: UtensilsCrossed, color: "#D9822B" },
  cafe: { label: "Café", icon: Coffee, color: "#8A6E4B" },
  nightlife: { label: "Nightlife", icon: Martini, color: "#9B5DE5" },
  nature: { label: "Nature", icon: Mountain, color: "#0E7C7B" },
  shopping: { label: "Shopping", icon: ShoppingBag, color: "#C46A9A" },
  activity: { label: "Activity", icon: Sparkles, color: "#F2A93B" },
  stay: { label: "Stay", icon: BedDouble, color: "#5A6B8C" },
  transport: { label: "Transport", icon: TrainFront, color: "#4B7BA8" },
  other: { label: "Other", icon: Circle, color: "#9AA0A8" },
};

export const STOP_TYPE_META: Record<StopType, { label: string; icon: LucideIcon; color: string }> = {
  activity: { label: "Activity", icon: Footprints, color: "var(--accent)" },
  food: { label: "Food", icon: UtensilsCrossed, color: "#D9822B" },
  transport: { label: "Transport", icon: TrainFront, color: "#4B7BA8" },
  stay: { label: "Stay", icon: BedDouble, color: "#5A6B8C" },
  free: { label: "Free time", icon: Sun, color: "var(--visited)" },
};

export const EXPENSE_CATEGORY_ICON: Record<ExpenseCategory, LucideIcon> = {
  flights: Plane,
  accommodation: BedDouble,
  food: UtensilsCrossed,
  transport: TrainFront,
  activities: Ticket,
  shopping: ShoppingBag,
  visa: Stamp,
  insurance: ShieldCheck,
  other: Wallet,
};

export const DOCUMENT_TYPE_META: Record<DocumentType, { label: string; icon: LucideIcon }> = {
  passport: { label: "Passport", icon: BookUser },
  id: { label: "ID card", icon: IdCard },
  visa: { label: "Visa", icon: Stamp },
  flight: { label: "Flight", icon: Plane },
  accommodation: { label: "Accommodation", icon: Hotel },
  insurance: { label: "Insurance", icon: ShieldCheck },
  vaccination: { label: "Vaccination", icon: Syringe },
  ticket: { label: "Ticket", icon: Ticket },
  other: { label: "Other", icon: FileText },
};

export const BOOKING_TYPE_META: Record<BookingType, { label: string; icon: LucideIcon }> = {
  flight: { label: "Flight", icon: Plane },
  train: { label: "Train", icon: TrainFront },
  bus: { label: "Bus", icon: Bus },
  ferry: { label: "Ferry", icon: Sailboat },
  car: { label: "Car", icon: CarFront },
  hotel: { label: "Hotel", icon: Hotel },
  hostel: { label: "Hostel", icon: Tent },
  apartment: { label: "Apartment", icon: Building2 },
  tour: { label: "Tour", icon: Compass },
  other: { label: "Other", icon: Package },
};

export { Receipt, Bike };
