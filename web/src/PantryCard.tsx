// Opens under a pantry row when it's tapped: only what the row can't do
// itself (its pill already sets Have / Low / Out). Adding one with a tap:
// "+ 1 more" (the favourite, ★, so whoever's shopping knows which), the
// other products it's had (docs/VISION.md, "Products we buy"), or "+ New…".
// What's in stock as labels when the Simple row hides them, and "Edit
// everything" for the full form (PantryForms.tsx).
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { PantryItem, PantryPacket } from "./pb";
import { nextPacket, packetLabel, type PacketDetails } from "./pantryPackets";
import { otherProducts, preferredProduct, productName } from "./pantryProducts";
import { describeExpiry } from "./expiry";
import { brandsOf } from "./pantryItem";
import StockLabels from "./StockLabels";
import { PencilIcon } from "./icons";
import type { PantryLayout } from "./PantryRow";
import { useSpell } from "./household";

export default function PantryCard({
  item,
  packets,
  layout,
  onMore,
  onUsed,
  onSavePacket,
  onEditAll,
}: {
  item: PantryItem;
  // Its packets in stock, oldest first; null on a server from before
  // packets, which then aren't offered.
  packets: PantryPacket[] | null;
  layout: PantryLayout;
  onMore: (details: PacketDetails) => void;
  onUsed: (packet: PantryPacket) => void;
  onSavePacket: (packet: PantryPacket, changes: Partial<PantryPacket>) => Promise<boolean>;
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
  const [adding, setAdding] = useState(false);
  const next = nextPacket(item, packets ?? []);
  const preferred = preferredProduct(item);
  const others = otherProducts(item);
  // Labels carry their own dates, so the item's (their soonest) only shows
  // without any.
  const labelled = !!packets && packets.length > 0;
  const about = [[item.location, item.subcategory].filter(Boolean).join(", "), !labelled && item.expires && describeExpiry(item.expires)]
    .filter(Boolean)
    .join(" · ");
  const more = (details: PacketDetails) => {
    onMore(details);
    setAdding(false);
  };
  return (
    <div ref={ref} className="pantry-card" role="group" aria-label={`${item.name}: quick changes`}>
      {/* The Simple row hides what's in stock; the Detailed one shows it. */}
      {layout === "simple" && labelled && (
        <div className="pantry-stock" role="group" aria-label={`${item.name} in stock`}>
          <StockLabels packets={packets} onUsed={onUsed} onSave={onSavePacket} />
        </div>
      )}
      <div className="pantry-card-actions">
        {packets && (
          <button className="button primary small" onClick={() => more(next)}>
            + 1 more
            {preferred ? (
              <span className="pantry-card-size">
                · <span title={spell("Favourite")}>★</span> {productName(preferred)}
              </span>
            ) : (
              packetLabel(next) && <span className="pantry-card-size">· {packetLabel(next)}</span>
            )}
          </button>
        )}
        {/* Just a pencil, so it fits beside the biggest button on any phone. */}
        <button className="icon-button pantry-card-edit" onClick={onEditAll} aria-label="Edit everything" title="Edit everything">
          <PencilIcon />
        </button>
      </div>
      {packets && (
        <>
          {others.length > 0 && <p className="pantry-card-head">Or another we've had</p>}
          <div className="pantry-card-products">
            {others.map((product) => (
              <button key={`${product.brand}|${product.size}`} className="button small" onClick={() => more({ brand: product.brand, size: product.size })}>
                + {productName(product)}
              </button>
            ))}
            <button className="button small ghost pantry-card-new" aria-expanded={adding} onClick={() => setAdding(!adding)}>
              + New…
            </button>
          </div>
          {adding && <NewOne item={item} onAdd={more} />}
        </>
      )}
      {about && <p className="muted pantry-card-about">{about}</p>}
    </div>
  );
}

// "+ New…": one of a brand or size it hasn't had (the favourite was out,
// say). The server remembers it as a product, so next time it's one tap; it
// never becomes the favourite by itself. The brand left empty is the
// favourite's, so another size needs only a size.
function NewOne({ item, onAdd }: { item: PantryItem; onAdd: (details: PacketDetails) => void }) {
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const preferred = brandsOf(item.brand).length === 1 ? item.brand.trim() : "";
  const canAdd = !!(brand.trim() || size.trim());

  function add(event: FormEvent) {
    event.preventDefault();
    if (canAdd) onAdd({ brand: brand.trim() || preferred, size: size.trim() });
  }

  return (
    <form className="pantry-card-other" onSubmit={add}>
      <div className="pantry-card-other-row">
        <input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder={preferred || "Brand"} aria-label="Brand" maxLength={120} autoFocus />
        <input value={size} onChange={(e) => setSize(e.target.value)} placeholder="Size" aria-label="Its size" maxLength={60} className="pantry-card-other-size" />
        <button className="button primary small" disabled={!canAdd}>
          Add
        </button>
      </div>
    </form>
  );
}
