// What a cooked recipe used from the pantry, offered after "Finished" (or
// "We cooked this") as "Used anything up?": whole packets used up oldest
// first (a partly used one before those), and the last one used only in
// part keeps "about 100 g left". Tested in web/test/cookedUses.test.ts.

import type { PantryItem, PantryPacket } from "./pb";
import { headingOf } from "./format.ts";
import { linkFor } from "./pantryLinks.ts";
import { scaleLine } from "./scaling.ts";
import { packetLabel, packetsOf } from "./pantryPackets.ts";
import { amountLabel, packetAmount, quantityOf } from "./pantryStock.ts";
import type { RecipeMeasures } from "./volumes.ts";

export interface Use {
  item: PantryItem;
  // "Linguine: 400 g of the 500 g packet", and a note under it.
  title: string;
  note: string;
  // Ticked to start with: what it worked out; a guess ("mark it Low?") isn't.
  ticked: boolean;
  // Packets to take off, and one to leave partly used.
  finish: PantryPacket[];
  leave: { packet: PantryPacket; left: string } | null;
  // The item's new level, if it changes.
  status: "out" | "low" | null;
}

// "1 tin chickpeas", "2 (400 g) cans tomatoes": a count of packets.
const PACKET_COUNT = /^\s*(\d+)\s*(?:\([^)]*\)\s*)?(?:cans?|tins?|packets?|packs?|jars?|bottles?|bags?|box(?:es)?|cartons?|sachets?)\b/i;

// Less than this share of a packet left counts as used up: nobody keeps
// 10 g of a 500 g bag in mind.
const CRUMBS = 0.05;


// `lines` as the recipe has them (links are found by their words); amounts
// are read at the size it was cooked (`scale`).
export function cookedUses(
  lines: string[],
  links: Record<string, string> | null | undefined,
  items: PantryItem[],
  packets: PantryPacket[],
  { scale = 1, measures }: { scale?: number; measures?: RecipeMeasures } = {}
): Use[] {
  const byItem = new Map<string, { item: PantryItem; lines: string[] }>();
  for (const line of lines) {
    if (headingOf(line) !== null || !line.trim()) continue;
    // A group ("any pasta") can't say which kind was used, so it's left out.
    const { item } = linkFor(line, links, items);
    if (!item) continue;
    const entry = byItem.get(item.id) ?? { item, lines: [] };
    entry.lines.push(scaleLine(line, scale));
    byItem.set(item.id, entry);
  }
  const uses: Use[] = [];
  for (const { item, lines: itemLines } of byItem.values()) {
    const own = packetsOf(packets, item.id);
    // The partly used one first, then oldest first.
    const ordered = [...own.filter((p) => p.left), ...own.filter((p) => !p.left)];
    const use = ordered.length ? usePackets(item, itemLines, ordered, measures) : null;
    if (use) uses.push(use);
    else if (!ordered.length && item.status === "have")
      uses.push({ item, title: item.name, note: "None counted in stock: mark it Low?", ticked: false, finish: [], leave: null, status: "low" });
  }
  // On purpose: only when something with packets was used. A household that
  // doesn't count packets is never asked (docs/VISION.md); the "mark it
  // Low?" lines only ride along.
  return uses.some((use) => use.finish.length || use.leave) ? uses : [];
}

function usePackets(item: PantryItem, lines: string[], ordered: PantryPacket[], measures?: RecipeMeasures): Use | null {
  const counts = lines.map((line) => line.match(PACKET_COUNT));
  if (counts.every(Boolean)) {
    const n = counts.reduce((sum, m) => sum + Number(m![1]), 0);
    const finish = ordered.slice(0, n);
    return finish.length ? finished(item, finish, null, ordered.length) : null;
  }
  const needs = lines.map((line) => quantityOf(line, measures));
  const first = packetAmount(ordered[0]);
  if (!first || needs.some((need) => !need || need.kind !== first.kind)) return null;
  let need = needs.reduce((sum, q) => sum + q!.amount, 0);
  const finish: PantryPacket[] = [];
  let leave: Use["leave"] = null;
  let used = 0;
  for (const packet of ordered) {
    if (need <= 0) break;
    const has = packetAmount(packet);
    if (!has || has.kind !== first.kind) return null;
    if (need >= has.amount * (1 - CRUMBS)) {
      finish.push(packet);
      need -= has.amount;
    } else {
      used = need;
      leave = { packet, left: amountLabel({ kind: has.kind, amount: has.amount - need }) };
      need = 0;
    }
  }
  if (!finish.length && !leave) return null;
  if (leave && !finish.length) {
    return {
      item,
      title: `${item.name}: ${amountLabel({ kind: first.kind, amount: used })} of the ${packetLabel(leave.packet) || "open"} one`,
      note: `About ${leave.left} left`,
      ticked: true,
      finish,
      leave,
      status: null,
    };
  }
  return finished(item, finish, leave, ordered.length);
}

function finished(item: PantryItem, finish: PantryPacket[], leave: Use["leave"], total: number): Use {
  const last = finish.length >= total;
  const title = leave
    ? `${item.name}: ${finish.length} and some of another`
    : `${item.name}: ${finish.length} of ${total}`;
  const note = last ? "That's the last of it: marks it Out" : leave ? `About ${leave.left} left in the open one` : "";
  return { item, title, note, ticked: true, finish, leave, status: last ? "out" : null };
}
