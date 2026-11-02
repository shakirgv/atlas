import { describe, expect, it } from "vitest";
import { buildReceiptsZip, IMAGE_PRESETS, isMissingReceipt, receiptFileName, uniqueNames } from "@/lib/receipts";

const expense = { id: "e", date: "2027-03-14", category: "food", amount: 35, currency: "USD", kind: "actual", amount_base: 35 };

describe("file names", () => {
  it("matches the spec's example", () => {
    expect(receiptFileName(expense, "Tokyo")).toBe("2027-03-14_Tokyo_food_35.00USD.webp");
  });

  it("leaves out an unknown place", () => {
    expect(receiptFileName(expense, null)).toBe("2027-03-14_food_35.00USD.webp");
  });

  it("keeps local letters and removes anything unsafe", () => {
    expect(receiptFileName(expense, "Kadıköy / Üsküdar: \\..")).toBe("2027-03-14_Kadıköy-Üsküdar_food_35.00USD.webp");
    expect(receiptFileName(expense, "../../etc")).toBe("2027-03-14_etc_food_35.00USD.webp");
  });

  it("never lets two files overwrite each other", () => {
    expect(uniqueNames(["a.webp", "b.webp", "a.webp", "a.webp"])).toEqual(["a.webp", "b.webp", "a_2.webp", "a_3.webp"]);
  });
});

describe("missing receipt filter", () => {
  it("finds spent expenses without a receipt", () => {
    expect(isMissingReceipt(expense, 0)).toBe(true);
    expect(isMissingReceipt(expense, 1)).toBe(false);
  });

  it("ignores planned expenses, which have no receipt yet", () => {
    expect(isMissingReceipt({ ...expense, kind: "planned" }, 0)).toBe(false);
  });

  it("applies the optional threshold", () => {
    expect(isMissingReceipt(expense, 0, 50)).toBe(false);
    expect(isMissingReceipt({ ...expense, amount_base: 51 }, 0, 50)).toBe(true);
    expect(isMissingReceipt(expense, 0, null)).toBe(true);
  });
});

describe("ZIP", () => {
  const bytes = new TextEncoder().encode("receipt").buffer as ArrayBuffer;

  it("contains each receipt under its name and reports progress", async () => {
    const progress: number[] = [];
    const { zip, failed } = await buildReceiptsZip(
      [
        { id: "1", name: "2027-03-14_Tokyo_food_35.00USD.webp" },
        { id: "2", name: "2027-03-14_Tokyo_food_35.00USD_2.webp" },
      ],
      async () => bytes,
      (done) => progress.push(done),
    );
    expect(failed).toEqual([]);
    expect(Object.keys(zip.files).sort()).toEqual(["2027-03-14_Tokyo_food_35.00USD.webp", "2027-03-14_Tokyo_food_35.00USD_2.webp"]);
    expect(await zip.file("2027-03-14_Tokyo_food_35.00USD.webp")!.async("string")).toBe("receipt");
    expect(progress).toEqual([1, 2]);
  });

  it("skips a failed download and names it", async () => {
    const { zip, failed } = await buildReceiptsZip(
      [
        { id: "ok", name: "a.webp" },
        { id: "bad", name: "b.webp" },
      ],
      async (id) => {
        if (id === "bad") throw new Error("expired");
        return bytes;
      },
    );
    expect(Object.keys(zip.files)).toEqual(["a.webp"]);
    expect(failed).toEqual(["b.webp"]);
  });
});

describe("presets", () => {
  it("follows the spec for receipts", () => {
    expect(IMAGE_PRESETS.receipt).toMatchObject({ side: 2000, quality: 0.85, thumbSide: 400 });
    expect(IMAGE_PRESETS.receipt.maxMB).toBeLessThan(0.5);
  });
});
