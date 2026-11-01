"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { Building2, Camera, FileText, Flag, Loader2, MapPin, Moon, Plane, Plus } from "lucide-react";
import { useTheme } from "next-themes";
import { getSearchIndex, type SearchItem } from "@/actions/search";
import { NAV_GROUPS, SETTINGS_ITEM } from "@/lib/nav";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from "@/components/ui/command";
import { Kbd } from "@/components/ui/misc";
import { QUICK_ADD_ITEMS } from "./quick-add-menu";
import { useWorkspace } from "./workspace";

const GROUP_ICON = { Trips: Plane, Countries: Flag, Cities: Building2, Places: MapPin, Memories: Camera, Documents: FileText } as const;

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();
  const ws = useWorkspace();
  const { resolvedTheme, setTheme } = useTheme();
  const [items, setItems] = useState<SearchItem[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    const t = setTimeout(() => setLoading(true), 0);
    void getSearchIndex().then((res) => {
      if (!alive) return;
      setItems(res.ok ? res.data : []);
      setLoading(false);
    });
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [open]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const groups = (["Trips", "Countries", "Cities", "Places", "Memories", "Documents"] as const).map((g) => ({
    g,
    list: (items ?? []).filter((i) => i.group === g),
  }));

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-overlay backdrop-blur-[2px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content className="fixed left-1/2 top-[12vh] z-50 w-[calc(100vw-1.5rem)] max-w-xl -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.98]">
          <DialogPrimitive.Title className="sr-only">Search and commands</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Search countries, cities, places, memories and documents, or run a quick action.</DialogPrimitive.Description>
          <Command
            loop
            filter={(value, search, keywords) => {
              const q = search.toLowerCase().trim();
              if (!q) return 1;
              const title = (keywords?.[0] ?? value).toLowerCase();
              const hay = [value, ...(keywords ?? [])].join(" ").toLowerCase();
              if (title.startsWith(q)) return 1;
              if (title.split(/\s+/).some((w) => w.startsWith(q))) return 0.9;
              if (title.includes(q)) return 0.8;
              if (hay.includes(q)) return 0.5;
              return q.split(/\s+/).every((w) => hay.includes(w)) ? 0.3 : 0;
            }}
          >
            <CommandInput placeholder="Search places, cities, memories… or type a command" autoFocus />
            <CommandList>
              <CommandEmpty>{loading ? "Loading…" : "No results."}</CommandEmpty>
              <CommandGroup heading="Quick actions">
                {QUICK_ADD_ITEMS.map((q) => (
                  <CommandItem key={q.kind} value={`add-${q.kind}`} keywords={[`Add ${q.label.toLowerCase()}`, "new", "create"]} onSelect={() => (onOpenChange(false), ws.openQuickAdd(q.kind))}>
                    <Plus /> Add {q.label.toLowerCase()}
                  </CommandItem>
                ))}
                <CommandItem value="add-trip" keywords={["New trip", "add", "create"]} onSelect={() => (onOpenChange(false), ws.openQuickAdd("trip"))}>
                  <Plus /> New trip
                </CommandItem>
                <CommandItem value="add-booking" keywords={["Add booking", "flight", "hotel", "train"]} onSelect={() => (onOpenChange(false), ws.openQuickAdd("booking"))}>
                  <Plus /> Add booking
                </CommandItem>
                <CommandItem value="toggle-theme" keywords={["Toggle dark mode", "theme", "light"]} onSelect={() => (setTheme(resolvedTheme === "dark" ? "light" : "dark"), onOpenChange(false))}>
                  <Moon /> Toggle dark mode
                </CommandItem>
              </CommandGroup>
              {loading && !items && (
                <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted">
                  <Loader2 className="size-4 animate-spin" /> Loading your data…
                </div>
              )}
              {groups.map(({ g, list }) =>
                list.length ? (
                  <CommandGroup key={g} heading={g}>
                    {list.slice(0, 50).map((i) => {
                      const Icon = GROUP_ICON[g];
                      return (
                        <CommandItem key={`${g}-${i.id}`} value={`${g}-${i.id}`} keywords={[i.title, i.subtitle ?? "", g]} onSelect={() => go(i.href)}>
                          {i.icon ? <span className="w-4 text-center text-base leading-none">{i.icon}</span> : <Icon />}
                          <span className="min-w-0 flex-1 truncate">{i.title}</span>
                          {i.subtitle ? <span className="truncate text-xs text-muted">{i.subtitle}</span> : null}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                ) : null,
              )}
              <CommandSeparator />
              <CommandGroup heading="Go to">
                {[...NAV_GROUPS.flatMap((g) => g.items), SETTINGS_ITEM].map((n) => (
                  <CommandItem key={n.href} value={`go-${n.href}`} keywords={[n.label, "go to"]} onSelect={() => go(n.href)}>
                    <n.icon /> {n.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
            <div className="flex items-center justify-between border-t border-border bg-surface-2 px-4 py-2 text-xs text-muted">
              <span>
                <Kbd>↑</Kbd> <Kbd>↓</Kbd> to move · <Kbd>↵</Kbd> to open
              </span>
              <span>
                <Kbd>Esc</Kbd> to close
              </span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
