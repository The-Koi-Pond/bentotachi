// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import type { MealPlanEntry, Note, Recipe } from "../src/pb.ts";
import {
  cookedCopy,
  forgetOfflineCopy,
  notesCopy,
  notesCopyReadOnly,
  planCopy,
  planCopyReadOnly,
  recipesCopy,
  shelvesCopy,
  SHOPPING_QUEUE_KEY,
} from "../src/offline.ts";
import * as offline from "../src/offline.ts";

const store = new Map<string, string>();
Object.defineProperty(globalThis, "localStorage", {
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  },
  configurable: true,
});

const soup = { id: "r1", title: "Soup", ingredients: ["1 onion"] } as Recipe;
const planned = (id: string, recipe: string, note = "") =>
  ({ id, date: "2026-11-12 00:00:00.000Z", recipe, note, added_by: "u1" }) as MealPlanEntry;

test("the plan's copy leaves its recipes out, and puts them back from the recipes' copy", () => {
  store.clear();
  recipesCopy.write([soup]);
  planCopy.write([{ ...planned("p1", "r1"), expand: { recipe: soup } }, planned("p2", "", "Take-away")]);
  assert.ok(!store.get("bento.offline.plan")?.includes("onion"), "the recipe isn't kept twice");
  const [withRecipe, noteOnly] = planCopy.read() ?? [];
  assert.deepEqual(withRecipe.expand?.recipe?.ingredients, ["1 onion"], "the week's shopping still has the ingredients");
  assert.equal(noteOnly.expand, undefined);
  assert.equal(noteOnly.note, "Take-away");
});

test("a planned recipe missing from the recipes' copy shows without it", () => {
  store.clear();
  planCopy.write([planned("p1", "r9")]);
  assert.equal(planCopy.read()?.[0].expand, undefined);
});

test("nothing saved yet reads as no copy, not an empty one", () => {
  store.clear();
  assert.equal(planCopy.read(), null);
  assert.equal(shelvesCopy.read(), null);
});

test("a fridge note keeps only its writer's name and colour", () => {
  store.clear();
  const writer = { id: "u1", collectionId: "c", collectionName: "users", name: "Sam", username: "sam", color: "#7048e8", email: "sam@example.com", avatar: "me.jpg" };
  notesCopy.write([{ id: "n1", text: "Milk", added_by: "u1", expand: { added_by: writer } } as unknown as Note]);
  const kept = notesCopy.read()?.[0].expand?.added_by;
  assert.equal(kept?.name, "Sam");
  assert.equal(kept?.color, "#7048e8");
  assert.equal((kept as unknown as Record<string, unknown>).email, undefined);
});

test("a read-only copy shows the copy but never writes it", () => {
  store.clear();
  recipesCopy.write([soup]);
  planCopy.write([{ ...planned("p1", "r1"), expand: { recipe: soup } }]);
  planCopyReadOnly.write([]);
  notesCopyReadOnly.write([]);
  assert.equal(planCopyReadOnly.read()?.length, 1);
  assert.equal(notesCopyReadOnly.read(), null);
});

// Every copy offline.ts exports, found by shape, so one added later without
// its own key or a place in forgetOfflineCopy fails here by itself.
type Copy = { read: () => unknown[] | null; write: (list: unknown[]) => void };
const everyCopy = Object.entries(offline).filter(
  (entry): entry is [string, Copy] => typeof entry[1] === "object" && entry[1] !== null && "read" in entry[1] && "write" in entry[1]
);

test("every copy has its own key, and logging out forgets them all", () => {
  store.clear();
  assert.ok(everyCopy.length >= 9);
  for (const [name, copy] of everyCopy) copy.write([{ id: name }]);
  for (const [name, copy] of everyCopy) {
    if (name.endsWith("ReadOnly")) continue;
    assert.deepEqual(
      (copy.read() as { id: string }[]).map((item) => item.id),
      [name],
      `${name} reads back its own`
    );
  }
  offline.forgetOfflineCopy();
  assert.deepEqual([...store.keys()], []);
});

test("logging out forgets every copy, and the unsent shopping changes unless kept", () => {
  store.clear();
  recipesCopy.write([soup]);
  planCopy.write([planned("p1", "r1")]);
  cookedCopy.write([]);
  notesCopy.write([]);
  shelvesCopy.write([]);
  store.set(SHOPPING_QUEUE_KEY, "[]");
  forgetOfflineCopy({ keepWaiting: true });
  assert.deepEqual([...store.keys()], [SHOPPING_QUEUE_KEY]);
  forgetOfflineCopy();
  assert.equal(store.size, 0);
});
