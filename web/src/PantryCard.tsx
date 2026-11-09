// Opens under a pantry row when it's tapped: the everyday changes as big
// buttons (one more packet, used one, the other two levels), and "Edit
// everything" for the full form (PantryForms.tsx).
import { useEffect, useRef } from "react";
import type { PantryItem, PantryPacket, PantryStatus } from "./pb";
import { groupText, nextPacket, packetGroups, type PacketDetails } from "./pantryPackets";
import { describeExpiry } from "./expiry";
import { placeOf } from "./pantryItem";

const STATUS_BUTTONS: Record<PantryStatus, string> = { have: "We have it", low: "It's low", out: "It's out" };

export default function PantryCard({
  item,
  packets,
  onMore,
  onUsed,
  onStatus,
  onEditAll,
}: {
  item: PantryItem;
  // Its packets in stock, oldest first; null on a server from before
  // packets, which then aren't offered.
  packets: PantryPacket[] | null;
  onMore: (details: PacketDetails) => void;
  onUsed: (packet: PantryPacket) => void;
  onStatus: (status: PantryStatus) => void;
  onEditAll: () => void;
}) {
  // Opened near the bottom of the screen, it would sit under the tab bar.
  const ref = useRef<HTMLDivElement>(null);
  // (Braces on purpose: newer browsers return a promise from scrollIntoView,
  // which React would take for a clean-up function and crash on.)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);
  const next = nextPacket(item, packets ?? []);
  const place = placeOf(item);
  // What's in stock is said here too, as the Simple layout's row hides it.
  const inStock = packetGroups(packets ?? [], item.brand).map(groupText).join(", ");
  const about = [
    inStock && `In stock: ${inStock}`,
    item.brand?.trim(),
    [place.location, place.subcategory].filter(Boolean).join(", "),
    item.expires && describeExpiry(item.expires),
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <div ref={ref} className="pantry-card" role="group" aria-label={`${item.name}: quick changes`}>
      <div className="pantry-card-quick">
        {packets && (
          <button className="button pantry-card-more" onClick={() => onMore(next)} aria-label={`One more${next.size ? `, ${next.size}` : ""}`}>
            + 1 more
            {next.size && <span className="pantry-card-size">{next.size}</span>}
          </button>
        )}
        {packets && packets.length > 0 && (
          <button className="button" onClick={() => onUsed(packets[0])}>
            Used one
          </button>
        )}
        {(Object.keys(STATUS_BUTTONS) as PantryStatus[])
          .filter((status) => status !== item.status)
          .map((status) => (
            <button key={status} className="button" onClick={() => onStatus(status)}>
              {STATUS_BUTTONS[status]}
            </button>
          ))}
      </div>
      <div className="pantry-card-foot">
        <span className="muted">{about}</span>
        <button className="link-button" onClick={onEditAll}>
          Edit everything
        </button>
      </div>
    </div>
  );
}
