import { countryFlag, countryName } from "@/lib/countries";
import { cn } from "@/lib/utils";

/** Rounded-square flag chip for tight spots. */
export function FlagChip({ code, className, size = "md", onPhoto }: { code: string; className?: string; size?: "sm" | "md" | "lg"; onPhoto?: boolean }) {
  return (
    <span
      role="img"
      aria-label={`${countryName(code)} flag`}
      className={cn(
        "inline-grid shrink-0 place-items-center rounded-[8px]",
        onPhoto ? "bg-black/45 backdrop-blur-md" : "bg-surface-2 ring-1 ring-border",
        size === "sm" && "size-6 text-sm rounded-md",
        size === "md" && "size-8 text-lg",
        size === "lg" && "size-12 text-xl rounded-xl",
        // After the font size: tailwind-merge drops a line height set before one.
        "leading-none",
        className,
      )}
    >
      {/* The outline keeps a flag's black bands visible on the dark chip. */}
      <span className={cn(onPhoto && "drop-shadow-[0_0_1px_rgb(255_255_255/0.7)]")}>{countryFlag(code)}</span>
    </span>
  );
}
