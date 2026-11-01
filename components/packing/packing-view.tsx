"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, Check, Copy, Layers, Luggage, MoreHorizontal, Plus, RotateCcw, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { addPackingItems, deletePackingItem, deleteTemplate, resetPacking, saveAsTemplate, togglePacked } from "@/actions/packing";
import { BUILTIN_TEMPLATES, PACKING_CATEGORIES } from "@/lib/packing-templates";
import type { PackingItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/empty-state";
import { MigrationNotice } from "@/components/common/migration-notice";
import { PageHeader } from "@/components/common/page-header";
import { PageTransition } from "@/components/common/motion";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input, NativeSelect } from "@/components/ui/input";
import { Checkbox, Progress } from "@/components/ui/misc";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkspace } from "@/components/shell/workspace";

type Tpl = { id?: string; name: string; items: { label: string; category: string }[] };

export function PackingView({
  trip,
  trips,
  items,
  templates,
  missingTable,
}: {
  trip: { id: string; title: string } | null;
  trips: { id: string; title: string }[];
  items: PackingItem[];
  templates: Tpl[];
  missingTable: boolean;
}) {
  const ws = useWorkspace();
  const router = useRouter();
  const confirm = useConfirm();
  const [label, setLabel] = useState("");
  const [category, setCategory] = useState("General");
  const [tplName, setTplName] = useState("");
  const [optimistic, setOptimistic] = useState<Record<string, boolean>>({});
  const [pending, start] = useTransition();

  const packedOf = (i: PackingItem) => optimistic[i.id] ?? i.packed;
  const done = items.filter(packedOf).length;
  const grouped = useMemo(() => {
    const cats = Array.from(new Set([...PACKING_CATEGORIES, ...items.map((i) => i.category)]));
    return cats.map((c) => ({ c, list: items.filter((i) => i.category === c) })).filter((g) => g.list.length);
  }, [items]);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, msg?: string) =>
    start(async () => {
      const res = await fn();
      if (!res.ok) return void toast.error(res.error ?? "Failed");
      if (msg) toast.success(msg);
    });

  const applyTemplate = (t: Tpl) => trip && run(() => addPackingItems(trip.id, t.items), `Added “${t.name}”`);

  if (missingTable) {
    return (
      <PageTransition>
        <PageHeader eyebrow="Plan" title="Packing" />
        <MigrationNotice />
      </PageTransition>
    );
  }
  if (!trip) {
    return (
      <PageTransition>
        <PageHeader eyebrow="Plan" title="Packing" />
        <EmptyState icon={Luggage} title="Create a trip first" description="Each trip gets its own packing list." action={<Button onClick={() => ws.openQuickAdd("trip")}><Plus /> New trip</Button>} />
      </PageTransition>
    );
  }

  const templateMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary">
          <Layers /> Templates
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-64">
        <DropdownMenuLabel>Add from a template</DropdownMenuLabel>
        {BUILTIN_TEMPLATES.map((t) => (
          <DropdownMenuItem key={t.name} onSelect={() => applyTemplate(t)}>
            <Layers /> {t.name} <span className="ml-auto text-xs text-muted">{t.items.length}</span>
          </DropdownMenuItem>
        ))}
        {templates.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Your templates</DropdownMenuLabel>
            {templates.map((t) => (
              <DropdownMenuItem key={t.id} onSelect={() => applyTemplate(t)}>
                <BookmarkPlus /> {t.name}
                <button
                  type="button"
                  className="ml-auto rounded p-1 text-muted hover:text-danger"
                  aria-label={`Delete template ${t.name}`}
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (await confirm({ title: `Delete template “${t.name}”?`, confirmLabel: "Delete template" })) run(() => deleteTemplate(t.id!), "Template deleted");
                  }}
                >
                  <X className="size-3.5" />
                </button>
              </DropdownMenuItem>
            ))}
          </>
        )}
        {trips.length > 1 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Copy from another trip</DropdownMenuLabel>
            {trips
              .filter((t) => t.id !== trip.id)
              .map((t) => (
                <DropdownMenuItem
                  key={t.id}
                  onSelect={() =>
                    start(async () => {
                      const res = await fetch(`/api/packing/copy?from=${t.id}&to=${trip.id}`, { method: "POST" });
                      if (!res.ok) return void toast.error("Copy failed");
                      toast.success(`Copied from ${t.title}`);
                      router.refresh();
                    })
                  }
                >
                  <Copy /> {t.title}
                </DropdownMenuItem>
              ))}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <PageTransition className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Plan"
        title="Packing"
        description={items.length ? `${done} of ${items.length} packed for ${trip.title}` : `Your checklist for ${trip.title}.`}
        actions={
          <>
            {trips.length > 1 && (
              <NativeSelect value={trip.id} onChange={(e) => router.push(`/packing?trip=${e.target.value}`)} aria-label="Trip" className="w-52">
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </NativeSelect>
            )}
            {templateMenu}
          </>
        }
      />
      <form
        className="card flex flex-col gap-2 p-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          const parts = label.split(",").map((s) => s.trim()).filter(Boolean);
          if (!parts.length) return;
          setLabel("");
          run(() => addPackingItems(trip.id, parts.map((l) => ({ label: l, category }))));
        }}
      >
        <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Add items — comma separated (e.g. Passport, Charger)" aria-label="New item" className="flex-1" />
        <div className="flex gap-2">
          <NativeSelect value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className="w-40">
            {PACKING_CATEGORIES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </NativeSelect>
          <Button type="submit" disabled={pending || !label.trim()}>
            <Plus /> Add
          </Button>
        </div>
      </form>
      {!items.length ? (
        <EmptyState
          icon={Luggage}
          title="Nothing on the list yet"
          description="Start from a template and tweak it, or type your own items above."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              {BUILTIN_TEMPLATES.slice(0, 3).map((t) => (
                <Button key={t.name} variant="secondary" size="sm" onClick={() => applyTemplate(t)}>
                  <Layers /> {t.name}
                </Button>
              ))}
            </div>
          }
        />
      ) : (
        <>
          <div className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
            <div className="flex-1">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="font-display text-2xl font-semibold">
                  <span className="num">{Math.round((done / items.length) * 100)}%</span> packed
                </span>
                <span className="num text-sm text-muted">
                  {done}/{items.length}
                </span>
              </div>
              <Progress value={(done / items.length) * 100} color="var(--visited)" />
            </div>
            <div className="flex gap-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="secondary" size="sm">
                    <BookmarkPlus /> Save as template
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end">
                  <form
                    className="flex flex-col gap-2"
                    onSubmit={(e) => {
                      e.preventDefault();
                      run(() => saveAsTemplate(trip.id, tplName), "Template saved");
                      setTplName("");
                    }}
                  >
                    <p className="text-sm font-medium">Name this template</p>
                    <Input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder="City break" autoFocus aria-label="Template name" />
                    <Button type="submit" size="sm" disabled={!tplName.trim()}>
                      Save
                    </Button>
                  </form>
                </PopoverContent>
              </Popover>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon-sm" aria-label="More">
                    <MoreHorizontal />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem onSelect={() => run(() => resetPacking(trip.id, "unpack"), "Everything unpacked")}>
                    <RotateCcw /> Unpack all
                  </DropdownMenuItem>
                  <DropdownMenuItem destructive onSelect={async () => (await confirm({ title: "Clear the whole list?", confirmLabel: "Clear list" })) && run(() => resetPacking(trip.id, "clear"), "List cleared")}>
                    <Trash2 /> Clear list
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="columns-1 gap-4 md:columns-2 xl:columns-3 [&>*]:mb-4 [&>*]:break-inside-avoid">
            {grouped.map(({ c, list }) => {
              const packed = list.filter(packedOf).length;
              return (
                <section key={c} className="card p-4" aria-label={c}>
                  <h2 className="mb-2 flex items-center justify-between text-lg font-semibold">
                    {c}
                    <span className={cn("num rounded-full px-2 py-0.5 text-xs font-medium", packed === list.length ? "bg-visited-soft text-ink" : "text-muted")}>
                      {packed === list.length ? <Check className="inline size-3" /> : null} {packed}/{list.length}
                    </span>
                  </h2>
                  <ul className="flex flex-col">
                    {list.map((i) => (
                      <li key={i.id} className="group flex items-center gap-3 rounded-lg px-1 py-1.5 hover:bg-ink/[0.03]">
                        <Checkbox
                          id={`pk-${i.id}`}
                          checked={packedOf(i)}
                          onCheckedChange={(v) => {
                            setOptimistic((o) => ({ ...o, [i.id]: Boolean(v) }));
                            run(() => togglePacked(i.id, Boolean(v)));
                          }}
                        />
                        <label htmlFor={`pk-${i.id}`} className={cn("flex-1 cursor-pointer text-sm", packedOf(i) && "text-muted line-through")}>
                          {i.label}
                        </label>
                        <button type="button" onClick={() => run(() => deletePackingItem(i.id))} className="grid size-7 place-items-center rounded text-muted opacity-0 hover:text-danger group-hover:opacity-100 focus-visible:opacity-100 max-md:opacity-100" aria-label={`Remove ${i.label}`}>
                          <X className="size-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        </>
      )}
    </PageTransition>
  );
}
