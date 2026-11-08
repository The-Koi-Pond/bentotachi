// How much of a recipe's ingredient the pantry's packets cover, so the list
// gets only what's short ("1.3 kg linguine" with 200 g in). Every packet
// counts as full (they don't say how much is left; docs/PLAN.md). Where it
// can't tell ("2 onions", no sizes), Have / Low / Out decides as before.
// Tested in web/test/pantryStock.test.ts.

import type { PantryItem, PantryPacket } from "./pb";
import type { RecipeMeasures } from "./volumes.ts";
import { lineMeasure, scaleLine } from "./scaling.ts";

type Kind = "mass" | "volume";
interface Quantity {
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

function quantityOf(text: string, measures: RecipeMeasures): Quantity | null {
  const measure = lineMeasure(text);
  const unit = measure && perUnit(measure.unit, measures);
  if (!measure || !unit || !(measure.amount > 0)) return null;
  return { kind: unit.kind, amount: measure.amount * unit.size };
}

// All of a pantry item's packets together, or null if any of them has no
// size Bentotachi can read, or they mix grams and millilitres.
function stockOf(packets: Pick<PantryPacket, "size">[]): Quantity | null {
  if (!packets.length) return null;
  const sizes = packets.map((packet) => quantityOf(packet.size ?? "", US_MEASURES));
  const first = sizes[0];
  if (!first || sizes.some((size) => !size || size.kind !== first.kind)) return null;
  return { kind: first.kind, amount: sizes.reduce((sum, size) => sum + (size?.amount ?? 0), 0) };
}

const twoDecimals = (n: number) => String(Math.round(n * 100) / 100);

// What's in stock, as people would say it: "500 g", "2 × 500 g", or the
// total when the packets differ ("1.25 kg", "750 ml").
function stockLabel(packets: Pick<PantryPacket, "size">[], stock: Quantity): string {
  const sizes = packets.map((packet) => (packet.size ?? "").trim());
  if (sizes.every((size) => size === sizes[0])) return sizes.length > 1 ? `${sizes.length} × ${sizes[0]}` : sizes[0];
  const [small, big] = stock.kind === "mass" ? ["g", "kg"] : ["ml", "L"];
  return stock.amount >= 1000 ? `${twoDecimals(stock.amount / 1000)} ${big}` : `${Math.round(stock.amount)} ${small}`;
}

// How a pantry item's packets cover what some recipe lines need of it (each
// line with its recipe's measures). Unknown unless every line and packet
// can be read in the same kind of measure.
export function coverOf(
  needs: { line: string; measures?: RecipeMeasures }[],
  packets: Pick<PantryPacket, "size">[]
): Cover {
  const stock = stockOf(packets);
  if (!stock || !needs.length) return UNKNOWN;
  let needed = 0;
  for (const { line, measures } of needs) {
    const quantity = quantityOf(line, measures ?? US_MEASURES);
    if (!quantity || quantity.kind !== stock.kind) return UNKNOWN;
    needed += quantity.amount;
  }
  const have = stockLabel(packets, stock);
  if (stock.amount >= needed) return { kind: "enough", have };
  return { kind: "short", have, still: (needed - stock.amount) / needed };
}

// Whether it's worth buying: the packets are short, or (when they can't
// tell) the pantry is low on it, out of it, or doesn't have it at all.
export function worthBuying(item: Pick<PantryItem, "status"> | null, cover: Cover): boolean {
  if (cover.kind !== "unknown") return cover.kind === "short";
  return item?.status !== "have";
}

// A line as it goes on the list: only what's still to buy when the pantry
// is short ("1.5 kg linguine" with 200 g in -> "1.3 kg linguine").
export function stillToBuy(line: string, cover: Cover): string {
  return cover.kind === "short" ? scaleLine(line, cover.still) : line;
}

// The note beside a line in the add choices: "Enough: 2 × 500 g",
// "Have 200 g", or nothing when it can't tell.
export function coverNote(cover: Cover): string {
  if (cover.kind === "enough") return `Enough: ${cover.have}`;
  if (cover.kind === "short") return `Have ${cover.have}`;
  return "";
}
