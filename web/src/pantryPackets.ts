// Packets in stock (see the pantry_packets migration): the bags, jars and
// cans of a pantry item actually there, each with its brand and size. Only
// for households who want it: an item with no packets works as before, and
// nothing asks anyone to add any (docs/VISION.md). Tested in
// web/test/pantryPackets.test.ts.
import type { PantryItem, PantryPacket } from "./pb";
import { norm } from "./pantryGroups.ts";
import { brandsOf } from "./pantryItem.ts";

export interface PacketDetails {
  brand: string;
  size: string;
}

type Packet = Pick<PantryPacket, "id" | "item" | "brand" | "size" | "created">;

// "White Mill 1 kg", "White Mill", "1 kg", or "Packet" when it has neither.
export function packetLabel(packet: Pick<PantryPacket, "brand" | "size">): string {
  return [packet.brand, packet.size].map((part) => (part ?? "").trim()).filter(Boolean).join(" ") || "Packet";
}

// An item's packets, oldest first (the one to use up first), leaving out
// `hidden` ones (finished, waiting for Undo).
export function packetsOf<T extends Packet>(all: T[], itemId: string, hidden: Set<string> = new Set()): T[] {
  return all
    .filter((packet) => packet.item === itemId && !hidden.has(packet.id))
    .sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id));
}

// What a packet with this barcode is: what the item remembers for it, else
// what Open Food Facts said (`looked`), else nothing.
export function detailsFor(
  item: Pick<PantryItem, "barcode_details">,
  code: string,
  looked?: { brand?: string; quantity?: string } | null,
): PacketDetails {
  const known = item.barcode_details?.[code];
  if (knowsBarcode(item, code)) return { brand: known?.brand ?? "", size: known?.size ?? "" };
  // Cut to what a packet's brand holds (120), as sizes are (tidySize).
  return { brand: (looked?.brand ?? "").trim().slice(0, 120), size: tidySize(looked?.quantity ?? "") };
}

// Whether the item already remembers this barcode's brand or size.
export function knowsBarcode(item: Pick<PantryItem, "barcode_details">, code: string): boolean {
  const known = item.barcode_details?.[code];
  return !!known && !!(known.brand || known.size);
}

// The item's barcode details with this barcode's added (or replaced). The
// same details if there's nothing to remember.
export function withDetails(
  item: Pick<PantryItem, "barcode_details">,
  code: string,
  details: PacketDetails,
): Record<string, { brand?: string; size?: string }> {
  const current = { ...(item.barcode_details ?? {}) };
  const brand = details.brand.trim();
  const size = details.size.trim();
  if (!code || (!brand && !size)) return current;
  current[code] = { ...(brand && { brand }), ...(size && { size }) };
  return current;
}

// Open Food Facts' sizes as people write them: "1000 g" stays, but "1kg" ->
// "1 kg", "500ML" -> "500 ml", and anything long is cut.
export function tidySize(text: string): string {
  return text
    .trim()
    .replace(/(\d)\s*(kg|g|ml|l|cl)\b/gi, (_, digit: string, unit: string) => `${digit} ${unit.toLowerCase() === "l" ? "L" : unit.toLowerCase()}`)
    .replace(/\s+/g, " ")
    .slice(0, 60);
}

// An older item's several brands ("Coles, White Mill"), to pick the
// favourite from; none when it already has one (or none).
export function brandsToPickFrom(brand: string): string[] {
  const brands = brandsOf(brand);
  const unique = brands.filter((b, i) => brands.findIndex((other) => norm(other) === norm(b)) === i);
  return unique.length > 1 ? unique : [];
}
