// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { guessCountry } from "../src/country.ts";

test("an Australian time zone means Australia, whatever the language says", () => {
  assert.equal(guessCountry(["en-US", "en"], "Australia/Sydney"), "AU");
  assert.equal(guessCountry(["en-AU"], "Australia/Perth"), "AU");
});

test("otherwise the language's region decides", () => {
  assert.equal(guessCountry(["en-US", "en"], "America/Chicago"), "US");
  assert.equal(guessCountry(["en-GB"], "Europe/London"), "OTHER");
  assert.equal(guessCountry(["fr-CA", "en-US"], "America/Toronto"), "OTHER");
});

test("a language without a region falls back to the time zone", () => {
  assert.equal(guessCountry(["en"], "America/New_York"), "US");
  assert.equal(guessCountry(["en"], "America/Toronto"), "OTHER");
  assert.equal(guessCountry([], ""), "OTHER");
});
