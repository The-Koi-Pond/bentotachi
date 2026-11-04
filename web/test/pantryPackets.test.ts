// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { brandsToPickFrom, detailsFor, knowsBarcode, packetLabel, packetsOf, tidySize, withDetails } from "../src/pantryPackets.ts";

const CODE = "9300633603161";

test("a packet's label is its brand and size, or just Packet", () => {
  assert.equal(packetLabel({ brand: "White Mill", size: "1 kg" }), "White Mill 1 kg");
  assert.equal(packetLabel({ brand: " Coles ", size: "" }), "Coles");
  assert.equal(packetLabel({ brand: "", size: "2 kg" }), "2 kg");
  assert.equal(packetLabel({ brand: "", size: " " }), "Packet");
});

test("an item's packets: only its own, oldest first, without hidden ones", () => {
  const packet = (id: string, item: string, created: string) => ({ id, item, brand: "", size: "", created });
  const all = [
    packet("c", "flour", "2026-11-05 10:00:00.000Z"),
    packet("a", "flour", "2026-11-01 10:00:00.000Z"),
    packet("b", "sugar", "2026-11-02 10:00:00.000Z"),
    packet("d", "flour", "2026-11-03 10:00:00.000Z"),
  ];
  assert.deepEqual(packetsOf(all, "flour").map((p) => p.id), ["a", "d", "c"]);
  assert.deepEqual(packetsOf(all, "flour", new Set(["d"])).map((p) => p.id), ["a", "c"]);
  assert.deepEqual(packetsOf(all, "rice"), []);
});

test("a scanned packet is what the item remembers, else what Open Food Facts said", () => {
  const remembers = { barcode_details: { [CODE]: { brand: "White Mill", size: "1 kg" } } };
  assert.deepEqual(detailsFor(remembers, CODE, { brand: "Other", quantity: "2kg" }), { brand: "White Mill", size: "1 kg" });
  assert.equal(knowsBarcode(remembers, CODE), true);
  assert.deepEqual(detailsFor({ barcode_details: null }, CODE, { brand: "Coles", quantity: "2kg" }), { brand: "Coles", size: "2 kg" });
  assert.equal(knowsBarcode({ barcode_details: null }, CODE), false);
  // An empty memory doesn't count.
  assert.equal(knowsBarcode({ barcode_details: { [CODE]: {} } }, CODE), false);
  assert.deepEqual(detailsFor({}, CODE, null), { brand: "", size: "" });
});

test("remembering a barcode keeps the others, and skips nothing to remember", () => {
  const item = { barcode_details: { other: { brand: "Coles" } } };
  assert.deepEqual(withDetails(item, CODE, { brand: " White Mill ", size: "" }), {
    other: { brand: "Coles" },
    [CODE]: { brand: "White Mill" },
  });
  assert.deepEqual(withDetails(item, CODE, { brand: "", size: " " }), { other: { brand: "Coles" } });
  assert.deepEqual(withDetails({}, "", { brand: "Coles", size: "" }), {});
  // The item's own isn't changed.
  assert.deepEqual(item, { barcode_details: { other: { brand: "Coles" } } });
});

test("sizes are tidied the way people write them", () => {
  assert.equal(tidySize("1kg"), "1 kg");
  assert.equal(tidySize("500ML"), "500 ml");
  assert.equal(tidySize("2l"), "2 L");
  assert.equal(tidySize(" 1000  g "), "1000 g");
  assert.equal(tidySize("6 x 375ml"), "6 x 375 ml");
  assert.equal(tidySize("1 lb"), "1 lb");
  assert.equal(tidySize("x".repeat(80)).length, 60);
});

test("an older item's several brands are offered to pick the favourite from", () => {
  assert.deepEqual(brandsToPickFrom("Coles, White Mill"), ["Coles", "White Mill"]);
  assert.deepEqual(brandsToPickFrom("Coles, coles"), []);
  assert.deepEqual(brandsToPickFrom("White Mill"), []);
  assert.deepEqual(brandsToPickFrom(""), []);
});
