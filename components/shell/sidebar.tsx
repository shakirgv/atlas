"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Compass, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { signOut } from "@/actions/auth";
import { updateSettings } from "@/actions/settings";
import { APP_NAME } from "@/lib/config";
import { NAV_GROUPS, SETTINGS_ITEM, isActive, type NavItem } from "@/lib/nav";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { ThemeToggle } from "./theme-toggle";
import { TripSwitcher } from "./trip-switcher";

function NavLink({ item, collapsed, pathname }: { item: NavItem; collapsed: boolean; pathname: string }) {
  const active = isActive(pathname, item.href);
  const link = (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-3 rounded-[10px] px-2.5 text-sm font-medium text-ink/70 transition-colors hover:bg-ink/5 hover:text-ink dark:hover:bg-white/5",
        active && "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.06)] ring-1 ring-border hover:bg-surface dark:hover:bg-surface",
        collapsed && "justify-center px-0",
      )}
    >
      <item.icon className={cn("size-[18px] shrink-0", active ? "text-accent" : "text-muted group-hover:text-ink")} strokeWidth={1.9} />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
  return collapsed ? (
    <Tooltip content={item.label} side="right">
      {link}
    </Tooltip>
  ) : (
    link
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const pathname = usePathname();
  return (
    <aside
      className={cn(
        "sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-border bg-bg/80 px-3 pb-3 pt-4 transition-[width] duration-200 md:flex",
        collapsed ? "w-[72px]" : "w-64",
      )}
      aria-label="Main navigation"
    >
      <div className={cn("mb-4 flex items-center gap-2 px-1", collapsed && "justify-center px-0")}>
        <Link href="/" className="flex items-center gap-2.5" aria-label={`${APP_NAME} home`}>
          <span className="grid size-9 place-items-center rounded-xl bg-ink text-bg shadow-sm">
            <Compass className="size-5" />
          </span>
          {!collapsed && <span className="font-display text-[22px] font-semibold tracking-tight">{APP_NAME}</span>}
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={onToggle}
            className="ml-auto grid size-8 place-items-center rounded-lg text-muted hover:bg-ink/5 hover:text-ink dark:hover:bg-white/5"
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>
      <TripSwitcher collapsed={collapsed} />
      <nav className="scrollbar-none mt-4 flex flex-1 flex-col gap-5 overflow-y-auto">
        {NAV_GROUPS.map((g) => (
          <div key={g.label} className="flex flex-col gap-0.5">
            {!collapsed ? (
              <div className="px-2.5 pb-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted">{g.label}</div>
            ) : (
              <div className="mx-auto mb-1.5 h-px w-6 bg-border" />
            )}
            {g.items.map((item) => (
              <NavLink key={item.href} item={item} collapsed={collapsed} pathname={pathname} />
            ))}
          </div>
        ))}
      </nav>
      <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
        <NavLink item={SETTINGS_ITEM} collapsed={collapsed} pathname={pathname} />
        <ThemeToggle collapsed={collapsed} onChange={(theme) => void updateSettings({ theme })} />
        <div className={cn("flex items-center gap-1", collapsed && "flex-col")}>
          <form action={signOut} className={cn(!collapsed && "flex-1")}>
            <button
              type="submit"
              className={cn(
                "flex h-9 w-full items-center gap-3 rounded-[10px] px-2.5 text-sm font-medium text-ink/70 hover:bg-ink/5 hover:text-ink dark:hover:bg-white/5",
                collapsed && "size-10 justify-center px-0",
              )}
              aria-label="Sign out"
            >
              <LogOut className="size-[18px] text-muted" />
              {!collapsed && "Sign out"}
            </button>
          </form>
          {collapsed && (
            <button
              type="button"
              onClick={onToggle}
              className="grid size-10 place-items-center rounded-xl text-muted hover:bg-ink/5 hover:text-ink dark:hover:bg-white/5"
              aria-label="Expand sidebar"
            >
              <PanelLeftOpen className="size-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
