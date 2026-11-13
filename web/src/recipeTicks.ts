// Ticked ingredients and steps, remembered on this device per recipe, so a
// trip to the shopping list mid-cook keeps your place. Kept until it's
// marked cooked, 12 hours after the last tick, or its ingredients or method
// change: ticks are by line number, so an edit could move them onto other
// lines. Hours rather than the calendar day, so cooking past midnight keeps
// them, and tomorrow's cook still starts clean.

import { remember, rememberedRecord } from "./phoneStorage.ts";

const KEY = "bento.recipeTicks";
export const TICKS_LAST_MS = 12 * 60 * 60 * 1000;

// For one recipe: when it was last ticked (ms), linesOf its ingredients and
// method then, and the ticked lines ("i0" an ingredient, "s2" a step).
interface Ticked {
  at: number;
  lines: string;
  keys: string[];
}

type AllTicks = Record<string, Ticked>;

// A short fingerprint of the ingredients and method, to notice they changed
// (a note or a tag changing doesn't count).
export function linesOf(ingredients: string[] | null | undefined, steps: string[] | null | undefined): string {
  const text = JSON.stringify([ingredients ?? [], steps ?? []]);
  let hash = 5381;
  for (let i = 0; i < text.length; i++) hash = (hash * 33 + text.charCodeAt(i)) | 0;
  return `${text.length}:${(hash >>> 0).toString(36)}`;
}

// A saved set of ticks still fresh at `now`. (Older apps saved a `day`
// instead of `at`: those are dropped, at most one cook's ticks once.)
function isFresh(value: unknown, now: number): value is Ticked {
  if (!value || typeof value !== "object") return false;
  const { at, lines, keys } = value as Partial<Ticked>;
  return (
    typeof at === "number" &&
    now - at < TICKS_LAST_MS &&
    typeof lines === "string" &&
    Array.isArray(keys) &&
    keys.every((key) => typeof key === "string")
  );
}

function read(): AllTicks {
  return rememberedRecord(KEY) as AllTicks;
}

// This recipe's ticks, if they're fresh and its lines haven't changed.
export function ticksOf(all: AllTicks, id: string, now: number, lines: string): string[] {
  const ticked = all[id];
  return isFresh(ticked, now) && ticked.lines === lines ? ticked.keys : [];
}

// All ticks with this recipe's set (none forgets it). Other recipes' stale
// ones go too, so nothing piles up.
export function withTicks(all: AllTicks, id: string, now: number, lines: string, keys: Iterable<string>): AllTicks {
  const next: AllTicks = {};
  for (const [other, ticked] of Object.entries(all)) if (other !== id && isFresh(ticked, now)) next[other] = ticked;
  const list = [...keys];
  if (list.length) next[id] = { at: now, lines, keys: list };
  return next;
}

export function savedTicks(id: string, lines: string): Set<string> {
  return new Set(ticksOf(read(), id, Date.now(), lines));
}

export function saveTicks(id: string, lines: string, keys: Set<string>) {
  remember(KEY, JSON.stringify(withTicks(read(), id, Date.now(), lines, keys)));
}
