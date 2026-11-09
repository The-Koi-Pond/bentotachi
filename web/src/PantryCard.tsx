// Opens under a pantry row when it's tapped: only what the row can't do
// itself (its pill already sets Have / Low / Out). The favourite to buy,
// adding one (the favourite, or another brand bought instead), what's in
// stock as counters when the Simple row hides them, and "Edit everything"
// for the full form (PantryForms.tsx).
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PantryItem, PantryPacket } from "./pb";
import { nextPacket, otherBrands, type PacketDetails } from "./pantryPackets";
import { describeExpiry } from "./expiry";
import { placeOf } from "./pantryItem";
import { norm } from "./pantryGroups";
import PacketCounters from "./PacketCounters";
import { PencilIcon } from "./icons";
import type { PantryLayout } from "./PantryRow";
import { useSpell } from "./household";

export default function PantryCard({
  item,
  packets,
  layout,
  onMore,
  onUsed,
  onEditAll,
}: {
  item: PantryItem;
  // Its packets in stock, oldest first; null on a server from before
  // packets, which then aren't offered.
  packets: PantryPacket[] | null;
  layout: PantryLayout;
  onMore: (details: PacketDetails) => void;
  onUsed: (packet: PantryPacket) => void;
  onEditAll: () => void;
}) {
  // Opened near the bottom of the screen, it would sit under the tab bar.
  const ref = useRef<HTMLDivElement>(null);
  // (Braces on purpose: newer browsers return a promise from scrollIntoView,
  // which React would take for a clean-up function and crash on.)
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);
  const spell = useSpell();
  const [other, setOther] = useState(false);
  const next = nextPacket(item, packets ?? []);
  const place = placeOf(item);
  const preferred = item.brand?.trim() ?? "";
  // "Masterfoods 560 g": the favourite with its usual size, when "+ 1 more"
  // adds that one.
  const preferredText = [preferred, norm(next.brand) === norm(preferred) ? next.size : ""].filter(Boolean).join(" ");
  const about = [[place.location, place.subcategory].filter(Boolean).join(", "), item.expires && describeExpiry(item.expires)]
    .filter(Boolean)
    .join(" · ");
  return (
    <div ref={ref} className="pantry-card" role="group" aria-label={`${item.name}: quick changes`}>
      {/* So whoever's shopping knows which one to get. */}
      {preferred && (
        <p className="pantry-card-preferred">
          {spell("Favourite")}: <strong>{preferredText}</strong>
        </p>
      )}
      {/* The Simple row hides what's in stock; the Detailed one shows it. */}
      {layout === "simple" && packets && packets.length > 0 && (
        <span className="pantry-packets" role="group" aria-label={`${item.name} in stock`}>
          <span className="pantry-packets-label" aria-hidden="true">
            In stock:
          </span>
          <PacketCounters packets={packets} favouriteBrand={item.brand} onUsed={onUsed} onMore={onMore} />
        </span>
      )}
      {/* Adding, and the full form, on one row. */}
      <div className="pantry-card-actions">
        {packets && (
          <>
            <button className="button small" onClick={() => onMore(next)} aria-label={`One more${next.size ? `, ${next.size}` : ""}`}>
              + 1 more
              {next.size && <span className="pantry-card-size">· {next.size}</span>}
            </button>
            <button className="button small" aria-expanded={other} onClick={() => setOther(!other)}>
              Another brand
            </button>
          </>
        )}
        {/* Just a pencil, so all three fit one row on any phone. */}
        <button className="icon-button pantry-card-edit" onClick={onEditAll} aria-label="Edit everything" title="Edit everything">
          <PencilIcon />
        </button>
      </div>
      {other && packets && (
        <OtherBrand
          item={item}
          packets={packets}
          onAdd={(details) => {
            onMore(details);
            setOther(false);
          }}
        />
      )}
      {about && <p className="muted pantry-card-about">{about}</p>}
    </div>
  );
}

// "Bought another brand?": one added with the brand bought instead (the
// favourite was out, say). It doesn't change the favourite, or what
// "+ 1 more" adds (server/pb_hooks/pantry.pb.js keeps the usual one).
function OtherBrand({ item, packets, onAdd }: { item: PantryItem; packets: PantryPacket[]; onAdd: (details: PacketDetails) => void }) {
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const picks = otherBrands(item, packets);

  function add(event: FormEvent) {
    event.preventDefault();
    if (brand.trim()) onAdd({ brand: brand.trim(), size: size.trim() });
  }

  return (
    <form className="pantry-card-other" onSubmit={add}>
      {picks.length > 0 && (
        <div className="pantry-card-picks" role="group" aria-label="Brands it's had">
          {picks.map((pick) => (
            <button key={pick} type="button" aria-pressed={norm(pick) === norm(brand)} onClick={() => setBrand(pick)}>
              {pick}
            </button>
          ))}
        </div>
      )}
      <div className="pantry-card-other-row">
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="Brand bought" aria-label="Brand bought" maxLength={120} autoFocus />
        <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="Size" aria-label="Its size" maxLength={60} className="pantry-card-other-size" />
        <button className="button primary small" disabled={!brand.trim()}>
          Add
        </button>
      </div>
    </form>
  );
}
