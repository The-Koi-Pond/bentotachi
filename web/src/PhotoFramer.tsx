import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { errorMessage, recipeImageUrl, type Recipe } from "./pb";
import { CloseIcon } from "./icons";
import { CENTRED, MAX_ZOOM, framingOf, framingStyle, isCentred, panned, zoomed, type Framing } from "./photoFraming";

// Framing a recipe's photo: drag it (or use the arrow keys) to choose what
// stays in view, and zoom in with the slider. The frame is card-shaped, as
// on the Recipes page; the recipe page shows a little more around it. The
// photo itself is never changed, so Reset brings it back.
export default function PhotoFramer({
  recipe,
  initial,
  onSave,
  onClose,
}: {
  recipe: Recipe;
  // Where to start, if not the saved framing.
  initial?: Framing;
  onSave: (framing: Framing) => Promise<void> | void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [framing, setFraming] = useState<Framing>(() => initial ?? framingOf(recipe.image_framing));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // The pointer's last spot while dragging.
  const dragFrom = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  function startDrag(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragFrom.current = { x: event.clientX, y: event.clientY };
  }

  function drag(event: PointerEvent<HTMLDivElement>) {
    const from = dragFrom.current;
    const box = frameRef.current?.getBoundingClientRect();
    if (!from || !box) return;
    setFraming((current) => panned(current, (event.clientX - from.x) / box.width, (event.clientY - from.y) / box.height));
    dragFrom.current = { x: event.clientX, y: event.clientY };
  }

  // Arrow keys nudge it, like dragging a little.
  function nudge(event: KeyboardEvent<HTMLDivElement>) {
    const step = 0.04;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    setFraming((current) => panned(current, move[0], move[1]));
  }

  async function save() {
    setBusy(true);
    setError("");
    try {
      await onSave(framing);
      onClose();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="framer-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="sheet-panel photo-framer">
        <div className="sheet-head">
          <h2 id="framer-title">Adjust photo</h2>
          <button type="button" className="icon-button small" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <p className="muted small-note">Drag the photo to choose what shows, and zoom in with the slider.</p>
        <div
          ref={frameRef}
          className="framer-frame"
          role="img"
          tabIndex={0}
          aria-label="The photo as it will show. Drag it, or use the arrow keys, to move it."
          onPointerDown={startDrag}
          onPointerMove={drag}
          onPointerUp={() => (dragFrom.current = null)}
          onPointerCancel={() => (dragFrom.current = null)}
          onKeyDown={nudge}
        >
          <img src={recipeImageUrl(recipe)} alt="" draggable={false} style={framingStyle(framing)} />
        </div>
        <label className="framer-zoom">
          Zoom
          <input
            type="range"
            min={1}
            max={MAX_ZOOM}
            step={0.05}
            value={framing.zoom}
            onChange={(e) => setFraming((current) => zoomed(current, Number(e.target.value)))}
          />
        </label>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button type="button" className="button ghost push-left" onClick={() => setFraming(CENTRED)} disabled={busy || isCentred(framing)}>
            Reset
          </button>
          <button type="button" className="button ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="button primary" onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
