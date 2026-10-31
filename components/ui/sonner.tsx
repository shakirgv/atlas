"use client";
import { Toaster as Sonner } from "sonner";
import { useTheme } from "next-themes";

export function Toaster() {
  const { resolvedTheme } = useTheme();
  return (
    <Sonner
      position="bottom-center"
      theme={(resolvedTheme as "light" | "dark") ?? "light"}
      offset={{ bottom: 24 }}
      mobileOffset={{ bottom: 88 }}
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border-border !bg-surface !text-ink !shadow-lg !font-sans",
          description: "!text-muted",
          actionButton: "!bg-ink !text-bg",
        },
      }}
    />
  );
}
