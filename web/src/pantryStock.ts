// How much of a recipe's ingredient the pantry's packets cover, so the list
// gets only what's short ("1.3 kg linguine" with 200 g in). Every packet
// counts as full (they don't say how much is left; docs/PLAN.md). Where it
// can't tell ("2 onions", no sizes), Have / Low / Out decides as before.
// Tested in web/test/pantryStock.test.ts.

import type { PantryItem, PantryPacket } from "./pb";
import type { RecipeMeasures } from "./volumes.ts";
import { lineMeasure, scaleLine } from "./scaling.ts";
import { packetsOf } from "./pantryPackets.ts";

type Kind = "mass" | "volume";
export interface Quantity {
  kind: Kind;
  // In grams or millilitres.
  amount: number;
}

export type Cover =
  | { kind: "unknown" }
  | { kind: "enough"; have: string }
  // still: the share of what's needed left to buy, between 0 and 1.
  | { kind: "short"; have: string; still: number };

const UNKNOWN: Cover = { kind: "unknown" };
const US_MEASURES: RecipeMeasures = { tablespoon: 15, cup: 240, fluidOunce: 29.57, pint: 473 };

// Grams or millilitres per unit, as scaling.ts names them (a recipe's spoons
// and cups as its site measures them: volumes.ts).
function perUnit(unit: string, measures: RecipeMeasures): { kind: Kind; size: number } | null {
  const u = unit.toLowerCase().replace(/\./g, "").replace(/\s+/g, " ").trim();
  if (/^(g|gr|grams?)$/.test(u)) return { kind: "mass", size: 1 };
  if (/^(kgs?|kilos?|kilograms?)$/.test(u)) return { kind: "mass", size: 1000 };
  if (/^(fl oz|fluid ounces?)$/.test(u)) return { kind: "volume", size: measures.fluidOunce };
  if (/^(oz|ounces?)$/.test(u)) return { kind: "mass", size: 28.3495 };
  if (/^(lbs?|pounds?)$/.test(u)) return { kind: "mass", size: 453.592 };
  if (/^(ml|millilit(re|er)s?)$/.test(u)) return { kind: "volume", size: 1 };
  if (u === "cl") return { kind: "volume", size: 10 };
  if (u === "dl") return { kind: "volume", size: 100 };
  if (/^(l|lit(re|er)s?)$/.test(u)) return { kind: "volume", size: 1000 };
  if (/^(teaspoons?|tsps?|tl|theelepels?)$/.test(u)) return { kind: "volume", size: 5 };
  if (/^(tablespoons?|tbsps?|tbs|tbl|el|eetlepels?)$/.test(u)) return { kind: "volume", size: measures.tablespoon };
  if (/^cups?$/.test(u)) return { kind: "volume", size: measures.cup };
  if (/^(pints?|pt)$/.test(u)) return { kind: "volume", size: measures.pint };
  if (/^(quarts?|qts?)$/.test(u)) return { kind: "volume", size: measures.pint * 2 };
  if (/^(gallons?|gal)$/.test(u)) return { kind: "volume", size: measures.pint * 8 };
  return null;
}

// How much a line or a packet size says, in grams or millilitres, or null
// when it isn't a measure ("2 onions").
export function quantityOf(text: string, measures: RecipeMeasures = US_MEASURES): Quantity | null {
  const measure = lineMeasure(text);
  const unit = measure && perUnit(measure.unit, measures);
  if (!measure || !unit || !(measure.amount > 0)) return null;
  return { kind: unit.kind, amount: measure.amount * unit.size };
}

// How much is in a packet: what's left of it once cooking used some, else
// its size.
export function packetAmount(packet: Pick<PantryPacket, "size" | "left">): Quantity | null {
  return quantityOf((packet.left || packet.size) ?? "");
}

type Sized = Pick<PantryPacket, "size" | "left">;

// All of a pantry item's packets together, or null if any of them has no
// size Bentotachi can read, or they mix grams and millilitres.
function stockOf(packets: Sized[]): Quantity | null {
  if (!packets.length) return null;
  const sizes = packets.map(packetAmount);
  const first = sizes[0];
  if (!first || sizes.some((size) => !size || size.kind !== first.kind)) return null;
  return { kind: first.kind, amount: sizes.reduce((sum, size) => sum + (size?.amount ?? 0), 0) };
}

const twoDecimals = (n: number) => String(Math.round(n * 100) / 100);

// An amount as people would say it: "750 ml", "1.25 kg".
export function amountLabel({ kind, amount }: Quantity): string {
  const [small, big] = kind === "mass" ? ["g", "kg"] : ["ml", "L"];
  return amount >= 1000 ? `${twoDecimals(amount / 1000)} ${big}` : `${Math.round(amount)} ${small}`;
}

// What's in stock, as people would say it: "500 g", "2 × 500 g", or the
// total when the packets differ or some are partly used ("1.25 kg").
function stockLabel(packets: Sized[], stock: Quantity): string {
  if (packets.some((packet) => packet.left)) return amountLabel(stock);
  const sizes = packets.map((packet) => (packet.size ?? "").trim());
  if (sizes.every((size) => size === sizes[0])) return sizes.length > 1 ? `${sizes.length} × ${sizes[0]}` : sizes[0];
  return amountLabel(stock);
}

type Need = { line: string; measures?: RecipeMeasures };

// The total of some lines in grams or millilitres, or null if any can't be
// read in that kind of measure.
function totalOf(needs: Need[], kind: Kind): number | null {
  let total = 0;
  for (const { line, measures } of needs) {
    const quantity = quantityOf(line, measures ?? US_MEASURES);
    if (!quantity || quantity.kind !== kind) return null;
    total += quantity.amount;
  }
  return total;
}

// How a pantry item's packets cover what some recipe lines need of it (each
// line with its recipe's measures). Unknown unless every line and packet
// can be read in the same kind of measure. `setAside`: what other lines use
// of these packets first (a recipe asking for linguine, before one where
// any pasta will do); then only what's left counts ("300 g spare").
export function coverOf(needs: Need[], packets: Sized[], { setAside = [] as Quantity[] } = {}): Cover {
  const stock = stockOf(packets);
  if (!stock || !needs.length) return UNKNOWN;
  const needed = totalOf(needs, stock.kind);
  if (needed === null || setAside.some((part) => part.kind !== stock.kind)) return UNKNOWN;
  const used = setAside.reduce((sum, part) => sum + part.amount, 0);
  const left = Math.max(0, stock.amount - used);
  const have = used > 0 ? (left > 0 ? `${amountLabel({ kind: stock.kind, amount: left })} spare` : "none spare") : stockLabel(packets, stock);
  // On purpose: a few percent short counts as enough. Labels and units
  // differ that much (a 32 fl oz carton is 946 ml, 4 cups 960 ml), and
  // "⅛ cup broth" or "0 L stock" on the list helps nobody.
  if (left >= needed * (1 - NEAR_ENOUGH)) return { kind: "enough", have };
  return { kind: "short", have, still: (needed - left) / needed };
}

// Covers for everything a recipe or a week's plan needs from the pantry,
// by key: a specific item's lines count against its own packets first; a
// group's ("any pasta") against all its kinds' packets, less what the lines
// asking for one of those kinds take from that kind's own packets, so one
// bag isn't counted twice. A kind takes at most what its packets hold (none
// when it has none), or all of them when its lines can't be measured.
export function coversFor(
  groups: { key: string; items: Pick<PantryItem, "id">[]; needs: Need[]; anyKind: boolean }[],
  packets: Pick<PantryPacket, "id" | "item" | "brand" | "size" | "created">[]
): Map<string, Cover> {
  const covers = new Map<string, Cover>();
  const packetsFor = (items: Pick<PantryItem, "id">[]) => items.flatMap((item) => packetsOf(packets, item.id));
  const takes = (other: { items: Pick<PantryItem, "id">[]; needs: Need[] }): Quantity | null => {
    const own = stockOf(packetsFor(other.items));
    if (!own) return null;
    const need = totalOf(other.needs, own.kind);
    return { kind: own.kind, amount: need === null ? own.amount : Math.min(need, own.amount) };
  };
  for (const group of groups) {
    if (group.anyKind) {
      const kinds = new Set(group.items.map((item) => item.id));
      const setAside = groups
        .filter((other) => !other.anyKind && other.items.some((item) => kinds.has(item.id)))
        .map(takes)
        .filter((part): part is Quantity => part !== null);
      covers.set(group.key, coverOf(group.needs, packetsFor(group.items), { setAside }));
    } else {
      covers.set(group.key, coverOf(group.needs, packetsFor(group.items)));
    }
  }
  return covers;
}

const NEAR_ENOUGH = 0.05;

// Whether it's worth buying: the packets are short, or (when they can't
// tell) the pantry is low on it, out of it, or doesn't have it at all.
// On purpose, marked Low beats packets that look like enough: one of them
// may be nearly empty, as packets don't say how much is left.
export function worthBuying(item: Pick<PantryItem, "status"> | null, cover: Cover): boolean {
  if (cover.kind === "short") return true;
  if (cover.kind === "enough") return item?.status === "low";
  return item?.status !== "have";
}

// A line as it goes on the list: only what's still to buy when the pantry
// is short ("1.5 kg linguine" with 200 g in -> "1.3 kg linguine"), rounded
// up rather than to the nearest ("1 lb" with 200 g in is "⅔ lb", not "½").
export function stillToBuy(line: string, cover: Cover): string {
  if (cover.kind !== "short") return line;
  const target = (lineMeasure(line)?.amount ?? 0) * cover.still;
  for (let factor = cover.still; factor < 1; factor *= 1.02) {
    const scaled = scaleLine(line, factor);
    if ((lineMeasure(scaled)?.amount ?? Infinity) >= target * 0.999) return scaled;
  }
  return line;
}

// The note beside a line in the add choices: "Enough: 2 × 500 g",
// "Enough: 500 g, but marked Low", "Have 200 g", or nothing when it can't
// tell.
export function coverNote(cover: Cover, item?: Pick<PantryItem, "status"> | null): string {
  if (cover.kind === "enough") return `Enough: ${cover.have}${item?.status === "low" ? ", but marked Low" : ""}`;
  if (cover.kind === "short") return cover.have === "none spare" ? "None spare" : `Have ${cover.have}`;
  return "";
}
