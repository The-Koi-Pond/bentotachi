// Run from the web folder with: node --test "test/*.test.ts"
// (Node runs TypeScript directly; this folder is outside the app's build.)
import test from "node:test";
import assert from "node:assert/strict";
import { daysUntil, describeExpiry, expiryDate, expiryState, shortExpiry, toStoredDate } from "../src/expiry.ts";

// 30 Oct 2026, 11 pm local time: late enough that a time-zone mix-up would
// show up as an off-by-one day.
const now = new Date(2026, 9, 30, 23, 0, 0);

test("converts between date inputs and stored dates", () => {
  assert.equal(toStoredDate("2026-11-02"), "2026-11-02 00:00:00.000Z");
  assert.equal(toStoredDate(""), "");
  assert.equal(expiryDate("2026-11-02 00:00:00.000Z"), "2026-11-02");
  assert.equal(expiryDate(""), "");
});

test("counts days from today, ignoring time of day and time zone", () => {
  assert.equal(daysUntil("2026-10-30 00:00:00.000Z", now), 0);
  assert.equal(daysUntil("2026-10-31 00:00:00.000Z", now), 1);
  assert.equal(daysUntil("2026-10-28 00:00:00.000Z", now), -2);
  assert.equal(daysUntil("2026-11-02 00:00:00.000Z", now), 3);
  assert.equal(daysUntil("", now), null);
});

test("sorts days into expired / soon / later", () => {
  assert.equal(expiryState(-1), "expired");
  assert.equal(expiryState(0), "soon");
  assert.equal(expiryState(3), "soon");
  assert.equal(expiryState(4), "later");
});

test("describes expiry in plain words", () => {
  const on = (date: string) => describeExpiry(toStoredDate(date), now);
  assert.equal(on("2026-10-27"), "Expired 3 days ago");
  assert.equal(on("2026-10-29"), "Expired yesterday");
  assert.equal(on("2026-10-30"), "Expires today");
  assert.equal(on("2026-10-31"), "Expires tomorrow");
  assert.equal(on("2026-11-05"), "Expires in 6 days");
  assert.match(on("2026-12-12"), /^Expires 12 Dec/);
  assert.match(on("2027-01-20"), /2027/);
  assert.equal(describeExpiry("", now), "");
});

test("short expiry wording for a badge", () => {
  const on = (date: string) => shortExpiry(toStoredDate(date), now);
  assert.equal(on("2026-10-27"), "Expired");
  assert.equal(on("2026-10-30"), "Today");
  assert.equal(on("2026-10-31"), "Tomorrow");
  assert.equal(on("2026-11-05"), "6 days");
  // Further off: just the date, in this computer's own date format ("12 Dec"
  // or "Dec 12"), without "Expires".
  assert.match(on("2026-12-12"), /12/);
  assert.doesNotMatch(on("2026-12-12"), /Expires|days/);
  assert.equal(shortExpiry("", now), "");
});
