// Ticked ingredients and steps, remembered on this device per recipe, so a
// trip to the shopping list mid-cook keeps your place. Kept until it's
// marked cooked, the next day, or its ingredients or method change: ticks
// are by line number, so an edit could move them onto other lines.

import { remember, rememberedRecord } from "./phoneStorage.ts";

const KEY = "bento.recipeTicks";

// For one recipe: the day ticked, linesOf its ingredients and method then,
// and the ticked lines ("i0" an ingredient, "s2" a step).
interface Ticked {
  day: string;
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

function isTicked(value: unknown): value is Ticked {
  if (!value || typeof value !== "object") return false;
  const { day, lines, keys } = value as Partial<Ticked>;
  return typeof day === "string" && typeof lines === "string" && Array.isArray(keys) && keys.every((key) => typeof key === "string");
}

function read(): AllTicks {
  return rememberedRecord(KEY) as AllTicks;
}

// This recipe's ticks, if they're from today and its lines haven't changed.
export function ticksOf(all: AllTicks, id: string, today: string, lines: string): string[] {
  const ticked = all[id];
  return isTicked(ticked) && ticked.day === today && ticked.lines === lines ? ticked.keys : [];
}

// All ticks with this recipe's set (none forgets it). Other recipes' from
// earlier days go too, so nothing piles up.
export function withTicks(all: AllTicks, id: string, today: string, lines: string, keys: Iterable<string>): AllTicks {
  const next: AllTicks = {};
  for (const [other, ticked] of Object.entries(all)) if (other !== id && isTicked(ticked) && ticked.day === today) next[other] = ticked;
  const list = [...keys];
  if (list.length) next[id] = { day: today, lines, keys: list };
  return next;
}

export function savedTicks(id: string, today: string, lines: string): Set<string> {
  return new Set(ticksOf(read(), id, today, lines));
}

export function saveTicks(id: string, today: string, lines: string, keys: Set<string>) {
  remember(KEY, JSON.stringify(withTicks(read(), id, today, lines, keys)));
}
