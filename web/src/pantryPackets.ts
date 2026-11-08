// Packets in stock (see the pantry_packets migration): the bags, jars and
// cans of a pantry item actually there, each with its brand and size. Only
// for households who want it: an item with no packets works as before, and
// nothing asks anyone to add any (docs/VISION.md). Tested in
// web/test/pantryPackets.test.ts.
import type { PantryItem, PantryPacket } from "./pb";
import { norm } from "./pantryGroups.ts";
import { brandsOf } from "./pantryItem.ts";
import { storedTime } from "./dates.ts";

export interface PacketDetails {
  brand: string;
  size: string;
}

type Packet = Pick<PantryPacket, "id" | "item" | "brand" | "size" | "created">;

// "White Mill 1 kg", "White Mill", "1 kg", or "Packet" when it has neither.
export function packetLabel(packet: Pick<PantryPacket, "brand" | "size">): string {
  return [packet.brand, packet.size].map((part) => (part ?? "").trim()).filter(Boolean).join(" ") || "Packet";
}

// An item's packets as counters, one per brand and size ("− 3 × 400 g +"):
// the label leaves out the item's favourite brand (it's under the name
// already), and `packets` are oldest first, so the first is the one to use
// up. In the order each kind was first added.
export function packetGroups<T extends Pick<PantryPacket, "brand" | "size" | "left">>(
  packets: T[],
  favouriteBrand = ""
): { label: string; count: number; packets: T[] }[] {
  const groups = new Map<string, { label: string; count: number; packets: T[] }>();
  for (const packet of packets) {
    const brand = norm(packet.brand ?? "") === norm(favouriteBrand) ? "" : packet.brand ?? "";
    // A partly used one (cooking left "100 g") is its own counter.
    const left = (packet.left ?? "").trim();
    const label = `${packetLabel({ brand, size: packet.size })}${left ? `, about ${left} left` : ""}`;
    const key = `${norm(brand)}|${norm(packet.size ?? "")}|${norm(left)}`;
    const group = groups.get(key) ?? { label, count: 0, packets: [] };
    group.count += 1;
    group.packets.push(packet);
    groups.set(key, group);
  }
  return [...groups.values()];
}

// Whether a packet the shopping list added was added within the last hour,
// while unticking its row still takes it back (pantry.pb.js). A packet put
// back by Out's Undo keeps that link only then: an older one would look
// freshly bought.
export function untickCanTakeBack(packet: Pick<PantryPacket, "bought_with" | "created">, now = new Date()): boolean {
  return !!packet.bought_with && now.getTime() - storedTime(packet.created).getTime() < 60 * 60 * 1000;
}

// A packet the shopping list added (ticking it bought) in the last few
// hours, newest first, or null: adding one by hand now is likely the same
// bag, so the page asks first.
export const JUST_BOUGHT_HOURS = 6;
export function justBought<T extends Pick<PantryPacket, "bought_with" | "created">>(packets: T[], now = new Date()): T | null {
  const since = now.getTime() - JUST_BOUGHT_HOURS * 60 * 60 * 1000;
  const bought = packets.filter((packet) => packet.bought_with && storedTime(packet.created).getTime() >= since);
  return bought.sort((a, b) => b.created.localeCompare(a.created))[0] ?? null;
}

// What "+ 1 packet" adds: one like the item's usual packet (the last one
// added, remembered after they're gone), else like its newest packet, else
// one with its favourite brand and no size.
export function nextPacket(
  item: Pick<PantryItem, "brand" | "usual_packet">,
  packets: Pick<PantryPacket, "brand" | "size">[]
): PacketDetails {
  const usual = item.usual_packet;
  if (usual && (usual.brand || usual.size)) return { brand: usual.brand ?? "", size: usual.size ?? "" };
  const newest = packets[packets.length - 1];
  if (newest) return { brand: newest.brand ?? "", size: newest.size ?? "" };
  return { brand: brandsOf(item.brand ?? "").length === 1 ? item.brand.trim() : "", size: "" };
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
