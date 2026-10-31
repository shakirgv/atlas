"use client";
import * as React from "react";
import { DropdownMenu as P } from "radix-ui";
import { cn } from "@/lib/utils";

export const DropdownMenu = P.Root;
export const DropdownMenuTrigger = P.Trigger;
export const DropdownMenuGroup = P.Group;

export function DropdownMenuContent({ className, sideOffset = 6, align = "end", ...props }: React.ComponentProps<typeof P.Content>) {
  return (
    <P.Portal>
      <P.Content
        sideOffset={sideOffset}
        align={align}
        className={cn(
          "z-50 min-w-48 overflow-hidden rounded-xl border border-border bg-surface p-1.5 text-ink shadow-lg data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          className,
        )}
        {...props}
      />
    </P.Portal>
  );
}

export function DropdownMenuItem({ className, destructive, ...props }: React.ComponentProps<typeof P.Item> & { destructive?: boolean }) {
  return (
    <P.Item
      className={cn(
        "relative flex cursor-default select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-ink/5 dark:data-[highlighted]:bg-white/5 [&_svg]:size-4 [&_svg]:text-muted max-md:py-2.5",
        destructive && "text-danger [&_svg]:text-danger",
        className,
      )}
      {...props}
    />
  );
}

export function DropdownMenuLabel({ className, ...props }: React.ComponentProps<typeof P.Label>) {
  return <P.Label className={cn("px-2.5 py-1.5 text-xs font-medium uppercase tracking-wider text-muted", className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: React.ComponentProps<typeof P.Separator>) {
  return <P.Separator className={cn("-mx-1.5 my-1.5 h-px bg-border", className)} {...props} />;
}

export function DropdownMenuRadioGroup(props: React.ComponentProps<typeof P.RadioGroup>) {
  return <P.RadioGroup {...props} />;
}

export function DropdownMenuRadioItem({ className, children, ...props }: React.ComponentProps<typeof P.RadioItem>) {
  return (
    <P.RadioItem
      className={cn(
        "relative flex cursor-default select-none items-center gap-2.5 rounded-lg py-2 pl-8 pr-2.5 text-sm outline-none data-[highlighted]:bg-ink/5 dark:data-[highlighted]:bg-white/5",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2.5 flex size-3.5 items-center justify-center">
        <P.ItemIndicator>
          <span className="block size-2 rounded-full bg-accent" />
        </P.ItemIndicator>
      </span>
      {children}
    </P.RadioItem>
  );
}
