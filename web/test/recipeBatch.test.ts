import test from "node:test";
import assert from "node:assert/strict";
import { batchSummary, type BatchOutcome } from "../src/recipeBatch.ts";

const outcome = (changes: Partial<BatchOutcome>): BatchOutcome => ({
  added: 0,
  already: 0,
  failed: [],
  firstError: "",
  stopped: false,
  hasBuiltInBrowser: false,
  ...changes,
});

test("a batch that worked says how many, and how many were already here", () => {
  assert.deepEqual(batchSummary(outcome({ added: 3, already: 1 })), {
    text: "Added 3 recipes. 1 was already here.",
    isError: false,
  });
  assert.equal(batchSummary(outcome({ added: 1, stopped: true })).text, "Added 1 recipe. Stopped before the rest.");
});

test("some failing: name them and suggest their links on their own", () => {
  const summary = batchSummary(outcome({ added: 2, failed: ["Pho", "Laksa"], firstError: "Refused." }));
  assert.equal(summary.text, "Added 2 recipes. Couldn't add “Pho” and “Laksa”. Try their links on their own.");
  assert.equal(summary.isError, false);
});

test("all failing: the site's reason, and the app's browser where there is one, not 'try the link'", () => {
  const refused = "That website refused the request (error 403).";
  const summary = batchSummary(outcome({ failed: ["Pho"], firstError: refused, hasBuiltInBrowser: true }));
  assert.equal(summary.isError, true);
  assert.match(summary.text, /error 403/);
  assert.match(summary.text, /Bentotachi's browser/);
  assert.doesNotMatch(summary.text, /on its own/);
  // In a web browser there's no app browser to suggest.
  assert.doesNotMatch(batchSummary(outcome({ failed: ["Pho"], firstError: refused })).text, /Bentotachi's browser/);
});
