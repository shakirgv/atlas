"use client";
import * as React from "react";
import { Tooltip as P } from "radix-ui";
import { cn } from "@/lib/utils";

export const TooltipProvider = P.Provider;

export function Tooltip({ content, children, side = "top" }: { content: React.ReactNode; children: React.ReactNode; side?: "top" | "right" | "bottom" | "left" }) {
  return (
    <P.Root>
      <P.Trigger asChild>{children}</P.Trigger>
      <P.Portal>
        <P.Content
          side={side}
          sideOffset={6}
          className={cn(
            "z-50 rounded-lg bg-ink px-2.5 py-1.5 text-xs font-medium text-bg shadow-lg data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0",
          )}
        >
          {content}
        </P.Content>
      </P.Portal>
    </P.Root>
  );
}
