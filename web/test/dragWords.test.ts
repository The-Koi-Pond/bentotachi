// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { dragAnnouncements } from "../src/dragWords.ts";

// Just enough of dnd-kit's event for the announcements.
const at = (id: string) => ({ id }) as never;
const names: Record<string, string> = { a1: "Beef stew", "2026-10-28": "Wednesday 28 October", bin: "the bin" };
const name = (id: string) => names[id] ?? id;

test("drag announcements say names, never ids", () => {
  const say = dragAnnouncements(name);
  assert.equal(say.onDragStart({ active: at("a1") } as never), "Picked up Beef stew.");
  assert.equal(say.onDragOver({ active: at("a1"), over: at("2026-10-28") } as never), "Over Wednesday 28 October.");
  assert.equal(say.onDragEnd({ active: at("a1"), over: at("bin") } as never), "Dropped Beef stew on the bin.");
  assert.equal(say.onDragCancel({ active: at("a1"), over: null } as never), "Put Beef stew back.");
});

test("dropped nowhere, it goes back", () => {
  const say = dragAnnouncements(name);
  assert.equal(say.onDragOver({ active: at("a1"), over: null } as never), "Beef stew isn't over anywhere to drop it.");
  assert.equal(say.onDragEnd({ active: at("a1"), over: null } as never), "Put Beef stew back.");
});

test("what's dragged and where it lands can be named apart", () => {
  const say = dragAnnouncements(name, (id) => `${name(id)}'s place`);
  assert.equal(say.onDragEnd({ active: at("a1"), over: at("2026-10-28") } as never), "Dropped Beef stew on Wednesday 28 October's place.");
});
