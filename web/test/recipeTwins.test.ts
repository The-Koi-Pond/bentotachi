// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { sourceLines, twinLabels } from "../src/recipeTwins.ts";

test("every card says where it's from: the site, or home recipe, or its twin line", () => {
  const lines = sourceLines([
    { id: "a", title: "Soup", source_url: "https://www.recipetineats.com/soup" },
    { id: "b", title: "Nan's scones", source_url: "" },
    { id: "c", title: "Pancakes", source_url: "https://example.com/p", created: "2026-11-01 10:00:00.000Z" },
    { id: "d", title: "Pancakes", source_url: "https://example.com/q", created: "2026-11-05 10:00:00.000Z" },
  ]);
  assert.equal(lines.get("a"), "recipetineats.com");
  assert.equal(lines.get("b"), "home recipe");
  // Same name, same site: the day each was added tells them apart.
  assert.match(lines.get("c") ?? "", /^added /);
  assert.notEqual(lines.get("c"), lines.get("d"));
});

test("only recipes sharing a name get a line, telling them apart", () => {
  const labels = twinLabels([
    { id: "a", title: "Pancakes", source_url: "https://www.taste.com.au/pancakes", created: "2026-11-01 10:00:00.000Z" },
    { id: "b", title: " pancakes ", source_url: "", created: "2026-11-07 10:00:00.000Z" },
    { id: "c", title: "Soup", source_url: "https://example.com/soup", created: "2026-11-02 10:00:00.000Z" },
  ]);
  assert.equal(labels.get("a"), "taste.com.au");
  assert.match(labels.get("b") ?? "", /^added /);
  assert.ok(labels.get("b")?.includes("7"));
  // A name of its own: no line.
  assert.equal(labels.has("c"), false);
});

test("twins from the same site are told apart by the day they were added", () => {
  const labels = twinLabels([
    { id: "a", title: "Chilli", source_url: "https://example.com/chilli", created: "2026-10-01 10:00:00.000Z" },
    { id: "b", title: "Chilli", source_url: "https://example.com/chilli-2", created: "2026-11-05 10:00:00.000Z" },
    { id: "c", title: "Chilli", source_url: "https://other.example.org/chilli", created: "2026-11-06 10:00:00.000Z" },
  ]);
  assert.match(labels.get("a") ?? "", /^added /);
  assert.match(labels.get("b") ?? "", /^added /);
  assert.equal(labels.get("c"), "other.example.org");
});

test("a bad link or date is left out rather than shown wrong", () => {
  const labels = twinLabels([
    { id: "a", title: "Tart", source_url: "not a link", created: "" },
    { id: "b", title: "Tart" },
  ]);
  assert.equal(labels.size, 0);
});
