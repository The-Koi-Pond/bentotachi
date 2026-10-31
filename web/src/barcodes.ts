// Barcodes on pantry items (see the pantry_barcodes migration): scanning a
// packet's barcode finds the item it belongs to, or starts a new one.

// The same product can scan as UPC-A (12 digits, common in the US) or EAN-13
// (13, with a leading 0), so both are kept as 13 digits. Spaces and dashes
// from typing are dropped. "" if it isn't a barcode.
export function normaliseBarcode(text: string): string {
  const digits = text.replace(/[\s-]/g, "");
  if (!/^\d{8,14}$/.test(digits)) return "";
  return digits.length === 12 ? `0${digits}` : digits;
}

export function barcodesOf(item: { barcodes?: unknown }): string[] {
  return Array.isArray(item.barcodes) ? item.barcodes.filter((code): code is string => typeof code === "string") : [];
}

// The item a barcode belongs to, if the household has scanned it before.
export function itemWithBarcode<T extends { barcodes?: unknown }>(items: T[], code: string): T | undefined {
  return items.find((item) => barcodesOf(item).includes(code));
}

// The item's barcodes with one more (no repeats).
export function withBarcode(item: { barcodes?: unknown }, code: string): string[] {
  const codes = barcodesOf(item);
  return codes.includes(code) ? codes : [...codes, code];
}
