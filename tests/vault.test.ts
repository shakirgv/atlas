import { describe, expect, it } from "vitest";
import { hashPin, hashToken, newSalt, newUnlockToken } from "@/lib/vault-crypto";
import { isDocumentLocked, LOCKED_FILE, maskDocument, maskReference, PIN_PATTERN, SENSITIVE_TYPES } from "@/lib/vault-mask";
import { documentSchema } from "@/lib/validation";
import { safeNextPath } from "@/lib/utils";

const locked = { hasPin: true, unlocked: false };
const open = { hasPin: true, unlocked: true };
const noPin = { hasPin: false, unlocked: false };
const doc = { sensitive: true, reference_no: "C01234567", notes: "Emergency line", file_path: "u/document/d/scan.pdf", file_name: "passport_C01234567.pdf", mime_type: "application/pdf" };

describe("masking", () => {
  it("shows only the end of a reference", () => {
    expect(maskReference("C01234567")).toBe("•••• 4567");
    expect(maskReference(" AB-12345 ")).toBe("•••• 2345");
  });
  it("hides a short reference entirely", () => {
    expect(maskReference("1234")).toBe("••••");
    expect(maskReference("12")).toBe("••••");
  });
  it("passes through nothing", () => {
    expect(maskReference(null)).toBeNull();
    expect(maskReference("")).toBeNull();
  });
});

describe("what a locked document sends to the browser", () => {
  const masked = maskDocument(doc, locked);

  it("contains no secret anywhere", () => {
    const sent = JSON.stringify(masked);
    expect(sent).not.toContain("C01234567");
    expect(sent).not.toContain("Emergency");
    expect(sent).not.toContain("scan.pdf");
    expect(sent).not.toContain("passport_");
  });
  it("still says a file exists, without its path", () => {
    expect(masked.file_path).toBe(LOCKED_FILE);
    expect(maskDocument({ ...doc, file_path: null }, locked).file_path).toBeNull();
  });
  it("is untouched once unlocked", () => {
    expect(maskDocument(doc, open)).toEqual(doc);
  });
  it("is untouched without a PIN", () => {
    expect(maskDocument(doc, noPin)).toEqual(doc);
  });
  it("leaves non-sensitive documents alone", () => {
    const ticket = { ...doc, sensitive: false };
    expect(maskDocument(ticket, locked)).toEqual(ticket);
  });
});

describe("gating", () => {
  it("locks only a sensitive document, with a PIN, while locked", () => {
    expect(isDocumentLocked({ sensitive: true }, locked)).toBe(true);
    expect(isDocumentLocked({ sensitive: false }, locked)).toBe(false);
    expect(isDocumentLocked({ sensitive: true }, open)).toBe(false);
    expect(isDocumentLocked({ sensitive: true }, noPin)).toBe(false);
  });
  it("covers the spec's document types", () => {
    expect([...SENSITIVE_TYPES].sort()).toEqual(["id", "insurance", "passport", "vaccination", "visa"]);
  });
});

describe("PIN rules", () => {
  it("accepts 4 to 8 digits only", () => {
    expect(PIN_PATTERN.test("1234")).toBe(true);
    expect(PIN_PATTERN.test("12345678")).toBe(true);
    expect(PIN_PATTERN.test("123")).toBe(false);
    expect(PIN_PATTERN.test("123456789")).toBe(false);
    expect(PIN_PATTERN.test("12a4")).toBe(false);
    expect(PIN_PATTERN.test("")).toBe(false);
  });
});

describe("hashing", () => {
  it("is stable for the same PIN and salt", async () => {
    expect(await hashPin("1234", "salt")).toBe(await hashPin("1234", "salt"));
  });
  it("changes with the PIN and with the salt", async () => {
    const base = await hashPin("1234", "salt");
    expect(await hashPin("1235", "salt")).not.toBe(base);
    expect(await hashPin("1234", "other")).not.toBe(base);
  });
  it("never contains the PIN", async () => {
    expect(await hashPin("987654", newSalt())).not.toContain("987654");
  });
  it("makes fresh salts and tokens", () => {
    expect(newSalt()).not.toBe(newSalt());
    expect(newUnlockToken().token).not.toBe(newUnlockToken().token);
  });
  it("stores only a hash of the token", () => {
    const { token, tokenHash } = newUnlockToken();
    expect(tokenHash).toBe(hashToken(token));
    expect(tokenHash).not.toContain(token);
    expect(Buffer.from(token, "base64url")).toHaveLength(32);
  });
});

describe("document form", () => {
  it("keeps the sensitive choice", () => {
    expect(documentSchema.parse({ title: "Ticket", type: "ticket", sensitive: true }).sensitive).toBe(true);
    expect(documentSchema.parse({ title: "Ticket", type: "ticket" }).sensitive).toBeUndefined();
  });
});

describe("next path after signing in", () => {
  it("keeps paths inside the app", () => {
    expect(safeNextPath("/documents?open=1")).toBe("/documents?open=1");
  });
  it("refuses anything that leaves the site", () => {
    expect(safeNextPath("//evil.example")).toBe("/");
    expect(safeNextPath("https://evil.example")).toBe("/");
    expect(safeNextPath("/\\evil.example")).toBe("/");
    expect(safeNextPath(null)).toBe("/");
  });
});
