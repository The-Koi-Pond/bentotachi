import { useEffect, useRef, useState } from "react";
import { errorMessage, recipeImageUrl, recipePhotoUrl, type Recipe } from "./pb";
import { numberedSteps, stepKey } from "./recipePhotos";
import { withoutSoftMarks } from "./softMarks";
import { CloseIcon } from "./icons";

// A recipe's photo, full size, opened by tapping one on the recipe page:
// ‹ › (or a swipe, or the arrow keys) goes through the others, and under it
// what can be done with it. The cover can be adjusted (PhotoFramer); the
// other photos can be put with a step, made the cover, or removed. Each
// saves straight away, like the rest of the recipe page. `photos` lists
// what to go through, "" standing for the cover.
export default function PhotoViewer({
  recipe,
  photos,
  start,
  onClose,
  onAdjustCover,
  onSetStep,
  onMakeCover,
  onRemove,
}: {
  recipe: Recipe;
  photos: string[];
  start: number;
  onClose: () => void;
  onAdjustCover: () => void;
  onSetStep: (name: string, key: string | null) => Promise<void>;
  onMakeCover: (name: string) => Promise<void>;
  onRemove: (name: string) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(start);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const swipeFrom = useRef<number | null>(null);

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // A photo removed or made the cover leaves the list: stay in range, and
  // close once there's nothing left to show.
  useEffect(() => {
    if (!photos.length) onClose();
    else if (index >= photos.length) setIndex(photos.length - 1);
  }, [photos.length, index, onClose]);

  const count = photos.length;
  const go = (step: number) => {
    setError("");
    setIndex((i) => (i + step + count) % count);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (count < 2) return;
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const name = photos[Math.min(index, count - 1)];
  if (name === undefined) return null;
  const isCover = name === "";
  const steps = numberedSteps(recipe.steps);
  const chosen = recipe.photo_steps?.[name];
  const stepValue = chosen && steps.some((step) => stepKey(step.line) === chosen) ? chosen : "";

  async function run(label: string, action: () => Promise<void>) {
    setBusy(label);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="photo-viewer"
      aria-label="Photo"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="photo-viewer-panel">
        <div className="photo-viewer-head">
          <span className="muted">{count > 1 ? `${index + 1} of ${count}` : isCover ? "Cover photo" : "Photo"}</span>
          <button className="icon-button small" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <div
          className="photo-viewer-frame"
          onTouchStart={(event) => (swipeFrom.current = event.touches[0].clientX)}
          onTouchEnd={(event) => {
            const from = swipeFrom.current;
            swipeFrom.current = null;
            if (from === null || count < 2) return;
            const moved = event.changedTouches[0].clientX - from;
            if (Math.abs(moved) > 50) go(moved < 0 ? 1 : -1);
          }}
        >
          <img src={isCover ? recipeImageUrl(recipe) : recipePhotoUrl(recipe, name)} alt={isCover ? "Cover photo" : "Photo"} />
          {count > 1 && (
            <>
              <button className="photo-viewer-nav prev" onClick={() => go(-1)} aria-label="Previous photo">
                ‹
              </button>
              <button className="photo-viewer-nav next" onClick={() => go(1)} aria-label="Next photo">
                ›
              </button>
            </>
          )}
        </div>
        {isCover ? (
          <div className="photo-viewer-actions">
            <button className="button small" onClick={onAdjustCover}>
              Adjust photo
            </button>
          </div>
        ) : (
          <div className="photo-viewer-actions">
            {steps.length > 0 && (
              <label className="photo-step">
                Show with
                <select
                  value={stepValue}
                  disabled={!!busy}
                  onChange={(event) => void run("Saving", () => onSetStep(name, event.target.value || null))}
                >
                  <option value="">No step (with the photos at the top)</option>
                  {steps.map((step) => (
                    <option key={step.index} value={stepKey(step.line)}>
                      Step {step.number}: {shorten(withoutSoftMarks(step.line))}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="photo-viewer-buttons">
              <button className="button small" disabled={!!busy} onClick={() => void run("Making it the cover", () => onMakeCover(name))}>
                Make cover
              </button>
              <button
                className="button small danger"
                disabled={!!busy}
                onClick={() => {
                  if (window.confirm("Remove this photo from the recipe?")) void run("Removing", () => onRemove(name));
                }}
              >
                Remove
              </button>
            </div>
          </div>
        )}
        {busy && <p className="muted">{busy}…</p>}
        {error && <p className="error">{error}</p>}
      </div>
    </dialog>
  );
}

// A step's first words, for the step picker.
function shorten(text: string): string {
  const words = text.trim().split(/\s+/);
  return words.length > 8 ? `${words.slice(0, 8).join(" ")}…` : text.trim();
}
