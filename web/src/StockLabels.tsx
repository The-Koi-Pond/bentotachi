// An item's labels: each one in stock (or a few the same, "2 × 400 g") with
// its own use-by and opened (docs/VISION.md, "Pantry labels"). − uses up the
// oldest of them (the page offers Undo, or Out for the last one); tapping a
// label opens that one (brand, size, bought, use-by, opened, its barcode),
// tapping it again closes it. Each change saves as it's made, so there's no
// Done. On the pantry row, its quick card and its edit form.
import { useState, type KeyboardEvent } from "react";
import type { PantryPacket } from "./pb";
import { boughtDay, labelMeta, packetGroups } from "./pantryPackets";
import { expiryDate, toStoredDate } from "./expiry";
import { localToday } from "./dates";
import DateField from "./DateField";

export default function StockLabels({
  packets,
  onUsed,
  onSave,
}: {
  packets: PantryPacket[];
  onUsed: (packet: PantryPacket) => void;
  // Saves changes to one label; whether it saved.
  onSave: (packet: PantryPacket, changes: Partial<PantryPacket>) => Promise<boolean>;
}) {
  // The label open for a closer look (its id).
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <ul className="stock-labels">
      {/* Each with its brand, the favourite too: a label says what it is. */}
      {packetGroups(packets).map((group) => {
        const first = group.packets[0];
        const meta = labelMeta(first);
        const what = group.label || "One";
        const open = openId !== null && group.packets.some((packet) => packet.id === openId);
        return (
          <li key={first.id} className={open ? "stock-label open" : "stock-label"}>
            <div className="stock-label-row">
              <button type="button" className="stock-label-what" aria-expanded={open} onClick={() => setOpenId(open ? null : first.id)}>
                <strong>{group.count > 1 ? `${group.count} × ${what}` : what}</strong>
                {meta.text && <span className={meta.soon ? "stock-label-meta soon" : "stock-label-meta"}>{meta.text}</span>}
              </button>
              <button type="button" className="stock-label-use" onClick={() => onUsed(first)} aria-label={`Used one ${what}`} title="Used one">
                −
              </button>
            </div>
            {open && (
              <LabelEditor packet={first} onSave={(changes) => void onSave(first, changes)} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

// One label up close. A date saves when it's picked, the brand or size when
// its box is left (or Enter); dates are plain days.
function LabelEditor({ packet, onSave }: { packet: PantryPacket; onSave: (changes: Partial<PantryPacket>) => void }) {
  const [brand, setBrand] = useState(packet.brand ?? "");
  const [size, setSize] = useState(packet.size ?? "");
  const [expires, setExpires] = useState(expiryDate(packet.expires ?? ""));
  const [opened, setOpened] = useState(expiryDate(packet.opened ?? ""));
  const [bought, setBought] = useState(boughtDay(packet));

  // Brand or size typed: saved once the box is left, if it changed.
  const keepText = (field: "brand" | "size", value: string) => {
    if (value.trim() !== (packet[field] ?? "").trim()) onSave({ [field]: value.trim() });
  };
  const enterLeaves = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    event.currentTarget.blur();
  };

  return (
    // Not a <form>: it can sit inside the item's edit form.
    <div className="stock-label-editor" role="group" aria-label="This one">
      <label>
        Brand
        <input value={brand} onChange={(e) => setBrand(e.target.value)} onBlur={() => keepText("brand", brand)} onKeyDown={enterLeaves} maxLength={120} />
      </label>
      <label>
        Size
        <input
          value={size}
          onChange={(e) => setSize(e.target.value)}
          onBlur={() => keepText("size", size)}
          onKeyDown={enterLeaves}
          maxLength={60}
          placeholder="like 400 g"
        />
      </label>
      <label>
        Bought
        <DateField
          label="Bought"
          value={bought}
          onChange={(day) => {
            setBought(day);
            onSave({ bought: toStoredDate(day) });
          }}
          required
        />
      </label>
      <label>
        Use by
        <DateField
          label="Use by"
          value={expires}
          onChange={(day) => {
            setExpires(day);
            onSave({ expires: toStoredDate(day) });
          }}
        />
      </label>
      {/* A whole row: room for the date and Today side by side. */}
      <label className="stock-label-wide">
        Opened
        <DateField
          label="Opened"
          value={opened}
          onChange={(day) => {
            setOpened(day);
            onSave({ opened: toStoredDate(day) });
          }}
          empty="Not opened"
          quick={{ label: "Today", date: localToday() }}
        />
      </label>
      {packet.barcode && <p className="muted stock-label-barcode">Barcode {packet.barcode}</p>}
    </div>
  );
}
