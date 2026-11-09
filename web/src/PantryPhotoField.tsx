import { useState, type ChangeEvent } from "react";
import { errorMessage, isAndroidApp } from "./pb";
import { findPhoto, shrinkPhoto, usePreviewUrl } from "./pantryPhoto";

// What the form will do with the item's photo when saved: undefined keeps
// it as it is, null removes it, a File replaces it.
export type PhotoChoice = File | null | undefined;

// Phones open the camera for "Take a photo"; on a computer it would only
// open the same file picker as "Choose a photo", so it isn't offered there.
// (A recipe's photo, RecipeEdit.tsx, offers the same.)
export const canTakePhoto = isAndroidApp || (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches);

// A pantry item's photo in its Add or Edit form: take one, choose one, or
// find one online (Open Food Facts for its barcodes, else its store links).
// Shown before it's saved; saved with the form.
export default function PantryPhotoField({
  savedUrl,
  barcodes,
  storeUrls,
  choice,
  onChoose,
  hint,
  bare = false,
}: {
  // The photo already saved (its address), or "".
  savedUrl: string;
  // The form's barcodes and store links (full addresses). Offers "Find its
  // photo online" if there are any.
  barcodes: string[];
  storeUrls: string[];
  hint?: string;
  choice: PhotoChoice;
  onChoose: (choice: PhotoChoice) => void;
  // Just the buttons: the edit form shows the photo itself, at the top.
  bare?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const preview = usePreviewUrl(choice);
  const shown = choice === null ? "" : choice ? preview : savedUrl;

  async function picked(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // So picking the same file again still counts as a change.
    event.target.value = "";
    if (!file) return;
    setError("");
    onChoose(await shrinkPhoto(file));
  }

  const canFind = barcodes.length > 0 || storeUrls.length > 0;
  async function findOnline() {
    if (!canFind) return;
    setBusy(true);
    setError("");
    try {
      onChoose(await shrinkPhoto(await findPhoto(barcodes, storeUrls)));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pantry-photo-field">
      {!bare && (
        <span className="label-text">
          Photo <span className="optional">(optional)</span>
        </span>
      )}
      {hint && <span className="hint">{hint}</span>}
      <div className="pantry-photo-row">
        {shown && !bare && <img className="pantry-photo-preview" src={shown} alt="The item's photo" />}
        <div className="store-buttons">
          {canTakePhoto && (
            <label className="button small file-button">
              <span className="button-mark" aria-hidden="true">📷</span> Take a photo
              <input type="file" accept="image/*" capture="environment" onChange={(e) => void picked(e)} />
            </label>
          )}
          <label className="button small file-button">
            Choose a photo
            <input type="file" accept="image/*" onChange={(e) => void picked(e)} />
          </label>
          {canFind && (
            <button type="button" className="button small" disabled={busy} onClick={() => void findOnline()}>
              {busy ? "Looking…" : "Find its photo online"}
            </button>
          )}
          {shown && (
            <button type="button" className="button ghost small" onClick={() => onChoose(savedUrl ? null : undefined)}>
              No photo
            </button>
          )}
        </div>
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}
