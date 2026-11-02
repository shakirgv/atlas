/** Image pipeline settings. Receipts keep more detail than photos so small print stays readable, and are never cropped. */
export const IMAGE_PRESETS = {
  photo: { side: 1920, quality: 0.82, maxMB: 0.45, thumbSide: 480, thumbQuality: 0.78, thumbMB: 0.08 },
  receipt: { side: 2000, quality: 0.85, maxMB: 0.45, thumbSide: 400, thumbQuality: 0.78, thumbMB: 0.06 },
} as const;
export type ImagePreset = keyof typeof IMAGE_PRESETS;

type ExpenseLike = { id: string; date: string; category: string; amount: number | string; currency: string; kind?: string; amount_base?: number | string };

/** Letters and digits of any alphabet survive; the rest becomes a dash, so the name is safe in any ZIP tool. */
function slug(text: string) {
  return text
    .trim()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "");
}

/** `2027-03-14_Tokyo_food_35.00USD.webp`; the place is left out when the expense has none. */
export function receiptFileName(e: ExpenseLike, place: string | null | undefined) {
  const parts = [e.date, place ? slug(place) : "", slug(e.category), `${Number(e.amount).toFixed(2)}${e.currency}`].filter(Boolean);
  return `${parts.join("_")}.webp`;
}

/** Adds `_2`, `_3`… so several receipts for one expense (or equal expenses) never overwrite each other. */
export function uniqueNames(names: string[]) {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const n = (seen.get(name) ?? 0) + 1;
    seen.set(name, n);
    return n === 1 ? name : name.replace(/\.webp$/, `_${n}.webp`);
  });
}

/** Spent expenses without a receipt; `over` optionally limits it to amounts above a base-currency threshold. */
export function isMissingReceipt(e: ExpenseLike, receiptCount: number, over?: number | null) {
  if (receiptCount > 0 || e.kind === "planned") return false;
  return over ? Number(e.amount_base ?? 0) > over : true;
}

export type ZipItem = { name: string; id: string };

/**
 * Builds the ZIP from fresh URLs, one file at a time so a phone isn't holding every download at once.
 * A failed file is skipped and reported instead of losing the whole archive.
 */
export async function buildReceiptsZip(items: ZipItem[], fetchBytes: (id: string) => Promise<ArrayBuffer>, onProgress?: (done: number, total: number) => void) {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const failed: string[] = [];
  let done = 0;
  for (const item of items) {
    try {
      // WebP is already compressed, so storing is faster and no bigger.
      zip.file(item.name, await fetchBytes(item.id), { compression: "STORE" });
    } catch {
      failed.push(item.name);
    }
    onProgress?.(++done, items.length);
  }
  return { zip, failed };
}
