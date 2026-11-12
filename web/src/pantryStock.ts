// How much of a recipe's ingredient the pantry's packets cover, so the list
// gets only what's short ("1.3 kg linguine" with 200 g in, "3 eggs" with a
// carton of 12). A packet counts as full unless cooking left some ("left").
// Where it can't tell (no sizes, or grams against a count), Have / Low /
// Out decides as before.
// Tested in web/test/pantryStock.test.ts.

import type { PantryItem, PantryPacket } from "./pb";
import type { RecipeMeasures } from "./volumes.ts";
import { lineMeasure, scaleLine } from "./scaling.ts";
import { packetsOf } from "./pantryPackets.ts";
import { findMention } from "./wordMatch.ts";
import { otherNames } from "./regionalNames.ts";

type Kind = "mass" | "volume" | "count";
export interface Quantity {
  kind: Kind;
  // In grams or millilitres, or how many ("12" eggs).
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

// Words after a number that make it a number of something else, not of the
// thing itself: "1 tin chickpeas", "2 cloves garlic", "3 slices bread".
const NOT_COUNTED =
  /^(tins?|cans?|jars?|packets?|packs?|bags?|box(es)?|bottles?|cartons?|sachets?|tubs?|punnets?|bunch(es)?|cloves?|sprigs?|slices?|heads?|stalks?|ribs?|sticks?|handfuls?|pinch(es)?|dash(es)?|drops?|leaves|leaf|rashers?|fillets?|pieces?|wedges?|segments?|knobs?|squares?|strips?|sheets?|cubes?|scoops?|shots?|splash(es)?|whites?|yolks?|sizes?|times?|serves?|servings?|portions?|people|cm|mm|inch(es)?|%)(?![a-z])/;

// A bare number bigger than this ("1000") is more likely grams typed without
// a unit than a count: the biggest egg tray is 30.
const MOST_BARE = 60;

// Words that may come between a count and the thing ("2 large free-range
// eggs"). Only these: any other is likely another thing named after it
// ("cherry tomatoes", "spring onions", "quail eggs"), so it can't tell.
const DESCRIBING = new Set(
  "large medium small big extra jumbo whole fresh ripe free range organic red brown white yellow purple golden firm raw peeled unpeeled cold".split(" ")
);

// What may follow the thing's name: the end, punctuation, "and", or a
// word saying how it's prepared ("chopped", "finely"). Not another word,
// which makes it something else ("corn tortillas", "apple pies").
const AFTER_NAME = /^(\s*($|[,;:(\-–—/)])|\s+(and|plus|or|to|for|at)\b|\s+[a-z]+(ed|ly)\b)/;

// A part of the thing, anywhere in the line: "1 egg yolk", "2 garlic cloves".
const PART = /\b(yolks?|whites? of|egg whites?|cloves?|zest|juice|rind)\b/;

// After a packet size's count: "6 pcs", "12-pack", "10 units".
const COUNT_WORD = /^-?(pack|pk|pcs?|ct|count|each|units?)(?![a-z])\s*/;

// Whether `rest` (a line after its number) names the thing counted: one of
// `names` straight after the number, give or take describing words
// ("large eggs"), and then nothing that makes it another thing ("celery
// stalks", "corn tortillas").
function namesThing(rest: string, names: string[]): boolean {
  return names.some((name) => {
    const at = findMention(rest, name);
    if (!at) return false;
    const before = rest.slice(0, at.start).toLowerCase().replace(/[-,]/g, " ").trim();
    if (before && !before.split(/\s+/).every((word) => DESCRIBING.has(word))) return false;
    return AFTER_NAME.test(rest.slice(at.end).toLowerCase());
  });
}

// A count: a recipe line's whole number of the thing itself ("3 eggs", "2
// large onions", "3-4 eggs" as 4) when one of `names` is that thing, or a
// packet's size ("12", "12 eggs", "dozen", "6 pcs", and as a `packet` "12 x
// 60 g"), or null. Not a part ("½ onion", "1 egg yolk"), nor a number of
// something else ("2 celery stalks", "5 cm ginger", "500 g"). Without
// `names` a line's number isn't checked against the thing (stillToBuy, on
// a line already found to be a count).
function countOf(text: string, { packet = false, names }: { packet?: boolean; names?: string[] } = {}): number | null {
  const words = text.trim().toLowerCase();
  const dozen = words.match(/^(?:(\d+)\s+|a\s+|half\s+(?:a\s+)?)?dozen(?![a-z])/);
  if (dozen) return /^half/.test(words) ? 6 : 12 * Number(dozen[1] ?? 1);
  const lead = words.match(/^(\d+)(?:\s*[-–]\s*(\d+))?(?![\d.,/])\s*(.*)$/);
  if (!lead || PART.test(words)) return null;
  const n = Number(lead[2] ?? lead[1]);
  let rest = lead[3];
  if (!(n > 0)) return null;
  // "12 x 60 g": twelve of them, each 60 g. In a recipe it's more often
  // "2 x 400 g tins", a count of tins.
  if (/^[x×]\s*\d/.test(rest)) return packet ? n : null;
  if (packet) {
    rest = rest.replace(COUNT_WORD, "");
    if (!rest && n > MOST_BARE) return null;
  }
  // "1 (400 g) can tomatoes": what's after the brackets says what's counted.
  rest = rest.replace(/^\([^)]*\)\s*/, "");
  if (/^[\d½¼¾⅓⅔⅛]/.test(rest) || NOT_COUNTED.test(rest)) return null;
  const firstWord = rest.split(/[\s,(]/)[0];
  if (firstWord && perUnit(firstWord, US_MEASURES)) return null;
  if (!packet && names && !namesThing(rest, names)) return null;
  return n;
}

// How much a line or a packet size says: in grams or millilitres, or how
// many (countOf), or null when it can't tell ("½ onion", "1 tin beans"). A
// line is a count only of one of `names` (a pantry item's names), so with
// none given it never is.
export function quantityOf(
  text: string,
  measures: RecipeMeasures = US_MEASURES,
  { packet = false, names = [] }: { packet?: boolean; names?: string[] } = {}
): Quantity | null {
  const measure = lineMeasure(text);
  const unit = measure && perUnit(measure.unit, measures);
  if (measure && unit && measure.amount > 0) return { kind: unit.kind, amount: measure.amount * unit.size };
  const count = countOf(text, { packet, names });
  return count === null ? null : { kind: "count", amount: count };
}

// The names a line counting one of these items may use: each one's name
// and its other region's ("eggplant", "aubergine").
export function namesOf(items: Pick<PantryItem, "name">[]): string[] {
  return items.flatMap((item) => (item.name ? [item.name, ...otherNames(item.name)] : []));
}

// How much is in a packet: what's left of it once cooking used some, else
// its size.
export function packetAmount(packet: Pick<PantryPacket, "size" | "left">): Quantity | null {
  return quantityOf((packet.left || packet.size) ?? "", US_MEASURES, { packet: true });
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

// An amount as people would say it: "750 ml", "1.25 kg", "9" (of them).
export function amountLabel({ kind, amount }: Quantity): string {
  if (kind === "count") return twoDecimals(amount);
  const [small, big] = kind === "mass" ? ["g", "kg"] : ["ml", "L"];
  return amount >= 1000 ? `${twoDecimals(amount / 1000)} ${big}` : `${Math.round(amount)} ${small}`;
}

// What's in stock, as people would say it: "500 g", "2 × 500 g", or the
// total when the packets differ or some are partly used ("1.25 kg").
function stockLabel(packets: Sized[], stock: Quantity): string {
  const sizes = packets.map((packet) => (packet.size ?? "").trim());
  const bareCounts = stock.kind === "count" && sizes.every((size) => /^\d+$/.test(size));
  if (!bareCounts && !packets.some((packet) => packet.left) && sizes.every((size) => size === sizes[0]))
    return sizes.length > 1 ? `${sizes.length} × ${sizes[0]}` : sizes[0];
  return stock.kind === "count" ? countLabel(stock.amount, sizes) : amountLabel(stock);
}

// A total count with the word its sizes use: "21 eggs" from "12 eggs"
// cartons, else just "21".
function countLabel(amount: number, sizes: string[]): string {
  const word = sizes.map((size) => size.match(/^\d+\s+([a-z]+)$/i)?.[1]).find((w) => w && !COUNT_WORD.test(w.toLowerCase()));
  return word && amount !== 1 ? `${amountLabel({ kind: "count", amount })} ${word}` : amountLabel({ kind: "count", amount });
}

// `names`: what the item is called, so "3 eggs" can count eggs (namesOf).
type Need = { line: string; measures?: RecipeMeasures; names?: string[] };

// The total of some lines in grams or millilitres, or how many, or null if
// any can't be read in that kind of measure.
function totalOf(needs: Need[], kind: Kind): number | null {
  let total = 0;
  for (const { line, measures, names } of needs) {
    const quantity = quantityOf(line, measures ?? US_MEASURES, { names });
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
  // "⅛ cup broth" or "0 L stock" on the list helps nobody. Counts are
  // exact: 19 eggs aren't enough for 20.
  const nearEnough = stock.kind === "count" ? 0 : NEAR_ENOUGH;
  if (left >= needed * (1 - nearEnough)) return { kind: "enough", have };
  return { kind: "short", have, still: (needed - left) / needed };
}

// Covers for everything a recipe or a week's plan needs from the pantry,
// by key: a specific item's lines count against its own packets first; a
// group's ("any pasta") against all its kinds' packets, less what the lines
// asking for one of those kinds take from that kind's own packets, so one
// bag isn't counted twice. A kind takes at most what its packets hold (none
// when it has none), or all of them when its lines can't be measured.
export function coversFor(
  groups: { key: string; items: Pick<PantryItem, "id" | "name">[]; needs: Need[]; anyKind: boolean }[],
  packets: Pick<PantryPacket, "id" | "item" | "brand" | "size" | "created">[]
): Map<string, Cover> {
  const covers = new Map<string, Cover>();
  // Each line may count what its own group's items are called.
  groups = groups.map((group) => {
    const names = namesOf(group.items);
    return { ...group, needs: group.needs.map((need) => ({ ...need, names: need.names ?? names })) };
  });
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
  // A line short of a count was already found to count its item.
  const amount = (text: string) => lineMeasure(text)?.amount ?? countOf(text) ?? undefined;
  const target = (amount(line) ?? 0) * cover.still;
  const counted = !lineMeasure(line) && countOf(line) !== null;
  for (let factor = cover.still; factor < 1; factor *= 1.02) {
    const scaled = scaleLine(line, factor);
    // A count only in whole ones: "2 eggs" to buy, never "1½ eggs".
    if (counted && countOf(scaled) === null) continue;
    if ((amount(scaled) ?? Infinity) >= target * 0.999) return scaled;
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
