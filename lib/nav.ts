import {
  BarChart3,
  Building2,
  CalendarDays,
  Camera,
  Earth,
  FileText,
  Flag,
  LayoutDashboard,
  Luggage,
  type LucideIcon,
  MapPin,
  Plane,
  Settings,
  Ticket,
  Wallet,
} from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };

export const NAV_GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Overview",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/map", label: "World Map", icon: Earth },
      { href: "/stats", label: "Travel Stats", icon: BarChart3 },
    ],
  },
  {
    label: "Plan",
    items: [
      { href: "/trips", label: "Trips", icon: Plane },
      { href: "/countries", label: "Countries", icon: Flag },
      { href: "/cities", label: "Cities", icon: Building2 },
      { href: "/places", label: "Places", icon: MapPin },
      { href: "/itinerary", label: "Itinerary", icon: CalendarDays },
      { href: "/bookings", label: "Bookings", icon: Ticket },
      { href: "/packing", label: "Packing", icon: Luggage },
    ],
  },
  {
    label: "Track",
    items: [
      { href: "/budget", label: "Budget", icon: Wallet },
      { href: "/memories", label: "Memories", icon: Camera },
      { href: "/documents", label: "Documents", icon: FileText },
    ],
  },
];

export const SETTINGS_ITEM: NavItem = { href: "/settings", label: "Settings", icon: Settings };

export const MOBILE_TABS: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/map", label: "Map", icon: Earth },
  { href: "/trips", label: "Trips", icon: Plane },
  { href: "/budget", label: "Budget", icon: Wallet },
];

const ALL_ITEMS = [...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM];

export function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function titleForPath(pathname: string) {
  const match = [...ALL_ITEMS].sort((a, b) => b.href.length - a.href.length).find((i) => isActive(pathname, i.href));
  return match?.label ?? "Atlas";
}
