// Lengths in recipes, converted for the household as a soft hint:
// "cut into 1-inch *(2.5 cm)* pieces" and "a 9x13 pan *(23×33 cm)*" in
// Australia (and anywhere else that measures in centimetres), "2cm *(¾ in)*
// cubes" in the US. A line that already gives both gets no hint.

import { NUMBER, parseNumber } from "./weights.ts";

const LEAD = String.raw`(?<!\d)(?<!\d[.,])`;
// An inch is "inch", "inches" or a " (straight or curly) right after the
// number, maybe joined by a hyphen ("1-inch", "1/2"").
const INCH = String.raw`(?:\s*-?\s*inch(?:es)?(?![a-z])|\s?["”″](?![a-z]))`;
// A size: "9x13 inch", "13x9-inch", "8 x 8 inches", "17″x10″", or "9x13 pan"
// (pans in recipes that don't say are in inches).
const SIZE_INCHES = new RegExp(
  // (The word between the size and "pan" can't be a unit: "20 x 30 cm tin".)
  String.raw`${LEAD}(${NUMBER})(?:\s?["”″])?\s*[x×]\s*(${NUMBER})(?:${INCH}|(?=\s+(?:(?!(?:cm|mm|centimet)[a-z]*\s)[a-z-]+\s+)?(?:pan|dish|tin|tray|baking)\b))`,
  "gi",
);
// One length, or a range ("1-2 inch"): groups 1 and 2.
const INCHES = new RegExp(String.raw`${LEAD}(${NUMBER})(?:\s*(?:-|–|to)\s*(${NUMBER}))?${INCH}`, "gi");
const SIZE_CM = new RegExp(String.raw`${LEAD}(${NUMBER})\s*[x×]\s*(${NUMBER})\s*(?:cm|centimet(?:re|er)s?)(?![a-z])`, "gi");
const CM = new RegExp(String.raw`${LEAD}(${NUMBER})(?:\s*(?:-|–|to)\s*(${NUMBER}))?\s*-?\s*(?:cm|centimet(?:re|er)s?)(?![a-z])`, "gi");

// Centimetres as people would measure: "0.6", "2.5", "23".
function cm(inches: number): string {
  const value = inches * 2.54;
  return value < 3 ? String(Math.round(value * 10) / 10) : String(Math.round(value));
}

// Inches with simple fractions: "¼", "¾", "1 ½", "12".
function inches(centimetres: number): string {
  const value = centimetres / 2.54;
  const step = value < 3 ? 0.25 : value < 12 ? 0.5 : 1;
  const rounded = Math.max(0.25, Math.round(value / step) * step);
  const whole = Math.floor(rounded);
  const part = { 0: "", 0.25: "¼", 0.5: "½", 0.75: "¾" }[rounded - whole] ?? "";
  return whole ? `${whole}${part ? ` ${part}` : ""}` : part;
}

interface Found {
  start: number;
  end: number;
  hint: string;
}

// Sizes first, then single lengths that aren't part of a size.
function find(line: string, toCm: boolean): Found[] {
  const show = toCm ? (n: string) => cm(parseNumber(n)) : (n: string) => inches(parseNumber(n));
  const unit = toCm ? "cm" : "in";
  const found: Found[] = [];
  for (const m of line.matchAll(toCm ? SIZE_INCHES : SIZE_CM)) {
    found.push({ start: m.index, end: m.index + m[0].length, hint: `${show(m[1])}×${show(m[2])} ${unit}` });
  }
  for (const m of line.matchAll(toCm ? INCHES : CM)) {
    const start = m.index;
    if (found.some((f) => start < f.end && f.start < start + m[0].length)) continue;
    const hint = m[2] ? `${show(m[1])}–${show(m[2])} ${unit}` : `${show(m[1])} ${unit}`;
    found.push({ start, end: start + m[0].length, hint });
  }
  return found.sort((a, b) => a.start - b.start);
}

export function withLengthHint(line: string, country: string): string {
  const toCm = country !== "US";
  // Already in the household's units: nothing to add.
  if (find(line, !toCm).length) return line;
  let result = "";
  let at = 0;
  for (const f of find(line, toCm)) {
    result += `${line.slice(at, f.end)} *(${f.hint})*`;
    at = f.end;
  }
  return at ? result + line.slice(at) : line;
}
