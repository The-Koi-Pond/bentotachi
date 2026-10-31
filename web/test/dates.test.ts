// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import {
  addDays,
  addMonths,
  datePart,
  dayNumber,
  formatDay,
  localToday,
  monthStart,
  toStoredDate,
  weekStart,
} from "../src/dates.ts";

test("moves between months, across year ends", () => {
  assert.equal(monthStart("2026-11-17"), "2026-11-01");
  assert.equal(addMonths("2026-11-01", 1), "2026-12-01");
  assert.equal(addMonths("2026-11-01", 2), "2027-01-01");
  assert.equal(addMonths("2026-01-01", -1), "2025-12-01");
  assert.equal(addMonths("2026-03-01", -14), "2025-01-01");
});

test("adds days across month and year ends", () => {
  assert.equal(addDays("2026-10-30", 3), "2026-11-02");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(addDays("2028-03-01", -1), "2028-02-29");
});

test("finds the Monday of the week", () => {
  assert.equal(weekStart("2026-11-02"), "2026-11-02"); // a Monday
  assert.equal(weekStart("2026-11-08"), "2026-11-02"); // the Sunday after
  assert.equal(weekStart("2026-10-30"), "2026-10-26"); // a Friday
  assert.equal(weekStart("2027-01-01"), "2026-12-28"); // across the year end
});

test("today is the device's local date", () => {
  assert.equal(localToday(new Date(2026, 9, 30, 23, 30)), "2026-10-30");
  assert.equal(localToday(new Date(2026, 0, 5, 0, 5)), "2026-01-05");
});

test("dates count and convert", () => {
  assert.equal(dayNumber("2026-11-02") - dayNumber("2026-10-30"), 3);
  assert.equal(toStoredDate("2026-11-02"), "2026-11-02 00:00:00.000Z");
  assert.equal(datePart("2026-11-02 00:00:00.000Z"), "2026-11-02");
  assert.match(formatDay("2026-11-02"), /Mon/);
  assert.match(formatDay("2026-11-02"), /2/);
});

test("says how long ago a date was", async () => {
  const { timeAgo } = await import("../src/dates.ts");
  const today = "2026-10-30";
  assert.equal(timeAgo("2026-10-30", today), "today");
  assert.equal(timeAgo("2026-10-29", today), "yesterday");
  assert.equal(timeAgo("2026-10-25", today), "5 days ago");
  assert.equal(timeAgo("2026-10-17", today), "13 days ago");
  assert.equal(timeAgo("2026-10-16", today), "2 weeks ago");
  assert.equal(timeAgo("2026-09-01", today), "8 weeks ago");
  assert.equal(timeAgo("2026-08-31", today), "8 weeks ago");
  assert.equal(timeAgo("2026-08-30", today), "2 months ago");
  assert.equal(timeAgo("2025-11-01", today), "11 months ago");
  assert.equal(timeAgo("2025-10-30", today), "over a year ago");
});
