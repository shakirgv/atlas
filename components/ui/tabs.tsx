"use client";
import * as React from "react";
import { Tabs as P } from "radix-ui";
import { cn } from "@/lib/utils";

export const Tabs = P.Root;

export function TabsList({ className, ...props }: React.ComponentProps<typeof P.List>) {
  return (
    <P.List
      className={cn(
        "scrollbar-none -mx-1 flex items-center gap-1 overflow-x-auto border-b border-border px-1",
        className,
      )}
      {...props}
    />
  );
}

export function TabsTrigger({ className, ...props }: React.ComponentProps<typeof P.Trigger>) {
  return (
    <P.Trigger
      className={cn(
        "relative -mb-px inline-flex h-11 shrink-0 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-muted transition-colors hover:text-ink data-[state=active]:border-accent data-[state=active]:text-ink [&_svg]:size-4",
        className,
      )}
      {...props}
    />
  );
}

export function TabsContent({ className, ...props }: React.ComponentProps<typeof P.Content>) {
  return <P.Content className={cn("pt-6 outline-none", className)} {...props} />;
}
