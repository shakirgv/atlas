"use client";

const fontCache = new Map<string, string>();

function toBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
}

/** The real family name behind a `next/font` CSS variable, plus its fallbacks. */
export function fontStack(cssVariable: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(cssVariable).trim() || "serif";
}

const firstFamily = (stack: string) => stack.split(",")[0]!.trim().replace(/^['"]|['"]$/g, "");

/**
 * An SVG drawn into a canvas can't load anything from the page, so its fonts must travel inside it.
 * Finds the @font-face rules for these families and rewrites them with the files as data URLs.
 */
export async function embedFonts(stacks: string[]) {
  await document.fonts.ready;
  const wanted = new Set(stacks.map(firstFamily));
  const key = [...wanted].sort().join("|");
  const cached = fontCache.get(key);
  if (cached !== undefined) return cached;

  const rules: { rule: CSSFontFaceRule; base: string }[] = [];
  for (const sheet of Array.from(document.styleSheets)) {
    let list: CSSRuleList;
    try {
      list = sheet.cssRules;
    } catch {
      continue; // A cross-origin sheet can't be read, and holds none of these fonts.
    }
    for (const rule of Array.from(list)) {
      if (rule instanceof CSSFontFaceRule && wanted.has(rule.style.getPropertyValue("font-family").replace(/['"]/g, ""))) {
        rules.push({ rule, base: sheet.href ?? location.href });
      }
    }
  }
  const faces = await Promise.all(
    rules.map(async ({ rule, base }) => {
      const src = rule.style.getPropertyValue("src");
      const url = /url\(["']?([^"')]+)["']?\)/.exec(src)?.[1];
      if (!url) return "";
      try {
        const res = await fetch(new URL(url, base));
        if (!res.ok) return "";
        const data = toBase64(await res.arrayBuffer());
        const keep = ["font-family", "font-style", "font-weight", "font-stretch", "unicode-range"]
          .map((p) => [p, rule.style.getPropertyValue(p)])
          .filter(([, v]) => v)
          .map(([p, v]) => `${p}:${v};`)
          .join("");
        return `@font-face{${keep}src:url(data:font/woff2;base64,${data}) format("woff2");}`;
      } catch {
        return "";
      }
    }),
  );
  const css = faces.join("");
  fontCache.set(key, css);
  return css;
}

/** A standalone copy of an on-screen SVG at the given pixel size, with its fonts inside. */
export function serializeSvg(svg: SVGSVGElement, size: { width: number; height: number }, fontCss: string) {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  copy.setAttribute("width", String(size.width));
  copy.setAttribute("height", String(size.height));
  copy.removeAttribute("class");
  copy.removeAttribute("style");
  if (fontCss) {
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = fontCss;
    copy.insertBefore(style, copy.firstChild);
  }
  return new XMLSerializer().serializeToString(copy);
}

/** Replaces each remote <image> with a data URL, since a canvas refuses to export remote pixels. */
export async function inlineImages(svg: SVGSVGElement) {
  const images = Array.from(svg.querySelectorAll("image"));
  await Promise.all(
    images.map(async (el) => {
      const href = el.getAttribute("href");
      if (!href || href.startsWith("data:")) return;
      try {
        const res = await fetch(href);
        const blob = await res.blob();
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result));
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        });
        el.setAttribute("href", data);
      } catch {
        el.remove(); // A photo that can't be fetched must not break the whole image.
      }
    }),
  );
}

/** SVG text → PNG. Fonts are decoded asynchronously on some browsers, hence the second draw. */
export async function svgToPng(svgText: string, size: { width: number; height: number }) {
  const url = URL.createObjectURL(new Blob([svgText], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.width = size.width;
    img.height = size.height;
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("This browser can't draw the image.");
    ctx.drawImage(img, 0, 0, size.width, size.height);
    await new Promise((r) => requestAnimationFrame(r));
    ctx.clearRect(0, 0, size.width, size.height);
    ctx.drawImage(img, 0, 0, size.width, size.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not create the image."))), "image/png"));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function copyImage(blob: Blob) {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

export function canShareFile(file: File) {
  return typeof navigator !== "undefined" && Boolean(navigator.canShare?.({ files: [file] }));
}

/** A file-name-safe version of a title. */
export function fileSlug(text: string, fallback = "atlas") {
  return text.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "") || fallback;
}
