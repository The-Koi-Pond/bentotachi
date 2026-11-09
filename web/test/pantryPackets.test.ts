// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import {
  brandsToPickFrom,
  detailsFor,
  itemAfterPacket,
  justBought,
  knowsBarcode,
  lastPacketRunsOut,
  learnsBarcode,
  nextPacket,
  groupText,
  packetGroups,
  packetLabel,
  packetToSave,
  packetsOf,
  tidySize,
  untickCanTakeBack,
  withDetails,
} from "../src/pantryPackets.ts";

test("packets show as one counter per brand and size, without the favourite brand", () => {
  const packets = [
    { id: "1", brand: "Edgell", size: "400 g" },
    { id: "2", brand: "Coles", size: "400 g" },
    { id: "3", brand: "edgell ", size: "400 g" },
    { id: "4", brand: "Edgell", size: "800 g" },
  ];
  const groups = packetGroups(packets, "Edgell");
  assert.deepEqual(
    groups.map((g) => [g.label, g.count, g.packets.map((p) => p.id)]),
    [
      // The oldest first in each, so − uses that one up.
      ["400 g", 2, ["1", "3"]],
      ["Coles 400 g", 1, ["2"]],
      ["800 g", 1, ["4"]],
    ]
  );
  // Tins and bottles are counted too, so never "Packet": plain ones show as
  // a count ("2"), and what's left still reads without a stray comma.
  const plain = packetGroups([{ brand: "", size: "" }, { brand: "", size: "" }, { brand: "", size: "", left: "100 g" }]);
  assert.deepEqual(plain.map((g) => g.label), ["", "about 100 g left"]);
  assert.deepEqual(plain.map(groupText), ["2", "about 100 g left"]);
  assert.equal(groupText({ count: 3, label: "400 g" }), "3 × 400 g");
  assert.equal(groupText({ count: 1, label: "400 g" }), "400 g");
});

test("a partly used packet is its own counter, saying what's left", () => {
  const groups = packetGroups([
    { id: "1", brand: "", size: "500 g", left: "" },
    { id: "2", brand: "", size: "500 g", left: "100 g" },
    { id: "3", brand: "", size: "500 g", left: "" },
  ]);
  assert.deepEqual(
    groups.map((g) => [g.label, g.count]),
    [
      ["500 g", 2],
      ["500 g, about 100 g left", 1],
    ]
  );
});

test("Out's Undo keeps a packet's shopping row only while unticking could still take it back (an hour)", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  assert.equal(untickCanTakeBack({ bought_with: "s1", created: "2026-11-08 11:30:00.000Z" }, now), true);
  assert.equal(untickCanTakeBack({ bought_with: "s1", created: "2026-11-05 11:30:00.000Z" }, now), false);
  assert.equal(untickCanTakeBack({ bought_with: "", created: "2026-11-08 11:30:00.000Z" }, now), false);
});

test("a packet put back keeps what's left, and its shopping row only within the hour", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  const base = { item: "rice", brand: "Sunrice", size: "1 kg", barcode: "123" };
  assert.deepEqual(packetToSave({ ...base, left: "300 g", bought_with: "s1", created: "2026-11-08 11:30:00.000Z" }, now), {
    ...base,
    left: "300 g",
    bought_with: "s1",
  });
  assert.deepEqual(packetToSave({ ...base, left: "", bought_with: "s1", created: "2026-11-05 11:30:00.000Z" }, now), base);
  // A new one has neither.
  assert.deepEqual(packetToSave(base, now), base);
});

test("finishing the last packet on screen makes the item Out, unless it's Out already", () => {
  assert.equal(lastPacketRunsOut({ status: "have" }, ["p1"]), true);
  assert.equal(lastPacketRunsOut({ status: "low" }, ["p1"]), true);
  assert.equal(lastPacketRunsOut({ status: "have" }, ["p1", "p2"]), false);
  assert.equal(lastPacketRunsOut({ status: "out" }, ["p1"]), false);
});

test("adding a packet: an Out item is in stock again, and a new barcode with details is learned", () => {
  const details = { brand: "White Mill", size: "1 kg" };
  const fresh = { status: "have" as const, barcode_details: null };
  assert.equal(itemAfterPacket(fresh, "", details), null);
  assert.deepEqual(itemAfterPacket({ ...fresh, status: "out" }, "", details), { status: "have" });
  assert.deepEqual(itemAfterPacket(fresh, CODE, details), { barcode_details: { [CODE]: details } });
  // Ran out, bought more, scanned a new barcode: both at once.
  assert.deepEqual(itemAfterPacket({ ...fresh, status: "out" }, CODE, details), { status: "have", barcode_details: { [CODE]: details } });
  // Low stays a judgement: a packet added doesn't change it.
  assert.equal(itemAfterPacket({ ...fresh, status: "low" }, "", details), null);
  // Known already, or nothing to remember: not learned.
  assert.equal(learnsBarcode({ barcode_details: { [CODE]: { brand: "Coles" } } }, CODE, details), false);
  assert.equal(learnsBarcode(fresh, CODE, { brand: " ", size: "" }), false);
  assert.equal(itemAfterPacket(fresh, CODE, { brand: "", size: "" }), null);
});

test("a packet the shopping list added in the last few hours is found, so adding one by hand asks first", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  const packets = [
    { id: "old", bought_with: "s1", created: "2026-11-08 02:00:00.000Z" },
    { id: "hand", bought_with: "", created: "2026-11-08 11:30:00.000Z" },
    { id: "new", bought_with: "s2", created: "2026-11-08 11:00:00.000Z" },
  ];
  assert.equal(justBought(packets, now)?.id, "new");
  // Older than that, or added by hand: nothing to ask about.
  assert.equal(justBought(packets.filter((p) => p.id !== "new"), now), null);
});

test("+ 1 packet adds one like the usual packet, else the newest, else just the favourite brand", () => {
  const usual = { brand: "White Mill", size: "1 kg" };
  assert.deepEqual(nextPacket({ brand: "", usual_packet: usual }, [{ brand: "Coles", size: "2 kg" }]), usual);
  assert.deepEqual(
    nextPacket({ brand: "", usual_packet: null }, [{ brand: "Coles", size: "2 kg" }, { brand: "Lowan", size: "750 g" }]),
    { brand: "Lowan", size: "750 g" }
  );
  assert.deepEqual(nextPacket({ brand: "White Mill", usual_packet: { brand: "", size: "" } }, []), { brand: "White Mill", size: "" });
  // An older item listing several brands doesn't pick one.
  assert.deepEqual(nextPacket({ brand: "Coles, White Mill" }, []), { brand: "", size: "" });
});

const CODE = "9300633603161";

test("a packet's label is its brand and size, or just Packet", () => {
  assert.equal(packetLabel({ brand: "White Mill", size: "1 kg" }), "White Mill 1 kg");
  assert.equal(packetLabel({ brand: " Coles ", size: "" }), "Coles");
  assert.equal(packetLabel({ brand: "", size: "2 kg" }), "2 kg");
  assert.equal(packetLabel({ brand: "", size: " " }), "", "never the word packet: tins and bottles count too");
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
  // A packet's brand holds 120 characters.
  assert.equal(detailsFor({}, CODE, { brand: "B".repeat(150), quantity: "" }).brand.length, 120);
});

test("remembering a barcode keeps its size, trimmed, as well as its brand", () => {
  assert.deepEqual(withDetails({}, CODE, { brand: "", size: " 1 kg " }), { [CODE]: { size: "1 kg" } });
  assert.deepEqual(withDetails({}, CODE, { brand: "White Mill", size: "2 kg" }), { [CODE]: { brand: "White Mill", size: "2 kg" } });
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
