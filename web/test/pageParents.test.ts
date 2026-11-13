import { test } from "node:test";
import assert from "node:assert/strict";
import { isTabPage, parentOf } from "../src/pageParents.ts";

test("the tabs' own pages have no back arrow; every page a step in does", () => {
  for (const tab of ["/", "/browse", "/plan", "/shopping", "/pantry"]) assert.equal(isTabPage(tab), true, tab);
  for (const page of ["/recipes/abc", "/recipes/abc/edit", "/add", "/new", "/browse/categories", "/settings", "/fridge", "/shelves"])
    assert.equal(isTabPage(page), false, page);
});

test("with nothing to go back to, the arrow goes up a level", () => {
  assert.equal(parentOf("/recipes/abc"), "/");
  assert.equal(parentOf("/recipes/abc/edit"), "/recipes/abc");
  assert.equal(parentOf("/add"), "/");
  assert.equal(parentOf("/new"), "/");
  assert.equal(parentOf("/browse/categories"), "/browse");
  assert.equal(parentOf("/shelves"), "/?edit=1");
  assert.equal(parentOf("/settings"), "/");
  assert.equal(parentOf("/fridge"), "/");
});
