// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { changedFields } from "../src/changedFields.ts";

const opened = {
  title: "Shakshuka",
  notes: "",
  servings: "4",
  prep_minutes: 10,
  ingredients: ["2 eggs", "1 onion"],
  tags: ["breakfast"],
  extra_times: [{ label: "Rest", minutes: 5 }],
};

test("nothing changed sends nothing", () => {
  assert.deepEqual(changedFields({ ...opened }, opened), {});
});

test("only the changed fields are sent", () => {
  const after = { ...opened, title: "Shakshuka for six", prep_minutes: 15 };
  assert.deepEqual(changedFields(after, opened), { title: "Shakshuka for six", prep_minutes: 15 });
});

test("lists are compared by what's in them", () => {
  assert.deepEqual(changedFields({ ...opened, ingredients: ["2 eggs", "1 onion"] }, opened), {});
  assert.deepEqual(changedFields({ ...opened, ingredients: ["3 eggs", "1 onion"] }, opened), {
    ingredients: ["3 eggs", "1 onion"],
  });
  assert.deepEqual(changedFields({ ...opened, tags: [] }, opened), { tags: [] });
  assert.deepEqual(changedFields({ ...opened, extra_times: [{ label: "Rest", minutes: 10 }] }, opened), {
    extra_times: [{ label: "Rest", minutes: 10 }],
  });
});

test("emptying a field counts as a change", () => {
  const before = { ...opened, notes: "Less chilli next time" };
  assert.deepEqual(changedFields({ ...before, notes: "" }, before), { notes: "" });
});
