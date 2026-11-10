import { test } from "node:test";
import assert from "node:assert/strict";
import { dateOrder, monthWeeks, readTypedDate, typedText, yearsAround } from "../src/calendar.ts";

test("a month as whole weeks, starting Monday or Sunday, blanks outside it", () => {
  // November 2026 starts on a Sunday and has 30 days.
  const monday = monthWeeks("2026-11-17", "monday");
  assert.deepEqual(monday[0], ["", "", "", "", "", "", "2026-11-01"]);
  assert.equal(monday.length, 6);
  assert.equal(monday.at(-1)?.[0], "2026-11-30");
  const sunday = monthWeeks("2026-11-17", "sunday");
  assert.equal(sunday[0][0], "2026-11-01");
  assert.equal(sunday.length, 5);
  assert.deepEqual(sunday.at(-1), ["2026-11-29", "2026-11-30", "", "", "", "", ""]);
  assert.equal(monthWeeks("2027-02-01", "monday").flat().filter(Boolean).length, 28);
});

test("the phone's date order", () => {
  assert.equal(dateOrder("en-AU"), "dmy");
  assert.equal(dateOrder("en-US"), "mdy");
  assert.equal(dateOrder("ja-JP"), "ymd");
});

test("reading a typed date in that order, only real days", () => {
  assert.equal(readTypedDate("14/12/2026", "dmy"), "2026-12-14");
  assert.equal(readTypedDate("14.12.26", "dmy"), "2026-12-14");
  assert.equal(readTypedDate(" 1 2 2027 ", "dmy"), "2027-02-01");
  assert.equal(readTypedDate("12/14/2026", "mdy"), "2026-12-14");
  assert.equal(readTypedDate("2026/12/14", "ymd"), "2026-12-14");
  assert.equal(readTypedDate("31/02/2027", "dmy"), null, "no 31 February");
  assert.equal(readTypedDate("29/02/2028", "dmy"), "2028-02-29", "a leap year's");
  assert.equal(readTypedDate("14/13/2026", "dmy"), null);
  assert.equal(readTypedDate("14/12", "dmy"), null);
  assert.equal(readTypedDate("", "dmy"), null);
});

test("a date in the typing box, and back", () => {
  assert.equal(typedText("2026-12-04", "dmy"), "04/12/2026");
  assert.equal(typedText("2026-12-04", "mdy"), "12/04/2026");
  assert.equal(readTypedDate(typedText("2026-12-04", "mdy"), "mdy"), "2026-12-04");
  assert.equal(typedText("", "dmy"), "");
});

test("years to pick from reach back, ahead, and the one shown", () => {
  const years = yearsAround(2026, 2026);
  assert.equal(years[0], 2016);
  assert.equal(years.at(-1), 2041);
  assert.ok(yearsAround(1999, 2026).includes(1999));
});
