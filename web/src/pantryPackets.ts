// Packets in stock (see the pantry_packets migration): the bags, jars and
// cans of a pantry item actually there, each with its brand and size. Only
// for households who want it: an item with no packets works as before, and
// nothing asks anyone to add any (docs/VISION.md). Tested in
// web/test/pantryPackets.test.ts.
import type { PantryItem, PantryPacket } from "./pb";
import { norm } from "./pantryGroups.ts";
import { brandsOf } from "./pantryItem.ts";
import { datePart, localToday, storedTime, timeAgo, toStoredDate } from "./dates.ts";
import { daysUntil, describeExpiry, expiryState } from "./expiry.ts";
import { productWithBarcode } from "./pantryProducts.ts";

export interface PacketDetails {
  brand: string;
  size: string;
  // Its use-by day ("2026-12-14"), when it's added with one.
  expires?: string;
}

type Packet = Pick<PantryPacket, "id" | "item" | "brand" | "size" | "created">;

// "White Mill 1 kg", "White Mill", "1 kg", or "" when it has neither: the
// word "packet" never shows, as tins, jars and bottles are counted too, so
// callers say "one" or just the count instead.
export function packetName(packet: Pick<PantryPacket, "brand" | "size">): string {
  return [packet.brand, packet.size].map((part) => (part ?? "").trim()).filter(Boolean).join(" ");
}

// An item's packets grouped, one group per brand, size and state ("3 ×
// 400 g"): the label leaves out the item's favourite brand (it's under the
// name already), and `packets` are oldest first, so the first is the one to
// use up. In the order each kind was first added. Ones with their own
// use-by date or opened (labels, docs/VISION.md), or bought on another day
// (boughtDay: given, or the day added), only group with the same.
export interface PacketGroup<T> {
  label: string;
  count: number;
  packets: T[];
}

export function packetGroups<
  T extends Pick<PantryPacket, "brand" | "size" | "left"> & Partial<Pick<PantryPacket, "expires" | "opened" | "bought" | "created">>,
>(
  packets: T[],
  favouriteBrand = ""
): PacketGroup<T>[] {
  const groups = new Map<string, PacketGroup<T>>();
  for (const packet of packets) {
    const brand = norm(packet.brand ?? "") === norm(favouriteBrand) ? "" : packet.brand ?? "";
    // A partly used one (cooking left "100 g") is its own counter.
    const left = (packet.left ?? "").trim();
    const base = packetName({ brand, size: packet.size });
    const label = left ? [base, `about ${left} left`].filter(Boolean).join(", ") : base;
    const key = `${norm(brand)}|${norm(packet.size ?? "")}|${norm(left)}|${(packet.expires ?? "").slice(0, 10)}|${packet.opened ? "open" : ""}|${boughtDay(packet)}`;
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

// A packet as it's saved, for adding one or putting one back (Out's Undo).
// One put back keeps what's left of it, and the shopping row that bought it
// only while unticking that row could still take it back.
export function packetToSave(
  packet: Pick<PantryPacket, "item" | "brand" | "size" | "barcode" | "left"> &
    Partial<Pick<PantryPacket, "bought_with" | "created" | "expires" | "opened" | "bought">>,
  now = new Date()
) {
  return {
    item: packet.item,
    brand: packet.brand,
    size: packet.size,
    barcode: packet.barcode,
    ...(packet.left && { left: packet.left }),
    ...(packet.expires && { expires: packet.expires }),
    ...(packet.opened && { opened: packet.opened }),
    // One put back is a new record (added today): the day it was really
    // bought goes with it, or it would say "bought today".
    ...((packet.bought || packet.created) && { bought: packet.bought || toStoredDate(boughtDay(packet)) }),
    ...(packet.created && untickCanTakeBack({ bought_with: packet.bought_with, created: packet.created }, now) && { bought_with: packet.bought_with }),
  };
}

// Whether finishing a packet, with these left on screen (it among them),
// makes its item Out: the last one does, unless the item is Out already (a
// dropped connection can leave one behind), when it just goes.
export function lastPacketRunsOut(item: Pick<PantryItem, "status">, onScreen: unknown[]): boolean {
  return onScreen.length <= 1 && item.status !== "out";
}

// Whether adding a packet with this barcode teaches the item its brand and
// size: only a barcode it doesn't know yet, and only with something to
// remember.
export function learnsBarcode(item: Pick<PantryItem, "barcode_details">, barcode: string, details: PacketDetails): boolean {
  return !!barcode && !knowsBarcode(item, barcode) && !!(details.brand.trim() || details.size.trim());
}

// What adding a packet changes on its item, or null for nothing: an Out item
// is in stock again, and a barcode it learns is remembered.
export function itemAfterPacket(
  item: Pick<PantryItem, "status" | "barcode_details">,
  barcode: string,
  details: PacketDetails
): Partial<Pick<PantryItem, "status" | "barcode_details">> | null {
  const learns = learnsBarcode(item, barcode, details);
  if (item.status !== "out" && !learns) return null;
  return {
    ...(item.status === "out" && { status: "have" as const }),
    ...(learns && { barcode_details: withDetails(item, barcode, details) }),
  };
}

// A packet the shopping list added (ticking it bought) in the last few
// hours, newest first, or null: adding one by hand now is likely the same
// bag, so the page asks first.
const JUST_BOUGHT_HOURS = 6;
export function justBought<T extends Pick<PantryPacket, "bought_with" | "created">>(packets: T[], now = new Date()): T | null {
  const since = now.getTime() - JUST_BOUGHT_HOURS * 60 * 60 * 1000;
  const bought = packets.filter((packet) => packet.bought_with && storedTime(packet.created).getTime() >= since);
  return bought.sort((a, b) => b.created.localeCompare(a.created))[0] ?? null;
}

// The day a label was bought ("2026-11-02"): the one someone gave, else
// the day it was added, on this phone's calendar. "" if neither is known.
export function boughtDay(packet: Partial<Pick<PantryPacket, "bought" | "created">>): string {
  if (packet.bought) return datePart(packet.bought);
  const added = storedTime(packet.created ?? "");
  return Number.isNaN(added.getTime()) ? "" : localToday(added);
}

// The small words after a label: "opened · expires 16 Nov" (the expiry
// wording is expiry.ts's), and whether that's soon (or past), to tint it.
// Without a use-by date, how long ago it was bought ("bought 12 days ago")
// says how fresh it is instead.
export function labelMeta(
  packet: Partial<Pick<PantryPacket, "expires" | "opened" | "bought" | "created">>,
  now = new Date()
): { text: string; soon: boolean } {
  const expiry = describeExpiry(packet.expires ?? "", now);
  const days = daysUntil(packet.expires ?? "", now);
  const bought = boughtDay(packet);
  const age = !expiry && bought ? `bought ${timeAgo(bought, localToday(now))}` : "";
  const parts = [packet.opened ? "opened" : "", expiry && expiry.charAt(0).toLowerCase() + expiry.slice(1), age].filter(Boolean);
  return { text: parts.join(" · "), soon: days !== null && expiryState(days) !== "later" };
}

// What making this brand and size the favourite changes on the item: its
// usual one, and its favourite brand when the brand is another (or it had
// an older item's list of brands). Only a person does this; adding more
// never changes the favourite (server/pb_hooks/pantry.pb.js).
export function preferredChanges(
  item: Pick<PantryItem, "brand">,
  details: PacketDetails
): Pick<PantryItem, "usual_packet"> & Partial<Pick<PantryItem, "brand">> {
  const brand = details.brand.trim();
  const size = details.size.trim();
  return {
    usual_packet: { brand, size },
    ...(brand && norm(brand) !== norm(item.brand ?? "") && { brand }),
  };
}

// Whether the household counts this item's stock: some counted now, or a
// usual one remembered from counting before (it's kept after they're all
// used up). Scanning one of these adds it by itself; one nobody counts
// isn't started on (counting stays each household's choice).
export function countsInStock(item: Pick<PantryItem, "usual_packet">, packets: unknown[]): boolean {
  const usual = item.usual_packet;
  return packets.length > 0 || !!(usual && (usual.brand || usual.size));
}

// What "+ 1 more" adds: one like the item's usual packet (its favourite
// brand and size, kept after they're all gone), else like its newest
// packet, else one with its favourite brand and no size.
export function nextPacket(
  item: Pick<PantryItem, "brand" | "usual_packet">,
  packets: Pick<PantryPacket, "brand" | "size">[]
): PacketDetails {
  const usual = item.usual_packet;
  if (usual && (usual.brand || usual.size)) return { brand: usual.brand ?? "", size: usual.size ?? "" };
  // The newest one in stock, but not a stand-in of another brand than the
  // favourite ("+ Brand/Size"): the next one should be the favourite.
  const preferred = brandsOf(item.brand ?? "").map(norm);
  const newest = [...packets].reverse().find((packet) => !preferred.length || !(packet.brand ?? "").trim() || preferred.includes(norm(packet.brand ?? "")));
  if (newest) return { brand: newest.brand ?? "", size: newest.size ?? "" };
  return { brand: preferred.length === 1 ? item.brand.trim() : "", size: "" };
}

// An item's packets, oldest first (the one to use up first), leaving out
// `hidden` ones (finished, waiting for Undo).
export function packetsOf<T extends Packet>(all: T[], itemId: string, hidden: Set<string> = new Set()): T[] {
  return all
    .filter((packet) => packet.item === itemId && !hidden.has(packet.id))
    .sort((a, b) => a.created.localeCompare(b.created) || a.id.localeCompare(b.id));
}

// What the item remembers a barcode is: the named product it's on, else (an
// item an older app saved since) its barcode_details. null if neither knows.
function knownDetails(item: Pick<PantryItem, "barcode_details" | "products">, code: string): PacketDetails | null {
  const product = productWithBarcode(item, code);
  if (product && (product.brand || product.size)) return { brand: product.brand, size: product.size };
  const known = item.barcode_details?.[code];
  return known && (known.brand || known.size) ? { brand: known.brand ?? "", size: known.size ?? "" } : null;
}

// What a packet with this barcode is: what the item remembers for it, else
// what Open Food Facts said (`looked`), else nothing. Remembered with a
// brand but no size (an older item made from a scan): the brand it
// remembers, with the size Open Food Facts says.
export function detailsFor(
  item: Pick<PantryItem, "barcode_details" | "products">,
  code: string,
  looked?: { brand?: string; quantity?: string } | null,
): PacketDetails {
  const known = knownDetails(item, code);
  if (known?.size) return known;
  // Cut to what a packet's brand holds (120), as sizes are (tidySize).
  const size = tidySize(looked?.quantity ?? "");
  return known ? { brand: known.brand, size } : { brand: (looked?.brand ?? "").trim().slice(0, 120), size };
}

// Whether the item already remembers what this barcode is, size included:
// one known only by its brand is still looked up, for its size.
export function knowsBarcode(item: Pick<PantryItem, "barcode_details" | "products">, code: string): boolean {
  return !!knownDetails(item, code)?.size;
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
