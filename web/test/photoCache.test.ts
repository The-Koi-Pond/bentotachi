// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { PHOTO_CACHE, countKept, fillPhotos, keepPhotos, keptPhoto, photoStatus, roughBytes, sizeText, wantedPhotos } from "../src/photoCache.ts";
import type { PantryItem, Recipe } from "../src/pb";

const address = {
  cover: (recipe: Recipe) => `https://pi.example/r/${recipe.id}/${recipe.image}?thumb=600x0`,
  step: (recipe: Recipe, name: string) => `https://pi.example/r/${recipe.id}/${name}?thumb=600x0`,
  pantry: (item: PantryItem) => `https://pi.example/p/${item.id}/${item.photo}`,
};
const recipe = (id: string, image: string, photos: string[] = []) => ({ id, image, photos }) as unknown as Recipe;
const item = (id: string, photo: string) => ({ id, photo }) as unknown as PantryItem;

test("the photos worth keeping: covers, step photos and pantry squares, each once", () => {
  assert.deepEqual(
    wantedPhotos([recipe("a", "a.jpg", ["s1.jpg", "s2.jpg"]), recipe("b", ""), recipe("c", "c.jpg")], [item("p", "p.png"), item("q", "")], address),
    [
      "https://pi.example/r/a/a.jpg?thumb=600x0",
      "https://pi.example/r/a/s1.jpg?thumb=600x0",
      "https://pi.example/r/a/s2.jpg?thumb=600x0",
      "https://pi.example/r/c/c.jpg?thumb=600x0",
      "https://pi.example/p/p/p.png",
    ]
  );
});

test("how much room, roughly, and in words", () => {
  assert.equal(roughBytes([recipe("a", "a.jpg", ["s1.jpg"]), recipe("b", "")]), 400_000);
  assert.equal(sizeText(18_400_000), "18 MB");
  assert.equal(sizeText(400_000), "400 KB");
  assert.equal(sizeText(0), "1 KB");
});

// Cache Storage's Cache, as much of it as fillPhotos uses. Like the real
// one it keeps each address in the form the browser writes it.
function fakeCache(start: Record<string, number> = {}, { full = false } = {}) {
  const kept = new Map<string, Response>();
  const key = (url: string) => new Request(url).url;
  for (const [url, size] of Object.entries(start)) kept.set(key(url), new Response("x", { headers: { "x-bento-size": String(size) } }));
  const cache = {
    keys: async () => [...kept.keys()].map((url) => new Request(url)),
    delete: async (request: Request) => kept.delete(request.url),
    match: async (url: string) => kept.get(key(url))?.clone(),
    put: async (url: string, response: Response) => {
      if (full) throw new DOMException("The quota has been exceeded.", "QuotaExceededError");
      kept.set(key(url), response);
    },
  };
  return { cache: cache as unknown as Cache, kept };
}

const image = (bytes: number) => new Response(new Blob([new Uint8Array(bytes)], { type: "image/jpeg" }), { headers: { "content-type": "image/jpeg" } });

test("filling keeps what's wanted, drops what's gone, and fetches only what's missing", async () => {
  const { cache, kept } = fakeCache({ "https://pi.example/old": 50, "https://pi.example/a": 100 });
  const fetched: string[] = [];
  const send = (async (url: string) => {
    fetched.push(url);
    if (url.endsWith("/broken")) return new Response("Not found", { status: 404 });
    if (url.endsWith("/page")) return new Response("<html>", { headers: { "content-type": "text/html" } });
    if (url.endsWith("/offline")) throw new TypeError("Failed to fetch");
    return image(300);
  }) as typeof fetch;
  await fillPhotos(["https://pi.example/a", "https://pi.example/b", "https://pi.example/broken", "https://pi.example/page", "https://pi.example/offline"], { cache, send });
  assert.deepEqual([...kept.keys()].sort(), ["https://pi.example/a", "https://pi.example/b"]);
  assert.deepEqual(fetched, ["https://pi.example/b", "https://pi.example/broken", "https://pi.example/page", "https://pi.example/offline"]);
  const status = photoStatus();
  assert.equal(status.kept, 2);
  assert.equal(status.wanted, 5);
  assert.equal(status.bytes, 400);
  assert.equal(status.filling, false);
});

test("a second fill fetches nothing, and remembers the sizes, even for an address written with capitals", async () => {
  const { cache } = fakeCache();
  let sent = 0;
  const send = (async () => {
    sent += 1;
    return image(300);
  }) as typeof fetch;
  const wanted = ["HTTP://MyPi:80/api/files/r/a/a.jpg?thumb=600x0", "http://mypi/api/files/r/b/b.jpg"];
  await fillPhotos(wanted, { cache, send });
  await fillPhotos(wanted, { cache, send });
  assert.equal(sent, 2);
  assert.equal(photoStatus().kept, 2);
  assert.equal(photoStatus().bytes, 600);
});

test("a phone with no room stops the fill at once and says so", async () => {
  const { cache, kept } = fakeCache({}, { full: true });
  let sent = 0;
  const send = (async () => {
    sent += 1;
    return image(10);
  }) as typeof fetch;
  await fillPhotos(["https://pi.example/1", "https://pi.example/2", "https://pi.example/3"], { cache, send });
  assert.equal(sent, 1);
  assert.equal(kept.size, 0);
  assert.equal(photoStatus().full, true);
  assert.equal(photoStatus().filling, false);
});

test("room freed: the next fill no longer says the phone is full", async () => {
  const send = (async () => image(10)) as typeof fetch;
  await fillPhotos(["https://pi.example/1"], { cache: fakeCache({}, { full: true }).cache, send });
  assert.equal(photoStatus().full, true);
  await fillPhotos(["https://pi.example/1"], { cache: fakeCache().cache, send });
  assert.equal(photoStatus().full, false);
});

test("a photo storage refuses for another reason is skipped, not the rest", async () => {
  const { cache, kept } = fakeCache();
  const put = cache.put.bind(cache);
  (cache as { put: typeof cache.put }).put = async (request, response) => {
    if (String(request).endsWith("/odd")) throw new TypeError("Can't store that one");
    return put(request, response);
  };
  const send = (async () => image(10)) as typeof fetch;
  await fillPhotos(["https://pi.example/odd", "https://pi.example/fine"], { cache, send });
  assert.deepEqual([...kept.keys()], ["https://pi.example/fine"]);
  assert.equal(photoStatus().full, false);
});

test("storage refusing three in a row stops the fill like a full phone", async () => {
  const { cache } = fakeCache();
  (cache as { put: typeof cache.put }).put = async () => {
    throw new DOMException("Something went wrong.", "UnknownError");
  };
  let sent = 0;
  const send = (async () => {
    sent += 1;
    return image(10);
  }) as typeof fetch;
  await fillPhotos(["https://pi.example/1", "https://pi.example/2", "https://pi.example/3", "https://pi.example/4", "https://pi.example/5"], { cache, send });
  assert.equal(sent, 3);
  assert.equal(photoStatus().full, true);
});

test("what's kept is counted from the phone alone", async () => {
  const { cache } = fakeCache({ "https://pi.example/a": 100, "https://pi.example/b": 250 });
  await countKept(cache);
  assert.equal(photoStatus().kept, 2);
  assert.equal(photoStatus().bytes, 350);
});

test("turning it off empties the kept photos; a kept one is found by its address", async () => {
  const { cache } = fakeCache();
  await cache.put("https://pi.example/a", image(5));
  const opened: string[] = [];
  const deleted: string[] = [];
  const saved = (globalThis as { caches?: unknown }).caches;
  (globalThis as { caches?: unknown }).caches = {
    open: async (name: string) => {
      opened.push(name);
      return cache;
    },
    delete: async (name: string) => {
      deleted.push(name);
      return true;
    },
  };
  try {
    const shown = await keptPhoto("https://pi.example/a");
    assert.match(shown ?? "", /^blob:/);
    URL.revokeObjectURL(shown ?? "");
    assert.equal(await keptPhoto("https://pi.example/missing"), null);
    assert.deepEqual(opened, [PHOTO_CACHE, PHOTO_CACHE]);
    await keepPhotos(true);
    assert.equal(photoStatus().on, true);
    await keepPhotos(false);
    assert.equal(photoStatus().on, false);
    assert.deepEqual(deleted, [PHOTO_CACHE]);
    assert.equal(photoStatus().kept, 0);
  } finally {
    (globalThis as { caches?: unknown }).caches = saved;
  }
});

test("filling stops when asked (the switch turned off)", async () => {
  const { cache, kept } = fakeCache();
  let sent = 0;
  const send = (async () => {
    sent += 1;
    return image(10);
  }) as typeof fetch;
  await fillPhotos(["https://pi.example/1", "https://pi.example/2", "https://pi.example/3"], { cache, send, stopped: () => sent >= 1 });
  assert.equal(sent, 1);
  assert.equal(kept.size, 1);
  assert.equal(photoStatus().filling, false);
});
