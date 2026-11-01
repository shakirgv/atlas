"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, Search } from "lucide-react";
import { titleForPath } from "@/lib/nav";
import { Kbd } from "@/components/ui/misc";
import { QuickAddMenu } from "./quick-add-menu";
import { TripSwitcher } from "./trip-switcher";
import { useWorkspace } from "./workspace";

export function Topbar() {
  const pathname = usePathname();
  const ws = useWorkspace();
  const title = titleForPath(pathname);
  return (
    <header className="no-print sticky top-0 z-30 border-b border-border/70 bg-bg/75 backdrop-blur-xl supports-[backdrop-filter]:bg-bg/65">
      <div className="mx-auto flex h-14 max-w-[1280px] items-center gap-3 px-4 md:h-16 md:px-8">
        <Link href="/" className="grid size-8 place-items-center rounded-lg bg-ink text-bg md:hidden" aria-label="Home">
          <Compass className="size-4" />
        </Link>
        <p className="truncate font-display text-lg font-semibold md:text-xl" aria-live="polite">
          {title}
        </p>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={ws.openPalette}
            className="flex h-9 items-center gap-2 rounded-[10px] border border-border bg-surface px-3 text-sm text-muted shadow-[0_1px_2px_rgb(0_0_0/0.04)] transition-colors hover:text-ink max-md:size-10 max-md:justify-center max-md:px-0 md:w-56 lg:w-72"
            aria-label="Search (Ctrl+K)"
          >
            <Search className="size-4" />
            <span className="hidden flex-1 text-left md:inline">Search anything…</span>
            <Kbd className="hidden md:inline-flex">⌘K</Kbd>
          </button>
          <div className="hidden md:block">
            <QuickAddMenu />
          </div>
          <div className="md:hidden">
            <TripSwitcher collapsed />
          </div>
        </div>
      </div>
    </header>
  );
}
