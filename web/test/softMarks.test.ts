// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { softParts, withoutSoftMarks } from "../src/softMarks.ts";

test("words in asterisks become soft parts", () => {
  assert.deepEqual(softParts("2 eggs *or 3 if small*"), [
    { text: "2 eggs ", marks: [] },
    { text: "or 3 if small", marks: ["soft"] },
  ]);
  assert.deepEqual(softParts("*Optional:* chives, *to serve*"), [
    { text: "Optional:", marks: ["soft"] },
    { text: " chives, ", marks: [] },
    { text: "to serve", marks: ["soft"] },
  ]);
});

test("words in double asterisks become bold", () => {
  assert.deepEqual(softParts("**Don't** skip the resting"), [
    { text: "Don't", marks: ["bold"] },
    { text: " skip the resting", marks: [] },
  ]);
  assert.deepEqual(softParts("**Hot** oil, *careful*"), [
    { text: "Hot", marks: ["bold"] },
    { text: " oil, ", marks: [] },
    { text: "careful", marks: ["soft"] },
  ]);
});

test("words in double underscores are underlined, and marks combine", () => {
  assert.deepEqual(softParts("__Not__ the seeds"), [
    { text: "Not", marks: ["underline"] },
    { text: " the seeds", marks: [] },
  ]);
  assert.deepEqual(softParts("***soft and bold***"), [{ text: "soft and bold", marks: ["bold", "soft"] }]);
  assert.deepEqual(softParts("__**all**__ of it, __***all***__"), [
    { text: "all", marks: ["underline", "bold"] },
    { text: " of it, ", marks: [] },
    { text: "all", marks: ["underline", "bold", "soft"] },
  ]);
  // Single underscores and snake_case stay as they are.
  assert.deepEqual(softParts("a_b and _c_"), [{ text: "a_b and _c_", marks: [] }]);
});

test("lone or spaced marks stay as they are", () => {
  assert.deepEqual(softParts("2 * 3 cups"), [{ text: "2 * 3 cups", marks: [] }]);
  assert.deepEqual(softParts("Bake at 180* for 5*"), [{ text: "Bake at 180* for 5*", marks: [] }]);
  assert.deepEqual(softParts("* not this *"), [{ text: "* not this *", marks: [] }]);
  assert.deepEqual(softParts("** not this **"), [{ text: "** not this **", marks: [] }]);
  assert.deepEqual(softParts("__ not this __"), [{ text: "__ not this __", marks: [] }]);
  assert.deepEqual(softParts(""), []);
});

test("a marked part doesn't run across lines", () => {
  assert.deepEqual(softParts("*one\ntwo*"), [{ text: "*one\ntwo*", marks: [] }]);
  assert.deepEqual(softParts("**one\ntwo**"), [{ text: "**one\ntwo**", marks: [] }]);
  assert.deepEqual(softParts("__one\ntwo__"), [{ text: "__one\ntwo__", marks: [] }]);
});

test("plain text drops the marks but keeps the words", () => {
  assert.equal(withoutSoftMarks("2 eggs *or 3 if small*"), "2 eggs or 3 if small");
  assert.equal(withoutSoftMarks("**Fresh** basil"), "Fresh basil");
  assert.equal(withoutSoftMarks("__**Fresh**__ basil, ***dried*** thyme"), "Fresh basil, dried thyme");
  assert.equal(withoutSoftMarks("2 * 3"), "2 * 3");
});
