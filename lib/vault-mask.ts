/** Sent by actions when the vault must be opened first; the UI answers it with the keypad. */
export const VAULT_LOCKED = "VAULT_LOCKED";
/** Stands in for a real storage path, so the client still knows a locked document has a file. */
export const LOCKED_FILE = "locked";
export const PIN_PATTERN = /^\d{4,8}$/;
/** Locked by default; each document can opt out. */
export const SENSITIVE_TYPES: readonly string[] = ["passport", "id", "visa", "insurance", "vaccination"];
export const LOCK_TIMEOUTS = [1, 5, 15, 30] as const;

export type VaultState = { hasPin: boolean; unlocked: boolean; pinLength: number | null; lockedUntil: string | null };

/** "C01234567" becomes "•••• 4567". A short reference shows nothing, since four digits would be all of it. */
export function maskReference(reference: string | null | undefined) {
  if (!reference) return null;
  const clean = reference.trim();
  return clean.length > 4 ? `•••• ${clean.slice(-4)}` : "••••";
}

export function isDocumentLocked(doc: { sensitive?: boolean | null }, vault: Pick<VaultState, "hasPin" | "unlocked">) {
  return Boolean(doc.sensitive) && vault.hasPin && !vault.unlocked;
}

type Maskable = { sensitive?: boolean | null; reference_no: string | null; notes: string | null; file_path: string | null; file_name: string | null; mime_type: string | null };

/**
 * What the browser may see of a locked document. This runs on the server before anything is sent,
 * so a locked document's reference, notes and file never reach the client at all.
 */
export function maskDocument<T extends Maskable>(doc: T, vault: Pick<VaultState, "hasPin" | "unlocked">): T {
  if (!isDocumentLocked(doc, vault)) return doc;
  return { ...doc, reference_no: maskReference(doc.reference_no), notes: null, file_path: doc.file_path ? LOCKED_FILE : null, file_name: null, mime_type: null };
}
