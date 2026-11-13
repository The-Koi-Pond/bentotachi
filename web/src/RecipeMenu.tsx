import { useRef, useState } from "react";
import { errorMessage, isAndroidApp, pb, recipeRatings, type Recipe } from "./pb";
import { showError, showToast } from "./toast";
import { CameraIcon, CopyIcon, DownloadIcon, MoreIcon, PrintIcon, ShareIcon, TrashIcon } from "./icons";
import { recipeAsText } from "./recipeText";
import { shareText } from "./shareReceiver";
import { fileNamePart, savePaprikaFile } from "./paprikaSave";
import { usePopMenu } from "./usePopMenu";

// The recipe page's ⋯ beside its title (like Paprika's):
// Share (as text, at the size it's scaled to: Android's share sheet in the
// app, which reaches email and chats, the browser's where it has one, or
// copied), Save as a Paprika file (to send to a friend, who can import it),
// Print (browsers only: the app's web view can't print), Duplicate (a copy to
// make a variation) and Delete. Closes on a tap outside or Escape, like the
// top bar's ⋮ (SettingsMenu.tsx). Offline, only what works without the
// server: Share and Print.
export default function RecipeMenu({
  recipe,
  scale,
  offline,
  editing,
  onDuplicate,
  onReimport,
  onDelete,
  onAddPhotos,
}: {
  recipe: Recipe;
  scale: number;
  offline: boolean;
  // A part of the recipe is being edited in place: Duplicate and Delete
  // wait, as they'd lose or outrun the unsaved changes (found in review).
  editing: boolean;
  onDuplicate: () => Promise<void>;
  // Re-imports it from its website (RecipeView's reimport), saying what
  // happened ("" when the person changed their mind).
  onReimport: () => Promise<string>;
  onDelete: () => Promise<void>;
  // Adds the chosen photos (RecipeView's addPhotos), saying what happened.
  onAddPhotos: (files: File[]) => Promise<string>;
}) {
  // Placed from the ⋯ itself, kept on screen whether the ⋯ sits under the
  // title or beside it (offline, wider screens), below it or above it, and
  // no taller than the space between the bars.
  const { open, place, menuRef, buttonRef, close, toggle } = usePopMenu();
  // Outside the panel, so it's still there when the photo picker answers
  // (the panel closes when Android's picker covers the app).
  const photoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");

  async function run(label: string, action: () => Promise<void>) {
    close();
    setBusy(label);
    try {
      await action();
    } catch (err) {
      showError(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function share() {
    try {
      const result = await shareText(recipe.title, recipeAsText(recipe, scale));
      if (result === "copied") showToast("Copied the recipe, ready to paste into a message for whoever asked for it.");
    } catch {
      showError("Couldn't share it from here. Try again, or select the text and copy it.");
    }
  }

  async function saveFile() {
    const ratings = await recipeRatings().getFullList({ filter: pb.filter("recipe = {:id}", { id: recipe.id }) });
    const name = `${fileNamePart(recipe.title) || "Recipe"}.paprikarecipes`;
    const { savedAs, missingPhotos } = await savePaprikaFile([recipe], ratings, pb.authStore.record?.id, name, () => {});
    if (savedAs) {
      showToast(
        missingPhotos.length
          ? `Saved “${savedAs}”, but a photo wouldn't load, so it's left out: try again to include it.`
          : `Saved “${savedAs}”. Send it to anyone: Bentotachi, Paprika, Mealie and Tandoor can import it.`
      );
    }
  }

  return (
    <div className="menu" ref={menuRef}>
      <button
        ref={buttonRef}
        className="button small icon-only"
        aria-label={busy ? `${busy}…` : "More for this recipe"}
        title="More"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!!busy}
        onClick={toggle}
      >
        <MoreIcon />
      </button>
      {open && (
        <div className="menu-panel pop-menu recipe-menu" role="menu" style={place}>
          <button role="menuitem" onClick={() => void run("Sharing", share)}>
            Share
            <ShareIcon />
          </button>
          {!offline && (
            <button role="menuitem" onClick={() => void run("Saving", saveFile)}>
              <span className="menu-item-text">
                Save as a Paprika file
                <span className="menu-item-detail">To send to someone, or another app</span>
              </span>
              <DownloadIcon />
            </button>
          )}
          {!isAndroidApp && (
            <button role="menuitem" onClick={() => void run("Printing", async () => window.print())}>
              Print
              <PrintIcon />
            </button>
          )}
          {!offline && (
            <button
              role="menuitem"
              onClick={() => {
                close();
                photoInput.current?.click();
              }}
            >
              <span className="menu-item-text">
                Add photos
                <span className="menu-item-detail">How yours turned out, or one for a step</span>
              </span>
              <CameraIcon />
            </button>
          )}
          {!offline && !editing && (
            <button role="menuitem" onClick={() => void run("Duplicating", onDuplicate)}>
              <span className="menu-item-text">
                Duplicate
                <span className="menu-item-detail">A copy to make your own version</span>
              </span>
              <CopyIcon />
            </button>
          )}
          {!offline && !editing && recipe.source_url && (
            <button role="menuitem" onClick={() => void run("Re-importing", async () => showToast(await onReimport()))}>
              <span className="menu-item-text">
                Re-import from the website
                <span className="menu-item-detail">Its current ingredients and method; your notes and photos stay</span>
              </span>
              <DownloadIcon />
            </button>
          )}
          {!offline && !editing && (
            <button role="menuitem" className="danger-item" onClick={() => void run("Deleting", onDelete)}>
              Delete recipe
              <TrashIcon size={18} />
            </button>
          )}
        </div>
      )}
      <input
        ref={photoInput}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(event) => {
          const files = [...(event.target.files ?? [])];
          // So choosing the same photo again still counts.
          event.target.value = "";
          if (files.length) void run("Adding photos", async () => showToast(await onAddPhotos(files)));
        }}
      />
    </div>
  );
}
