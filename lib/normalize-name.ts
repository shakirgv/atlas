/** Lowercase, no accents, no punctuation: "Türkiyə" and "TURKIYE" are the same name here. */
export function normalizeName(value: string) {
  const folded = value
    .replace(/[əƏ]/g, "e")
    .replace(/[ıİ]/g, "i")
    .replace(/[øØ]/g, "o")
    .replace(/[æÆ]/g, "ae")
    .replace(/ß/g, "ss")
    .replace(/&/g, " and ")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/['’`.]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
  return folded.replace(/^the /, "").replace(/\bsaint\b/g, "st").replace(/\bsainte\b/g, "ste");
}
