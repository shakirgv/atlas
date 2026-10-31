import { CircleCheck, CircleDashed, Heart, Navigation, Plane, Sparkles, Star, Compass } from "lucide-react";
import { GEO_STATUS_META, PLACE_STATUS_META, TRIP_STATUS_META } from "@/lib/status";
import type { DisplayStatus, PlaceStatus, TripStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const GEO_ICONS = { visited: CircleCheck, planned: CircleDashed, wishlist: Heart, ongoing: Navigation };
const TRIP_ICONS = { dreaming: Sparkles, planning: Compass, ongoing: Plane, completed: CircleCheck };
const PLACE_ICONS = { want: Star, planned: CircleDashed, visited: CircleCheck };

type Props = { className?: string; onPhoto?: boolean; size?: "sm" | "md" };

function Chip({
  label,
  color,
  soft,
  Icon,
  className,
  onPhoto,
  size = "md",
}: Props & { label: string; color: string; soft: string; Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }> }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full font-medium",
        size === "sm" ? "h-6 px-2 text-[11px]" : "h-7 px-2.5 text-xs",
        onPhoto ? "bg-black/45 text-white backdrop-blur-md" : "text-ink",
        className,
      )}
      style={onPhoto ? undefined : { background: soft }}
    >
      <Icon className={size === "sm" ? "size-3" : "size-3.5"} style={{ color: onPhoto ? undefined : color }} />
      {label}
    </span>
  );
}

export function GeoStatusChip({ status, ...props }: Props & { status: DisplayStatus }) {
  const meta = GEO_STATUS_META[status] ?? GEO_STATUS_META.planned;
  return <Chip label={meta.label} color={meta.color} soft={meta.soft} Icon={GEO_ICONS[status] ?? CircleDashed} {...props} />;
}

export function TripStatusChip({ status, ...props }: Props & { status: TripStatus }) {
  const meta = TRIP_STATUS_META[status] ?? TRIP_STATUS_META.planning;
  return <Chip label={meta.label} color={meta.color} soft={meta.soft} Icon={TRIP_ICONS[status] ?? Compass} {...props} />;
}

export function PlaceStatusChip({ status, ...props }: Props & { status: PlaceStatus }) {
  const meta = PLACE_STATUS_META[status] ?? PLACE_STATUS_META.want;
  return <Chip label={meta.label} color={meta.color} soft={meta.soft} Icon={PLACE_ICONS[status] ?? Star} {...props} />;
}
