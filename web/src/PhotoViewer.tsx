import { useEffect, useRef, useState } from "react";
import { errorMessage, recipeImageUrl, recipePhotoUrl, type Recipe } from "./pb";
import { numberedSteps, stepKey } from "./recipePhotos";
import { withoutSoftMarks } from "./softMarks";
import { CloseIcon } from "./icons";
import { askFirst } from "./askFirst";

// A recipe's photo, full size, opened by tapping one on the recipe page:
// ‹ › (or a swipe, or the arrow keys) goes through the others, and under it
// what can be done with it. The cover can be adjusted (PhotoFramer); the
// other photos can be put with a step, made the cover, or removed. Each
// saves straight away, like the rest of the recipe page. `photos` lists
// what to go through, "" standing for the cover; `shown` is the one on
// screen, followed by its name so it stays put when a change reorders the
// list (putting it with a step moves it down the list).
export default function PhotoViewer({
  recipe,
  photos,
  shown,
  onShow,
  onClose,
  onAdjustCover,
  onSetStep,
  onMakeCover,
  onRemove,
}: {
  recipe: Recipe;
  photos: string[];
  shown: string;
  onShow: (name: string) => void;
  onClose: () => void;
  onAdjustCover: () => void;
  onSetStep: (name: string, key: string | null) => Promise<void>;
  onMakeCover: (name: string) => Promise<void>;
  onRemove: (name: string) => Promise<void>;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const swipeFrom = useRef<number | null>(null);
  // Where the shown photo was, for when it leaves the list (removed): the
  // one that took its place shows next.
  const lastIndex = useRef(0);
  const found = photos.indexOf(shown);
  const count = photos.length;
  const index = found >= 0 ? found : Math.min(lastIndex.current, count - 1);
  if (found >= 0) lastIndex.current = found;

  useEffect(() => {
    dialogRef.current?.showModal();
  }, []);

  // Close once there's nothing left to show; after a removal, show the
  // photo now in its place.
  useEffect(() => {
    if (!count) onClose();
    else if (found < 0) onShow(photos[index]);
  });

  const go = (step: number) => {
    setError("");
    onShow(photos[(index + step + count) % count]);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      // Not while choosing a step: some browsers change the choice with the
      // arrow keys too.
      if (count < 2 || event.target instanceof HTMLSelectElement) return;
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const name = photos[index];
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
                onClick={() =>
                  void askFirst("Remove this photo from the recipe?", { yes: "Remove", danger: true }).then((remove) => {
                    if (remove) void run("Removing", () => onRemove(name));
                  })
                }
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
