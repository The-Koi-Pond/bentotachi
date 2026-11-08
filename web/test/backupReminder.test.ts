// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { backupReminder, snoozeUntil } from "../src/backupReminder.ts";

const now = new Date("2026-11-20T10:00:00Z");
const daysBefore = (n: number) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000);

test("nudges once there's something worth keeping and no backup", () => {
  assert.equal(backupReminder(now, null, null, 2), null);
  assert.deepEqual(backupReminder(now, null, null, 3), { kind: "never" });
});

test("nudges when the last backup is two weeks old", () => {
  assert.equal(backupReminder(now, daysBefore(13), null, 50), null);
  assert.deepEqual(backupReminder(now, daysBefore(14), null, 50), { kind: "old", days: 14 });
});

test("Later waits three days", () => {
  const snoozed = snoozeUntil(daysBefore(1));
  assert.equal(backupReminder(now, null, snoozed, 50), null);
  assert.deepEqual(backupReminder(now, null, snoozeUntil(daysBefore(3)), 50), { kind: "never" });
});
