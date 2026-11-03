"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Download, FileCode2, Loader2, Share2 } from "lucide-react";
import { toast } from "sonner";
import { canShareFile, copyImage, downloadBlob, embedFonts, fileSlug, fontStack, serializeSvg, svgToPng } from "@/lib/export-image";
import { EXPORT_ASPECTS, EXPORT_PRESETS, exportPresetFor, exportSize, exportStats, type ExportAspect, type ExportPreset, type ExportTheme } from "@/lib/map-export";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Field, Input, NativeSelect } from "@/components/ui/input";
import { Segmented, Switch } from "@/components/ui/misc";
import { ResponsiveDialog } from "@/components/ui/responsive-dialog";
import { ExportMap, type ExportContent, type ExportOptions } from "./export-map";
import type { MapCity, RoutePoint } from "./world-map";

export type ExportTrip = { id: string; title: string; routes: RoutePoint[][]; cities: MapCity[]; countries: { code: string; status: string }[] };

const ALL = "all";

function Toggle({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className={cn("flex min-h-9 items-center justify-between gap-3 text-sm", disabled && "text-muted")}>
      {label}
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} disabled={disabled} />
    </label>
  );
}

function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col border-t border-border pt-3">
      <legend className="float-left mb-1 w-full text-[13px] font-medium text-ink/90">{title}</legend>
      <div className="clear-both flex flex-col">{children}</div>
    </fieldset>
  );
}

/** Live preview on the left: what you see is the SVG that gets exported. */
export function ExportDialog({ trips, activeTripId, onOpenChange }: { trips: ExportTrip[]; activeTripId: string | null; onOpenChange: (open: boolean) => void }) {
  const [scope, setScope] = useState(activeTripId ?? ALL);
  const active = trips.find((t) => t.id === scope);
  const [aspect, setAspect] = useState<ExportAspect>("9:16");
  const [theme, setTheme] = useState<ExportTheme>("dark");
  const [scale, setScale] = useState(2);
  const [title, setTitle] = useState(active?.title ?? "My travels");
  const [touchedTitle, setTouchedTitle] = useState(false);
  const [show, setShow] = useState<ExportOptions["show"]>({ ...EXPORT_PRESETS.detailed.layers, stats: true, legend: true });
  const preset = exportPresetFor(show);
  const [busy, setBusy] = useState<string | null>(null);
  const [fonts, setFonts] = useState({ display: "serif", body: "sans-serif" });
  const [canShare, setCanShare] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const size = exportSize(aspect, scale);

  useEffect(() => {
    const t = setTimeout(() => {
      setFonts({ display: fontStack("--font-fraunces"), body: fontStack("--font-geist") });
      setCanShare(canShareFile(new File([new Blob(["x"], { type: "image/png" })], "x.png", { type: "image/png" })));
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const content = useMemo<ExportContent>(() => {
    const list = active ? [active] : trips;
    const countries = list.flatMap((t) => t.countries);
    const states: Record<string, string> = {};
    const rank: Record<string, number> = { wishlist: 0, planned: 1, visited: 2 };
    for (const c of countries) if ((rank[c.status] ?? 0) >= (rank[states[c.code] ?? ""] ?? -1)) states[c.code] = c.status;
    const cities = list.flatMap((t) => t.cities);
    return { states, routes: list.flatMap((t) => t.routes), cities, stats: exportStats(countries, cities.length) };
  }, [active, trips]);

  const name = `${fileSlug(title, "atlas-map")}-${aspect.replace(":", "x")}`;
  const options: ExportOptions = { aspect, theme, title, show };

  const render = async () => {
    if (!svg.current) throw new Error("The preview isn't ready.");
    const css = await embedFonts([fonts.display, fonts.body]);
    return serializeSvg(svg.current, size, css);
  };
  const run = async (key: string, task: () => Promise<void>) => {
    setBusy(key);
    try {
      await task();
    } catch (e) {
      // Closing the share sheet is not a failure.
      if (!(e instanceof DOMException && e.name === "AbortError")) toast.error(e instanceof Error ? e.message : "Could not export the image.");
    } finally {
      setBusy(null);
    }
  };

  const png = () =>
    run("png", async () => {
      downloadBlob(await svgToPng(await render(), size), `${name}.png`);
    });
  const svgFile = () =>
    run("svg", async () => {
      downloadBlob(new Blob([await render()], { type: "image/svg+xml" }), `${name}.svg`);
    });
  const copy = () =>
    run("copy", async () => {
      await copyImage(await svgToPng(await render(), size));
      toast.success("Image copied");
    });
  const share = () =>
    run("share", async () => {
      const blob = await svgToPng(await render(), size);
      await navigator.share({ files: [new File([blob], `${name}.png`, { type: "image/png" })], title });
    });

  return (
    <ResponsiveDialog
      open
      onOpenChange={onOpenChange}
      title="Export map image"
      description="A picture of your map for stories, wallpapers or printing."
      className="max-w-5xl"
      bodyClassName="md:overflow-y-hidden"
      footer={
        <>
          <Button variant="secondary" onClick={svgFile} disabled={Boolean(busy)}>
            {busy === "svg" ? <Loader2 className="animate-spin" /> : <FileCode2 />} SVG
          </Button>
          <Button variant="secondary" onClick={copy} disabled={Boolean(busy)}>
            {busy === "copy" ? <Loader2 className="animate-spin" /> : <Copy />} Copy image
          </Button>
          {canShare && (
            <Button variant="secondary" onClick={share} disabled={Boolean(busy)}>
              {busy === "share" ? <Loader2 className="animate-spin" /> : <Share2 />} Share
            </Button>
          )}
          <Button onClick={png} disabled={Boolean(busy)}>
            {busy === "png" ? <Loader2 className="animate-spin" /> : <Download />} Download PNG
          </Button>
        </>
      }
    >
      {/* Only the settings scroll: the preview stays in view (pinned to the top of the sheet on phones). */}
      <div className="grid gap-5 pb-2 md:h-[calc(min(88vh,820px)-13rem)] md:grid-cols-[minmax(0,1fr)_280px] md:grid-rows-[minmax(0,1fr)] md:pb-0">
        <div
          className={cn("z-10 grid h-[32dvh] place-items-center overflow-hidden rounded-xl p-3 max-md:sticky max-md:top-0 max-md:shadow-[0_-12px_0_var(--surface),0_8px_12px_-8px_rgb(0_0_0/0.2)] md:h-full", theme === "transparent" ? "bg-[conic-gradient(#ddd_25%,#fff_0_50%,#ddd_0_75%,#fff_0)] bg-[length:20px_20px]" : "bg-surface-2")}
          data-testid="export-preview"
        >
          <ExportMap ref={svg} options={options} content={content} display={fonts.display} body={fonts.body} className="max-h-full max-w-full rounded-lg shadow-lift" />
        </div>
        <div className="flex flex-col gap-3.5 md:min-h-0 md:overflow-y-auto md:pl-1 md:pr-3" data-testid="export-settings">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink/90">Preset</span>
            <Segmented<ExportPreset> size="sm" className="w-full [&>button]:flex-1 [&>button]:justify-center" value={preset ?? ("" as ExportPreset)} onChange={(p) => setShow({ ...show, ...EXPORT_PRESETS[p].layers })} options={(Object.keys(EXPORT_PRESETS) as ExportPreset[]).map((p) => ({ value: p, label: EXPORT_PRESETS[p].label }))} />
            <span className="text-xs text-muted" data-testid="export-preset-hint">
              {preset ? EXPORT_PRESETS[preset].hint : "Custom: adjusted by hand. Pick a preset to reset the map layers."}
            </span>
          </div>
          <Field label="Title" htmlFor="export-title">
            <Input
              id="export-title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setTouchedTitle(true);
              }}
            />
          </Field>
          {trips.length > 0 && (
            <Field label="Show" htmlFor="export-scope">
              <NativeSelect
                id="export-scope"
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value);
                  if (!touchedTitle) setTitle(trips.find((t) => t.id === e.target.value)?.title ?? "My travels");
                }}
              >
                <option value={ALL}>All trips</option>
                {trips.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </NativeSelect>
            </Field>
          )}
          <Field label="Shape" htmlFor="export-aspect">
            <NativeSelect id="export-aspect" value={aspect} onChange={(e) => setAspect(e.target.value as ExportAspect)}>
              {(Object.keys(EXPORT_ASPECTS) as ExportAspect[]).map((a) => (
                <option key={a} value={a}>
                  {EXPORT_ASPECTS[a].label} ({a === "a3" ? "print" : a})
                </option>
              ))}
            </NativeSelect>
          </Field>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink/90">Theme</span>
            <Segmented size="sm" value={theme} onChange={setTheme} options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }, { value: "transparent", label: "Clear" }]} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-medium text-ink/90">Resolution</span>
            <Segmented size="sm" value={String(scale)} onChange={(v) => setScale(Number(v))} options={[{ value: "1", label: "1x" }, { value: "2", label: "2x" }, { value: "3", label: "3x" }]} />
            <span className="num text-xs text-muted" data-testid="export-size">
              {size.width} × {size.height} px
            </span>
          </div>
          <SettingsGroup title="Map layers">
            <Toggle label="Visited" checked={show.visited} onChange={(v) => setShow({ ...show, visited: v })} />
            <Toggle label="Planned" checked={show.planned} onChange={(v) => setShow({ ...show, planned: v })} />
            <Toggle label="Wishlist" checked={show.wishlist} onChange={(v) => setShow({ ...show, wishlist: v })} />
            <Toggle label="Route" checked={show.route} onChange={(v) => setShow({ ...show, route: v })} />
            <Toggle label="City dots" checked={show.cities} onChange={(v) => setShow({ ...show, cities: v })} />
            <Toggle label="Transport icons" checked={show.transport} disabled={!show.route} onChange={(v) => setShow({ ...show, transport: v })} />
          </SettingsGroup>
          <SettingsGroup title="Image details">
            <Toggle label="Stats" checked={show.stats} onChange={(v) => setShow({ ...show, stats: v })} />
            <Toggle label="Legend" checked={show.legend} onChange={(v) => setShow({ ...show, legend: v })} />
          </SettingsGroup>
        </div>
      </div>
    </ResponsiveDialog>
  );
}
