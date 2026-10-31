"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const subscribe = () => () => {};

export function ThemeToggle({ collapsed, onChange }: { collapsed?: boolean; onChange?: (theme: "light" | "dark" | "system") => void }) {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const current = mounted ? (theme ?? "system") : "system";
  if (collapsed) {
    const next = resolvedTheme === "dark" ? "light" : "dark";
    return (
      <button
        type="button"
        onClick={() => {
          setTheme(next);
          onChange?.(next);
        }}
        className="grid size-10 place-items-center rounded-xl text-muted transition-colors hover:bg-ink/5 hover:text-ink dark:hover:bg-white/5"
        aria-label="Toggle theme"
      >
        {mounted && resolvedTheme === "dark" ? <Sun className="size-[18px]" /> : <Moon className="size-[18px]" />}
      </button>
    );
  }
  return (
    <div role="radiogroup" aria-label="Theme" className="flex rounded-xl border border-border bg-surface p-0.5">
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={current === o.value}
          aria-label={o.label}
          onClick={() => {
            setTheme(o.value);
            onChange?.(o.value);
          }}
          className={cn(
            "grid h-8 flex-1 place-items-center rounded-[10px] text-muted transition-colors hover:text-ink",
            current === o.value && "bg-ink text-bg hover:text-bg",
          )}
        >
          <o.icon className="size-4" />
        </button>
      ))}
    </div>
  );
}
