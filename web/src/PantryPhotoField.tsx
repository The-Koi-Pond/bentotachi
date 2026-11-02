import { useState, type ChangeEvent } from "react";
import { errorMessage, isAndroidApp } from "./pb";
import { photoFromPage, shrinkPhoto, usePreviewUrl } from "./pantryPhoto";

// What the form will do with the item's photo when saved: undefined keeps
// it as it is, null removes it, a File replaces it.
export type PhotoChoice = File | null | undefined;

// Phones open the camera for "Take a photo"; on a computer it would only
// open the same file picker as "Choose a photo", so it isn't offered there.
const canTakePhoto = isAndroidApp || (typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches);

// A pantry item's photo in its Add or Edit form: take one, choose one, or
// use the photo from its store link. Shown before it's saved; saved with
// the form.
export default function PantryPhotoField({
  savedUrl,
  storeUrl,
  choice,
  onChoose,
  hint,
}: {
  // The photo already saved (its address), or "".
  savedUrl: string;
  // The form's store link, made into a full address, or "" / null. Offers
  // "Use the store's photo" if there is one.
  storeUrl: string | null;
  hint?: string;
  choice: PhotoChoice;
  onChoose: (choice: PhotoChoice) => void;
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

  async function fromLink() {
    if (!storeUrl) return;
    setBusy(true);
    setError("");
    try {
      onChoose(await shrinkPhoto(await photoFromPage(storeUrl)));
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pantry-photo-field">
      <span className="label-text">
        Photo <span className="optional">(optional)</span>
      </span>
      {hint && <span className="hint">{hint}</span>}
      <div className="pantry-photo-row">
        {shown && <img className="pantry-photo-preview" src={shown} alt="The item's photo" />}
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
          {storeUrl && (
            <button type="button" className="button small" disabled={busy} onClick={() => void fromLink()}>
              {busy ? "Getting it…" : "Use the store's photo"}
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
