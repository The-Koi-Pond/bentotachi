// Run from the project folder with: node --test "server/test/*.test.js"
const test = require("node:test");
const assert = require("node:assert/strict");
const { soonestExpiry } = require("../pb_hooks/pantry_labels.js");

test("an item's use-by is the soonest of its labels'", () => {
  assert.equal(
    soonestExpiry([{ expires: "2026-12-14 00:00:00.000Z" }, { expires: "2026-11-16 00:00:00.000Z" }, { expires: "" }]),
    "2026-11-16 00:00:00.000Z"
  );
  assert.equal(soonestExpiry([{ expires: "" }]), "", "no dates: none");
  assert.equal(soonestExpiry([]), "");
});
