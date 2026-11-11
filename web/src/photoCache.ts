// Photos kept on the phone for offline (Settings, "Keep photos for
// offline"): the 600-wide copies of recipes' covers and step photos, and
// pantry items' small squares, in the browser's Cache Storage, which has
// far more room than the text copies' storage (offline.ts). Each is kept
// under its own address, so showing one offline is a lookup by that
// address (KeptPhotos.tsx). Only where Cache Storage exists: the app, and
// browsers on https or this computer.

import { useSyncExternalStore } from "react";
import type { PantryItem, Recipe } from "./pb";
import { remember, remembered } from "./phoneStorage.ts";

export const PHOTO_CACHE = "bento-photos";
const KEEP_KEY = "bento.keepPhotos";
// A recipe photo's 600-wide copy is about this big (on the household's
// server, 90 of them came to 18 MB); a pantry square is small enough to
// leave out.
const RECIPE_PHOTO_BYTES = 200_000;

export function photoCacheAvailable(): boolean {
  return typeof caches !== "undefined";
}

// What it's doing, for Settings: how many of the wanted photos are kept,
// their size, and whether it's fetching more now.
export interface PhotoStatus {
  on: boolean;
  kept: number;
  wanted: number;
  bytes: number;
  filling: boolean;
  // The phone said it had no more room: no more are fetched until next time.
  full: boolean;
}

let status: PhotoStatus = { on: remembered(KEEP_KEY) === "1", kept: 0, wanted: 0, bytes: 0, filling: false, full: false };
const listeners = new Set<() => void>();
function update(change: Partial<PhotoStatus>) {
  status = { ...status, ...change };
  for (const listener of listeners) listener();
}
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const photoStatus = () => status;
export function usePhotoStatus(): PhotoStatus {
  return useSyncExternalStore(subscribe, photoStatus);
}

// Turning it off empties the cache straight away: the room is the point.
export async function keepPhotos(on: boolean) {
  remember(KEEP_KEY, on ? "1" : null);
  update({ on });
  if (!on) await forgetPhotos();
}

async function forgetPhotos() {
  update({ kept: 0, bytes: 0, full: false });
  if (photoCacheAvailable()) await caches.delete(PHOTO_CACHE);
}

// How the addresses are made (pb.ts), passed in so this file needs none of
// pb.ts's code.
export interface PhotoAddresses {
  cover: (recipe: Recipe) => string;
  step: (recipe: Recipe, name: string) => string;
  pantry: (item: PantryItem) => string;
}

// Every photo the household has that's worth keeping, by address.
export function wantedPhotos(recipes: Recipe[], items: PantryItem[], address: PhotoAddresses): string[] {
  const urls = new Set<string>();
  for (const recipe of recipes) {
    if (recipe.image) urls.add(address.cover(recipe));
    for (const name of recipe.photos ?? []) urls.add(address.step(recipe, name));
  }
  for (const item of items) if (item.photo) urls.add(address.pantry(item));
  return [...urls].filter(Boolean);
}

// Roughly how much room keeping them takes, before any are kept.
export function roughBytes(recipes: Recipe[]): number {
  return recipes.reduce((sum, recipe) => sum + ((recipe.image ? 1 : 0) + (recipe.photos?.length ?? 0)) * RECIPE_PHOTO_BYTES, 0);
}

// "18 MB", "800 KB".
export function sizeText(bytes: number): string {
  if (bytes < 1_000_000) return `${Math.max(1, Math.round(bytes / 1000))} KB`;
  return `${Math.round(bytes / 1_000_000)} MB`;
}

// An address the way the cache gives it back ("HTTP://MyPi:80/x" is
// "http://mypi/x"), so a kept photo is always recognised as kept, not
// dropped and fetched again on every run.
function cacheAddress(url: string): string {
  try {
    return new Request(url).url;
  } catch {
    return url;
  }
}

// How many photos are kept and their size, from the cache alone, for
// Settings when the server can't be reached to say which are wanted.
export async function countKept(cache: Cache): Promise<void> {
  const keys = await cache.keys();
  let bytes = 0;
  for (const request of keys) bytes += await keptSize(cache, request.url);
  update({ kept: keys.length, bytes });
}

// Brings the cache in line with `wanted`: drops photos no longer wanted
// (deleted, replaced), then fetches the missing ones one at a time, so a
// phone on mobile data isn't flooded. A photo that won't come is tried
// again next time. `stopped` ends it early (the switch turned off). A
// phone with no room left stops it too, rather than fetching every photo
// only to throw it away.
export async function fillPhotos(
  wanted: string[],
  { cache, send = fetch, stopped = () => false }: { cache: Cache; send?: typeof fetch; stopped?: () => boolean }
): Promise<void> {
  const want = new Set(wanted.map(cacheAddress));
  const keys = await cache.keys();
  const have = new Set<string>();
  for (const request of keys) {
    if (want.has(request.url)) have.add(request.url);
    else await cache.delete(request);
  }
  let bytes = 0;
  for (const url of have) bytes += await keptSize(cache, url);
  update({ wanted: want.size, kept: have.size, bytes, filling: true, full: false });
  let refusedInARow = 0;
  try {
    for (const url of want) {
      if (stopped()) return;
      if (have.has(url)) continue;
      let blob: Blob;
      try {
        const answer = await send(url);
        if (!answer.ok || !(answer.headers.get("content-type") ?? "").startsWith("image/")) continue;
        blob = await answer.blob();
      } catch {
        // No connection, or this one's gone: tried again next time.
        continue;
      }
      try {
        // Its size saved with it, so adding them up needn't read every photo.
        await cache.put(url, new Response(blob, { headers: { "content-type": blob.type, "x-bento-size": String(blob.size) } }));
      } catch (err) {
        if ((err as { name?: unknown } | null)?.name === "QuotaExceededError") {
          update({ full: true });
          return;
        }
        // Storage refused this one for another reason: tried again next time.
        // Three in a row is the phone out of room under another name: stop,
        // rather than fetching every photo to throw it away.
        console.warn("Couldn't keep a photo", url, err);
        refusedInARow += 1;
        if (refusedInARow >= 3) {
          update({ full: true });
          return;
        }
        continue;
      }
      refusedInARow = 0;
      have.add(url);
      bytes += blob.size;
      update({ kept: have.size, bytes });
    }
  } finally {
    update({ filling: false });
  }
}

async function keptSize(cache: Cache, url: string): Promise<number> {
  const kept = await cache.match(url);
  return Number(kept?.headers.get("x-bento-size")) || 0;
}

// The kept copy of a photo, as an address an <img> can show, or null.
// The caller lets it go (URL.revokeObjectURL) when done.
export async function keptPhoto(url: string): Promise<string | null> {
  if (!photoCacheAvailable() || !url) return null;
  try {
    const kept = await (await caches.open(PHOTO_CACHE)).match(url);
    return kept ? URL.createObjectURL(await kept.blob()) : null;
  } catch {
    // Storage blocked: the photo just doesn't show offline.
    return null;
  }
}
