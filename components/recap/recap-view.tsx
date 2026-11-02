"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Compass, Download, FileArchive, GalleryVertical, Loader2, Play, X } from "lucide-react";
import { toast } from "sonner";
import { downloadBlob, embedFonts, fontStack, inlineImages, serializeSvg, svgToPng } from "@/lib/export-image";
import type { RecapStats, SlideKey } from "@/lib/recap";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/common/empty-state";
import { Button } from "@/components/ui/button";
import { RecapSlide, SLIDE_H, SLIDE_W, type SlideFonts } from "./recap-slide";

const SIZE = { width: SLIDE_W, height: SLIDE_H };

/** Same pipeline as the map export. Photos become data URLs first, or the canvas couldn't be exported. */
async function slideToPng(svg: SVGSVGElement, fonts: SlideFonts) {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  await inlineImages(copy);
  const css = await embedFonts([fonts.display, fonts.body, fonts.flags]);
  return svgToPng(serializeSvg(copy, SIZE, css), SIZE);
}

/** Full-screen story with a scroll view. `embedded` keeps it inside its parent. */
export function RecapView({ stats, slides, currency, years, embedded, share }: { stats: RecapStats; slides: SlideKey[]; currency: string; years: number[]; embedded?: boolean; share?: React.ReactNode }) {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [scrolling, setScrolling] = useState(false);
  const [fonts, setFonts] = useState<SlideFonts>({ display: "serif", body: "sans-serif", flags: "sans-serif" });
  const [busy, setBusy] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const current = useRef<SVGSVGElement>(null);
  const hidden = useRef<(SVGSVGElement | null)[]>([]);
  const touch = useRef<number | null>(null);
  const last = slides.length - 1;
  const slide = slides[index] ?? slides[0];
  const name = useMemo(() => `atlas-recap-${String(stats.period)}`, [stats.period]);

  useEffect(() => {
    const t = setTimeout(() => setFonts({ display: fontStack("--font-fraunces"), body: fontStack("--font-geist"), flags: `${fontStack("--font-flags")}, ${fontStack("--font-geist")}` }), 0);
    return () => clearTimeout(t);
  }, []);

  const go = useCallback(
    (delta: number) => {
      setDirection(delta);
      setIndex((i) => Math.min(last, Math.max(0, i + delta)));
    },
    [last],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (scrolling) return;
      if (e.key === "ArrowRight" || e.key === " ") {
        e.preventDefault();
        go(1);
      }
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, scrolling]);

  const downloadOne = async () => {
    if (!current.current || !slide) return;
    setBusy("one");
    try {
      await document.fonts.ready;
      downloadBlob(await slideToPng(current.current, fonts), `${name}-${String(index + 1).padStart(2, "0")}-${slide}.png`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export the slide.");
    } finally {
      setBusy(null);
    }
  };

  const downloadAll = async () => {
    setBusy("all");
    setAll(true);
    try {
      // Every slide is mounted off screen for this, then taken down again.
      await new Promise((r) => setTimeout(r, 60));
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i++) {
        const svg = hidden.current[i];
        if (svg) zip.file(`${name}-${String(i + 1).padStart(2, "0")}-${slides[i]}.png`, await slideToPng(svg, fonts), { compression: "STORE" });
      }
      downloadBlob(await zip.generateAsync({ type: "blob" }), `${name}.zip`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export the slides.");
    } finally {
      setAll(false);
      setBusy(null);
    }
  };

  if (!slide) {
    return (
      <div className="mx-auto max-w-xl py-16">
        <EmptyState icon={Compass} title={`Nothing to recap for ${stats.label} yet`} description="Past trips, expenses, memories and photos appear here." action={<Button variant="secondary" asChild><Link href="/">Back to the dashboard</Link></Button>} />
      </div>
    );
  }

  const shell = embedded ? "relative h-[820px] overflow-hidden rounded-2xl" : "fixed inset-0 z-50";

  return (
    <div className={cn(shell, "flex flex-col bg-[#07090D] text-white")} data-testid="recap">
      <div className="absolute inset-x-0 top-0 z-20 flex flex-col gap-2 bg-gradient-to-b from-black/70 to-transparent p-3 pb-6">
        {!scrolling && (
          <div className="mx-auto flex w-full max-w-md gap-1" role="progressbar" aria-valuemin={1} aria-valuemax={slides.length} aria-valuenow={index + 1} aria-label={`Slide ${index + 1} of ${slides.length}`}>
            {slides.map((key, i) => (
              <span key={key} className={cn("h-1 flex-1 rounded-full transition-colors", i <= index ? "bg-white" : "bg-white/25")} />
            ))}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Link href="/" className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label="Close recap">
              <X className="size-5" />
            </Link>
            {years.length > 1 && (
              <nav className="scrollbar-none flex max-w-[40vw] gap-1 overflow-x-auto" aria-label="Recap year">
                {years.map((y) => (
                  <Link key={y} href={`/recap/${y}`} aria-current={stats.period === y ? "page" : undefined} className={cn("num rounded-full px-2.5 py-1 text-sm", stats.period === y ? "bg-white text-black" : "text-white/70 hover:text-white")}>
                    {y}
                  </Link>
                ))}
              </nav>
            )}
          </div>
          <div className="flex items-center gap-1">
            {share}
            <button type="button" onClick={() => setScrolling((s) => !s)} className="grid size-10 place-items-center rounded-full hover:bg-white/10" aria-label={scrolling ? "Story view" : "Scroll view"} aria-pressed={scrolling} title={scrolling ? "Story view" : "Scroll view"}>
              {scrolling ? <Play className="size-5" /> : <GalleryVertical className="size-5" />}
            </button>
            {!scrolling && (
              <button type="button" onClick={downloadOne} disabled={Boolean(busy)} className="grid size-10 place-items-center rounded-full hover:bg-white/10 disabled:opacity-50" aria-label="Download this slide" title="Download this slide">
                {busy === "one" ? <Loader2 className="size-5 animate-spin" /> : <Download className="size-5" />}
              </button>
            )}
            <button type="button" onClick={downloadAll} disabled={Boolean(busy)} className="grid size-10 place-items-center rounded-full hover:bg-white/10 disabled:opacity-50" aria-label="Download all slides" title="Download all">
              {busy === "all" ? <Loader2 className="size-5 animate-spin" /> : <FileArchive className="size-5" />}
            </button>
          </div>
        </div>
      </div>

      {scrolling ? (
        <div className="flex-1 overflow-y-auto px-3 pb-8 pt-20" data-testid="recap-scroll">
          <div className="mx-auto flex max-w-md flex-col gap-4">
            {slides.map((key) => (
              <RecapSlide key={key} slide={key} stats={stats} currency={currency} fonts={fonts} className="w-full rounded-2xl" />
            ))}
          </div>
        </div>
      ) : (
        <div
          className="relative flex-1 touch-pan-y select-none overflow-hidden"
          onTouchStart={(e) => {
            touch.current = e.touches[0]!.clientX;
          }}
          onTouchEnd={(e) => {
            if (touch.current === null) return;
            const dx = e.changedTouches[0]!.clientX - touch.current;
            touch.current = null;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          }}
        >
          <AnimatePresence mode="wait" initial={false} custom={direction}>
            <motion.div key={slide} className="absolute inset-0 grid place-items-center" initial={{ opacity: 0, x: direction * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: direction * -24 }} transition={{ duration: 0.2, ease: "easeOut" }}>
              <RecapSlide ref={current} slide={slide} stats={stats} currency={currency} fonts={fonts} className="h-full max-h-full w-auto max-w-full" />
            </motion.div>
          </AnimatePresence>
          <button type="button" onClick={() => go(-1)} disabled={index === 0} className="absolute inset-y-0 left-0 z-10 flex w-1/3 items-center justify-start pl-2 text-white/70 hover:text-white disabled:pointer-events-none disabled:opacity-0" aria-label="Previous slide">
            <ChevronLeft className="size-7" />
          </button>
          <button type="button" onClick={() => go(1)} disabled={index === last} className="absolute inset-y-0 right-0 z-10 flex w-2/3 items-center justify-end pr-2 text-white/70 hover:text-white disabled:pointer-events-none disabled:opacity-0" aria-label="Next slide">
            <ChevronRight className="size-7" />
          </button>
        </div>
      )}

      {all && (
        <div aria-hidden className="pointer-events-none fixed top-0" style={{ left: -20000, width: SLIDE_W, height: SLIDE_H }}>
          {slides.map((key, i) => (
            <RecapSlide
              key={key}
              ref={(el) => {
                hidden.current[i] = el;
              }}
              slide={key}
              stats={stats}
              currency={currency}
              fonts={fonts}
            />
          ))}
        </div>
      )}
    </div>
  );
}
