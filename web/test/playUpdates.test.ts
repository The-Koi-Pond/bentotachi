import test from "node:test";
import assert from "node:assert/strict";
import { playUpdateStatus } from "../src/playUpdates.ts";

// Play's numbers: updateAvailability 1 none, 2 available, 3 in progress;
// installStatus 0 unknown, 1 pending, 2 downloading, 3 installing, 11 downloaded.
const cases = [
  ["nothing newer", { updateAvailability: 1, installStatus: 0, flexibleUpdateAllowed: false }, "current"],
  ["newer, and the background kind is allowed", { updateAvailability: 2, installStatus: 0, flexibleUpdateAllowed: true }, "available"],
  ["newer, but only the full-screen kind is allowed", { updateAvailability: 2, installStatus: 0, flexibleUpdateAllowed: false }, "current"],
  ["a finished download wins", { updateAvailability: 2, installStatus: 11, flexibleUpdateAllowed: true }, "downloaded"],
  ["a finished download wins over 'in progress'", { updateAvailability: 3, installStatus: 11, flexibleUpdateAllowed: false }, "downloaded"],
  ["reopened mid-download", { updateAvailability: 2, installStatus: 2, flexibleUpdateAllowed: true }, "installing"],
  ["queued to download", { updateAvailability: 2, installStatus: 1, flexibleUpdateAllowed: true }, "installing"],
  ["Play says in progress", { updateAvailability: 3, installStatus: 0, flexibleUpdateAllowed: false }, "installing"],
] as const;

for (const [name, info, want] of cases) {
  test(`Play update status: ${name}`, () => assert.equal(playUpdateStatus(info), want));
}
