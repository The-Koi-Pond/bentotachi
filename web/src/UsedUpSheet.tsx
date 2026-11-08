// "Nice. Used anything up?": after a recipe is marked cooked (Finished at
// the end of the method, "We cooked this", or its timer), what it worked out
// the meal used from the pantry, already ticked (cookedUses.ts). Ticked ones
// come off the pantry; Skip leaves it. Only opens when there's something to
// offer.
import { useEffect, useRef, useState } from "react";
import { errorMessage, pantryItems, pantryPackets, type PantryItem, type PantryPacket, type Recipe } from "./pb";
import { useLiveRecords } from "./useLiveRecords";
import { cookedUses, type Use } from "./cookedUses";
import type { RecipeMeasures } from "./volumes";
import { CloseIcon } from "./icons";

export default function UsedUpSheet({
  recipe,
  scale,
  measures,
  onClose,
}: {
  recipe: Recipe;
  scale: number;
  measures: RecipeMeasures;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pantry = useLiveRecords<PantryItem>("pantry_items");
  const packets = useLiveRecords<PantryPacket>("pantry_packets");
  // Worked out once, as the pantry was when cooking finished, so a live
  // update doesn't change the list while someone's ticking it.
  const [uses, setUses] = useState<Use[] | null>(null);
  const [ticked, setTicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    if (uses || !pantry.items || !packets.items) return;
    const worked = cookedUses(recipe.ingredients ?? [], recipe.ingredient_links, pantry.items, packets.items, { scale, measures });
    if (!worked.length) {
      onClose();
      return;
    }
    setUses(worked);
    setTicked(new Set(worked.filter((use) => use.ticked).map((use) => use.item.id)));
  }, [uses, pantry.items, packets.items, recipe, scale, measures, onClose]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (uses && dialog && !dialog.open) dialog.showModal();
    return () => dialog?.close();
  }, [uses]);

  // Couldn't load the pantry (offline): nothing to offer.
  useEffect(() => {
    if (pantry.loadError || packets.loadError) onClose();
  }, [pantry.loadError, packets.loadError, onClose]);

  function toggle(id: string) {
    setTicked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function takeOff() {
    if (!uses) return;
    setBusy(true);
    setError("");
    const chosen = uses.filter((use) => ticked.has(use.item.id));
    try {
      for (const use of chosen) {
        for (const packet of use.finish) {
          try {
            await pantryPackets().delete(packet.id);
          } catch (err) {
            // Already gone (finished on another phone meanwhile) is fine.
            if ((err as { status?: number }).status !== 404) throw err;
          }
        }
        if (use.leave) await pantryPackets().update(use.leave.packet.id, { left: use.leave.left });
        // Out with ask_about_list: it's not put on the shopping list by itself.
        if (use.status === "out") await pantryItems().update(use.item.id, { status: "out", ask_about_list: true });
        if (use.status === "low") await pantryItems().update(use.item.id, { status: "low" });
      }
      setDone(chosen.length ? `Took ${chosen.length === 1 ? "1 thing" : `${chosen.length} things`} off the pantry.` : "Nothing taken off.");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!uses) return null;
  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="used-up-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="sheet-panel">
        <div className="sheet-head">
          <h2 id="used-up-title">{done ? "Pantry updated" : "Nice. Used anything up?"}</h2>
          <button className="icon-button small" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        {done ? (
          <>
            <p className="success" role="status">
              {done}
            </p>
            <div className="actions">
              <button className="button primary" onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="muted">Marked as cooked today. Ticked ones come off the pantry.</p>
            <ul className="checklist used-up-list">
              {uses.map((use) => (
                <li key={use.item.id}>
                  <label>
                    <input type="checkbox" checked={ticked.has(use.item.id)} onChange={() => toggle(use.item.id)} />
                    <span className="week-row-text">
                      <span>{use.title}</span>
                      {use.note && <span className="muted week-row-for">{use.note}</span>}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {error && <p className="error">{error}</p>}
            <div className="actions">
              <button className="button ghost" onClick={onClose} disabled={busy}>
                Skip
              </button>
              <button className="button primary" onClick={() => void takeOff()} disabled={busy || ticked.size === 0}>
                {busy ? "Taking off…" : "Take them off"}
              </button>
            </div>
          </>
        )}
      </div>
    </dialog>
  );
}
