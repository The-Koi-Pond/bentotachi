// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { currentToast, ERROR_TOAST_MS, hideToast, holdToast, releaseToast, showError, showToast, TOAST_MS } from "../src/toast.ts";

test("one message at a time, gone by itself, an error a little later", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  showToast("Moved to the Fridge.");
  assert.equal(currentToast()?.text, "Moved to the Fridge.");
  showToast("“Milk” is already on the list.");
  assert.equal(currentToast()?.text, "“Milk” is already on the list.", "a new one replaces the last");
  t.mock.timers.tick(TOAST_MS - 1);
  assert.ok(currentToast(), "still there just before its time");
  t.mock.timers.tick(1);
  assert.equal(currentToast(), null);

  showError("The scanner isn't ready yet.");
  assert.equal(currentToast()?.error, true);
  t.mock.timers.tick(TOAST_MS);
  assert.ok(currentToast(), "an error stays longer");
  t.mock.timers.tick(ERROR_TOAST_MS - TOAST_MS);
  assert.equal(currentToast(), null);
});

test("held, it stays; let go, it gets its full time again", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  showToast("Removed “Milk”.", { action: { label: "Undo", run: () => {} } });
  t.mock.timers.tick(TOAST_MS - 100);
  holdToast();
  t.mock.timers.tick(TOAST_MS * 5);
  assert.ok(currentToast(), "stays while held");
  releaseToast();
  t.mock.timers.tick(TOAST_MS - 1);
  assert.ok(currentToast(), "a full time after letting go");
  t.mock.timers.tick(1);
  assert.equal(currentToast(), null);
});

test("a held error gets an error's longer time when let go", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  showError("Couldn't save that.");
  holdToast();
  t.mock.timers.tick(ERROR_TOAST_MS * 2);
  releaseToast();
  t.mock.timers.tick(ERROR_TOAST_MS - 1);
  assert.ok(currentToast(), "still there just before an error's time");
  t.mock.timers.tick(1);
  assert.equal(currentToast(), null);
});

test("clearing an old error shows nothing; a tap puts one away", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  showError("");
  assert.equal(currentToast(), null);
  showToast("Saved.");
  hideToast();
  assert.equal(currentToast(), null);
});
