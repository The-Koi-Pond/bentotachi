// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { forgetAll, remember, remembered, rememberedJson } from "../src/phoneStorage.ts";

const store = new Map<string, string>();
const working = {
  getItem: (key: string) => store.get(key) ?? null,
  setItem: (key: string, value: string) => void store.set(key, value),
  removeItem: (key: string) => void store.delete(key),
};
const blocked = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("full");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};
const use = (storage: object) => Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });

test("remembers, reads back and forgets", () => {
  use(working);
  remember("bento.test", "month");
  assert.equal(remembered("bento.test"), "month");
  remember("bento.test", null);
  assert.equal(remembered("bento.test"), null);
});

test("JSON reads back, and anything unreadable is as if nothing was saved", () => {
  use(working);
  remember("bento.test", JSON.stringify({ a: 1.5 }));
  assert.deepEqual(rememberedJson("bento.test"), { a: 1.5 });
  remember("bento.test", "{cut off");
  assert.equal(rememberedJson("bento.test"), null);
  assert.equal(rememberedJson("bento.never"), null);
});

test("blocked or full storage reads as nothing and skips writes, without throwing", () => {
  use(blocked);
  assert.equal(remembered("bento.test"), null);
  assert.equal(rememberedJson("bento.test"), null);
  assert.doesNotThrow(() => remember("bento.test", "x"));
  assert.doesNotThrow(() => remember("bento.test", null));
});

// A Storage with keys(), as forgetAll walks them.
function listable() {
  const kept = new Map<string, string>();
  return {
    kept,
    storage: {
      get length() {
        return kept.size;
      },
      key: (i: number) => [...kept.keys()][i] ?? null,
      getItem: (key: string) => kept.get(key) ?? null,
      setItem: (key: string, value: string) => void kept.set(key, value),
      removeItem: (key: string) => void kept.delete(key),
    },
  };
}

test("forgetting everything Bentotachi's, for good and for this visit, and nothing else", () => {
  const forGood = listable();
  const thisVisit = listable();
  use(forGood.storage);
  Object.defineProperty(globalThis, "sessionStorage", { value: thisVisit.storage, configurable: true });
  for (const key of ["bento.serverUrl", "bento.phoneAccount", "bento.stepTimers", "pocketbase_auth"]) remember(key, "x");
  remember("bento.browseSearch", "soup", { thisVisit: true });
  forgetAll("bento.");
  assert.deepEqual([...forGood.kept.keys()], ["pocketbase_auth"]);
  assert.deepEqual([...thisVisit.kept.keys()], []);
  use(blocked);
  assert.doesNotThrow(() => forgetAll("bento."));
});
