import type { PantryPacket } from "./pb";
import { groupText, packetGroups, type PacketDetails } from "./pantryPackets";

// An item's packets in stock as counters, one per brand and size
// ("− 3 × 400 g +", packetGroups): − uses up the oldest of them (the page
// offers Undo, or Out for the last one), + adds one more like it. Used on
// the pantry row and in the item's edit form.
export default function PacketCounters({
  packets,
  favouriteBrand,
  onUsed,
  onMore,
}: {
  packets: PantryPacket[];
  favouriteBrand: string;
  onUsed: (packet: PantryPacket) => void;
  onMore: (details: PacketDetails) => void;
}) {
  return (
    // Their own wrapping row, so a second line lines up with the first.
    <span className="pantry-packets-chips">
      {packetGroups(packets, favouriteBrand).map((group) => (
        <span key={group.label} className="packet-counter">
          <button type="button" onClick={() => onUsed(group.packets[0])} aria-label={`Used one ${group.label}`} title="Used one">
            −
          </button>
          <span>{groupText(group)}</span>
          <button
            type="button"
            onClick={() => onMore({ brand: group.packets[0].brand ?? "", size: group.packets[0].size ?? "" })}
            aria-label={`One more ${group.label}`}
            title="One more"
          >
            +
          </button>
        </span>
      ))}
    </span>
  );
}
