// What a scanned barcode turned out to be, on the pantry page. (In a
// browser, barcodes are typed into the page's find-or-add box, or a USB
// scanner types them there.)
import { useEffect, useState } from "react";
import type { PantryItem, PantryPacket, PantryStatus } from "./pb";
import type { PacketDetails } from "./pantryPackets";
import { itemWithBarcode } from "./barcodes";
import { canScan } from "./scanner";
import { guessPantryItem } from "./pantryLinks";
import PantryRow from "./PantryRow";
import { AddPantryItem, EditPantryItem, type Scanned } from "./PantryForms";

// What a scanned barcode is: the pantry item it's on (to mark low or out, or
// edit, or to add this packet to its packets in stock), or else a new item
// filled in from Open Food Facts, or the barcode put on an item already in
// the pantry (like another brand of it). A number nothing has is checked
// first, in case the scanner misread it.
export function ScanResult({
  scanned,
  items,
  editing,
  isOnList,
  onEdit,
  onStatus,
  onOpened,
  onAddToList,
  onScanAgain,
  onSure,
  onAdded,
  onSaved,
  onDelete,
  onAddBarcodeTo,
  packetsFor,
  onAddScannedPacket,
  onAddTypedPacket,
  onFinishPacket,
  onClose,
}: {
  scanned: Scanned;
  items: PantryItem[];
  editing: boolean;
  isOnList: (item: PantryItem) => boolean;
  onEdit: (editing: boolean) => void;
  onStatus: (item: PantryItem, status: PantryStatus) => void;
  onOpened: (item: PantryItem, opened: boolean) => void;
  onAddToList: (item: PantryItem) => void;
  onScanAgain: () => void;
  onSure: () => void;
  onAdded: (item: PantryItem) => void;
  onSaved: (item: PantryItem) => void;
  onDelete: (item: PantryItem) => void;
  // The brand: the scanned product's unless given.
  onAddBarcodeTo: (item: PantryItem, brand?: string) => void;
  // An item's packets in stock; null when the server has none (one from
  // before packets), so they aren't offered.
  packetsFor: ((item: PantryItem) => PantryPacket[]) | null;
  // Adds the scanned packet to the item; whether it did.
  onAddScannedPacket: (item: PantryItem) => Promise<boolean>;
  onAddTypedPacket: (item: PantryItem, details: PacketDetails) => Promise<boolean>;
  onFinishPacket: (item: PantryItem, packet: PantryPacket) => void;
  onClose: () => void;
}) {
  const [otherId, setOtherId] = useState("");
  // The scanned packet, once added (one scan, one packet).
  const [addedPacket, setAddedPacket] = useState<"" | "adding" | "added">("");
  // Each scan (the same barcode again too) can add its packet; on an item
  // whose stock is counted, the scan already did (Pantry's
  // addScannedByItself), and its Undo takes that back.
  useEffect(() => setAddedPacket(scanned.added ? "added" : ""), [scanned]);
  const found = itemWithBarcode(items, scanned.code);

  if (found)
    return (
      <section className="card stack scan-result">
        <div className="section-head">
          <h2>In the pantry</h2>
          <button className="button ghost small" onClick={onClose}>
            Done
          </button>
        </div>
        {editing ? (
          <EditPantryItem
            item={found}
            existing={items}
            packets={packetsFor?.(found) ?? null}
            onAddPacket={(details) => onAddTypedPacket(found, details)}
            onFinishPacket={(packet) => onFinishPacket(found, packet)}
            onSaved={onSaved}
            onCancel={() => onEdit(false)}
            onDelete={() => onDelete(found)}
          />
        ) : (
          <>
            <PantryRow
              item={found}
              // Everything about it, whichever layout the page is in.
              layout="detailed"
              onList={isOnList(found)}
              packets={packetsFor?.(found) ?? []}
              onFinishPacket={(packet) => onFinishPacket(found, packet)}
              onAddPacket={(details) => void onAddTypedPacket(found, details)}
              onEdit={() => onEdit(true)}
              onStatus={(status) => onStatus(found, status)}
              onOpened={(opened) => onOpened(found, opened)}
              onAddToList={() => onAddToList(found)}
            />
            {/* Done by itself only for an item whose stock is counted;
                otherwise offered, as counting stays each household's
                choice (docs/VISION.md). */}
            {packetsFor && (
              <div className="actions">
                {addedPacket === "added" ? (
                  <span className="muted small-note" role="status">
                    Added one.
                  </span>
                ) : (
                  <button
                    className="button small"
                    disabled={addedPacket === "adding"}
                    onClick={() => {
                      setAddedPacket("adding");
                      void onAddScannedPacket(found).then((added) => setAddedPacket(added ? "added" : ""));
                    }}
                  >
                    {addedPacket === "adding" ? "Adding…" : "+ Add this one"}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </section>
    );

  if (scanned.looking)
    return (
      <p className="card muted scan-result" role="status">
        Looking up {scanned.code}…
      </p>
    );

  const { product } = scanned;
  if (!product && !scanned.lookupError && !scanned.sure)
    return (
      <section className="card stack scan-result" role="status">
        <h2>Nothing has this number</h2>
        <p className="barcode-number">{scanned.code}</p>
        <p className="muted small-note">
          Scanners sometimes misread a digit, so scan it once more to check. Or check the number against the one under
          the barcode on the packet.
        </p>
        <div className="actions">
          <button className="button ghost small" onClick={onClose}>
            Cancel
          </button>
          <button className="button small" onClick={onSure}>
            It matches
          </button>
          {canScan && (
            <button className="button primary small" onClick={onScanAgain}>
              <span className="button-mark" aria-hidden="true">📷</span> Scan again
            </button>
          )}
        </div>
      </section>
    );

  // An item it's probably another packet of: "Coles Brown Sugar 1kg" ->
  // Brown sugar.
  const likely = product ? guessPantryItem(product.name, items) : null;

  return (
    <>
      {likely && (
        <section className="card stack scan-result">
          <p>
            Is this <strong>{likely.name}</strong>? It's already in the pantry
            {likely.brand || likely.location ? ` (${[likely.brand, likely.location].filter(Boolean).join(", ")})` : ""}.
          </p>
          <div className="actions">
            <button className="button primary small" onClick={() => onAddBarcodeTo(likely)}>
              Add to {likely.name}
            </button>
          </div>
        </section>
      )}
      <AddPantryItem
        key={scanned.code}
        existing={items}
        fromBarcode={scanned}
        onAdded={onAdded}
        onUseExisting={onAddBarcodeTo}
        onScanAgain={canScan ? onScanAgain : undefined}
        onClose={onClose}
      />
      {items.length > 0 && (
        <form
          className="card stack scan-result"
          onSubmit={(event) => {
            event.preventDefault();
            const item = items.find((i) => i.id === otherId);
            if (item) onAddBarcodeTo(item);
          }}
        >
          <label>
            Already in the pantry under another name?
            <select value={otherId} onChange={(e) => setOtherId(e.target.value)}>
              <option value="">Pick it…</option>
              {[...items]
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                    {item.location ? ` (${item.location})` : ""}
                  </option>
                ))}
            </select>
          </label>
          <button className="button" disabled={!otherId}>
            Add this barcode to it
          </button>
        </form>
      )}
    </>
  );
}
