// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import {
  brandsToPickFrom,
  countsInStock,
  detailsFor,
  itemAfterPacket,
  justBought,
  knowsBarcode,
  lastPacketRunsOut,
  learnsBarcode,
  nextPacket,
  boughtDay,
  labelMeta,
  preferredChanges,
  packetGroups,
  packetName,
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
  // Tins and bottles are counted too, so never "Packet": plain ones have no
  // label, and what's left still reads without a stray comma.
  const plain = packetGroups([{ brand: "", size: "" }, { brand: "", size: "" }, { brand: "", size: "", left: "100 g" }]);
  assert.deepEqual(plain.map((g) => g.label), ["", "about 100 g left"]);
  assert.deepEqual(plain.map((g) => g.count), [2, 1]);
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

// The day this moment falls on, on this computer's calendar ("2026-11-09"),
// worked out here rather than by the code being tested.
function localDay(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

test("a packet put back keeps what's left, and its shopping row only within the hour", () => {
  const now = new Date("2026-11-08T12:00:00Z");
  const base = { item: "rice", brand: "Sunrice", size: "1 kg", barcode: "123" };
  assert.deepEqual(packetToSave({ ...base, left: "300 g", bought_with: "s1", created: "2026-11-08 11:30:00.000Z" }, now), {
    ...base,
    left: "300 g",
    bought: `${localDay("2026-11-08T11:30:00Z")} 00:00:00.000Z`,
    bought_with: "s1",
  });
  assert.deepEqual(packetToSave({ ...base, left: "", bought_with: "s1", created: "2026-11-05 11:30:00.000Z" }, now), {
    ...base,
    bought: `${localDay("2026-11-05T11:30:00Z")} 00:00:00.000Z`,
  });
  // A new one has neither, nor a bought day (it's today's).
  assert.deepEqual(packetToSave(base, now), base);
});

test("a label put back (Out's Undo) keeps its dates, and the day it was really bought", () => {
  const base = { item: "rice", brand: "Sunrice", size: "1 kg", barcode: "", left: "" };
  const dates = { expires: "2026-12-14 00:00:00.000Z", opened: "2026-11-09 08:00:00.000Z", bought: "2026-11-02 00:00:00.000Z" };
  assert.deepEqual(packetToSave({ ...base, ...dates, created: "2026-11-03 01:00:00.000Z" }), { item: "rice", brand: "Sunrice", size: "1 kg", barcode: "", ...dates });
  // No bought day given: the day it was added, not the day it's put back.
  assert.equal(packetToSave({ ...base, created: "2026-10-28 23:30:00.000Z" }).bought, `${localDay("2026-10-28T23:30:00Z")} 00:00:00.000Z`);
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
  // Known already, or nothing to remember: not learned. Known only by its
  // brand: its size is.
  assert.equal(learnsBarcode({ barcode_details: { [CODE]: { brand: "Coles", size: "2 kg" } } }, CODE, details), false);
  assert.equal(learnsBarcode({ barcode_details: { [CODE]: { brand: "Coles" } } }, CODE, details), true);
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
  // A stand-in of another brand (the favourite was out) isn't what comes
  // next: the favourite is.
  assert.deepEqual(
    nextPacket({ brand: "Masterfoods", usual_packet: null }, [{ brand: "Masterfoods", size: "560 g" }, { brand: "Heinz", size: "500 g" }]),
    { brand: "Masterfoods", size: "560 g" }
  );
  assert.deepEqual(nextPacket({ brand: "Masterfoods", usual_packet: null }, [{ brand: "Heinz", size: "500 g" }]), { brand: "Masterfoods", size: "" });
});

const CODE = "9300633603161";

test("a packet's label is its brand and size, or just Packet", () => {
  assert.equal(packetName({ brand: "White Mill", size: "1 kg" }), "White Mill 1 kg");
  assert.equal(packetName({ brand: " Coles ", size: "" }), "Coles");
  assert.equal(packetName({ brand: "", size: "2 kg" }), "2 kg");
  assert.equal(packetName({ brand: "", size: " " }), "", "never the word packet: tins and bottles count too");
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
  // A loose one's size of 1 is counted, but its label doesn't say "1".
  assert.deepEqual(
    packetGroups([{ brand: "", size: "1" }, { brand: "", size: "1" }]).map((g) => [g.label, g.count]),
    [["", 2]]
  );
  // A count stays one the pantry can read.
  assert.equal(tidySize("x12"), "12");
  assert.equal(tidySize("12 pcs"), "12 pcs");
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

test("a label says if it's opened and when it expires, and whether that's soon", () => {
  const now = new Date(2026, 10, 9, 12, 0);
  assert.deepEqual(labelMeta({ expires: "2026-11-11 00:00:00.000Z", opened: "2026-11-03 10:00:00.000Z" }, now), {
    text: "opened · expires in 2 days",
    soon: true,
  });
  assert.deepEqual(labelMeta({ expires: "2026-12-14 00:00:00.000Z", opened: "" }, now).soon, false);
  assert.deepEqual(labelMeta({ expires: "", opened: "" }, now), { text: "", soon: false });
  assert.deepEqual(labelMeta({ expires: "2026-11-01 00:00:00.000Z" }, now).soon, true, "past counts too");
});

test("a label's bought day: the one given, else the day it was added", () => {
  assert.equal(boughtDay({ bought: "2026-11-02 00:00:00.000Z", created: "2026-11-05 01:00:00.000Z" }), "2026-11-02");
  // Added at midday UTC: 6 Nov in Kiritimati, where the tests run too.
  assert.equal(boughtDay({ created: "2026-11-05 12:00:00.000Z" }), localDay("2026-11-05T12:00:00Z"));
  assert.equal(boughtDay({}), "");
});

test("without a use-by date, a label says how long ago it was bought", () => {
  const now = new Date(2026, 10, 9, 12, 0);
  assert.equal(labelMeta({ bought: "2026-10-28 00:00:00.000Z" }, now).text, "bought 12 days ago");
  assert.equal(labelMeta({ bought: "2026-11-09 00:00:00.000Z", opened: "2026-11-09 00:00:00.000Z" }, now).text, "opened · bought today");
  assert.equal(
    labelMeta({ bought: "2026-10-28 00:00:00.000Z", expires: "2026-12-14 00:00:00.000Z" }, now).text.includes("bought"),
    false,
    "the use-by says more"
  );
});

test("making one the favourite sets the usual one, and the brand when it's another", () => {
  assert.deepEqual(preferredChanges({ brand: "Nutella" }, { brand: "Nutella", size: "750 g" }), {
    usual_packet: { brand: "Nutella", size: "750 g" },
  });
  assert.deepEqual(preferredChanges({ brand: "Nutella" }, { brand: " Bon Maman", size: "360 g" }), {
    usual_packet: { brand: "Bon Maman", size: "360 g" },
    brand: "Bon Maman",
  });
  assert.deepEqual(preferredChanges({ brand: "Coles, White Mill" }, { brand: "White Mill", size: "1 kg" }), {
    usual_packet: { brand: "White Mill", size: "1 kg" },
    brand: "White Mill",
  }, "an older item's list of brands becomes the one picked");
  assert.deepEqual(preferredChanges({ brand: "Nutella" }, { brand: "", size: "1 kg" }), {
    usual_packet: { brand: "", size: "1 kg" },
  }, "no brand on the label: the favourite brand stays");
});

test("a barcode's brand and size come from the product it's on first", () => {
  const item = {
    products: [{ brand: "Nutella", size: "400 g", barcodes: ["3017620422003"], links: [] }, { brand: "", size: "", barcodes: ["111"], links: [] }],
    barcode_details: { "3017620422003": { brand: "Old", size: "1 kg" }, "222": { brand: "Heinz", size: "500 g" } },
  };
  assert.deepEqual(detailsFor(item, "3017620422003"), { brand: "Nutella", size: "400 g" });
  assert.deepEqual(detailsFor(item, "222"), { brand: "Heinz", size: "500 g" }, "an older app's details still count");
  assert.equal(knowsBarcode(item, "111"), false, "on a product with no name: not known");
});

test("a barcode known only by its brand is still looked up, for its size, and keeps that brand", () => {
  const item = { products: [{ brand: "Heinz", size: "", barcodes: ["333"], links: [] }] };
  assert.equal(knowsBarcode(item, "333"), false);
  assert.deepEqual(detailsFor(item, "333", { brand: "Heinz Australia", quantity: "500ml" }), { brand: "Heinz", size: "500 ml" });
  // Nothing found (or no connection): the brand it knows.
  assert.deepEqual(detailsFor(item, "333", null), { brand: "Heinz", size: "" });
});

test("labels with their own date or opened group only with the same", () => {
  const groups = packetGroups([
    { brand: "", size: "400 g", expires: "2026-12-14 00:00:00.000Z" },
    { brand: "", size: "400 g", expires: "2026-12-14 00:00:00.000Z" },
    { brand: "", size: "400 g", expires: "2026-12-14 00:00:00.000Z", opened: "2026-11-03 10:00:00.000Z" },
    { brand: "", size: "400 g" },
  ]);
  assert.deepEqual(groups.map((g) => g.count), [2, 1, 1]);
});

test("labels group by the day they were bought, given or the day added, so Out's Undo shows them as before", () => {
  const added = { brand: "", size: "1 kg", left: "", created: "2026-10-29 01:00:00.000Z" };
  const later = { brand: "", size: "1 kg", left: "", created: "2026-11-06 01:00:00.000Z" };
  assert.deepEqual(packetGroups([added, later]).map((g) => g.count), [1, 1]);
  // Put back by Undo: a new record, with the day it was bought given.
  const putBack = { ...added, created: "2026-11-10 01:00:00.000Z", bought: packetToSave({ item: "r", barcode: "", ...added }).bought };
  assert.deepEqual(packetGroups([added, putBack]).map((g) => g.count), [2]);
});

test("scanning adds by itself only to items whose stock is counted", () => {
  assert.equal(countsInStock({ usual_packet: null }, [{}]), true, "some in stock now");
  assert.equal(countsInStock({ usual_packet: { brand: "Masterfoods", size: "560 g" } }, []), true, "all used up, but counted before");
  assert.equal(countsInStock({ usual_packet: { brand: "", size: "" } }, []), false, "an empty usual one doesn't count");
  assert.equal(countsInStock({ usual_packet: null }, []), false, "never counted: left alone");
});
