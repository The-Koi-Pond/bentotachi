import { useEffect, useRef, useState, type CSSProperties } from "react";
import { errorMessage, isAndroidApp, pb, recipeRatings, type Recipe } from "./pb";
import { CameraIcon, CopyIcon, DownloadIcon, MoreIcon, PrintIcon, ShareIcon, TrashIcon } from "./icons";
import { recipeAsText } from "./recipeText";
import { shareText } from "./shareReceiver";
import { fileNamePart, savePaprikaFile } from "./paprikaSave";

// The recipe page's ⋯ beside its title (Xel, 2026-11-07, like Paprika's):
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
  const [open, setOpen] = useState(false);
  // Outside the panel, so it's still there when the photo picker answers
  // (the panel closes when Android's picker covers the app).
  const photoInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const menuRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  // Where the panel goes: from the ⋯ itself, kept on screen whether the ⋯
  // sits under the title or beside it (offline, wider screens), below it or,
  // without room there, above it, and no taller than the space between the
  // bars (found in review).
  const [place, setPlace] = useState<CSSProperties>({});

  function openMenu() {
    const button = buttonRef.current?.getBoundingClientRect();
    if (!button) return;
    const width = Math.min(300, window.innerWidth - 32);
    const left = Math.max(16, Math.min(button.right - width, window.innerWidth - 16 - width));
    // The floor: the tab bar's top, or the running timers' tray above it.
    const tabbar = document.querySelector(".tabbar")?.getBoundingClientRect().top ?? window.innerHeight;
    const tray = document.querySelector(".timer-tray")?.getBoundingClientRect().top ?? window.innerHeight;
    const topbar = document.querySelector(".topbar")?.getBoundingClientRect().bottom ?? 0;
    const below = Math.min(tabbar, tray) - button.bottom - 12;
    const above = button.top - topbar - 12;
    // Both edges set: the panel's usual rule (.menu-panel) gives it a top.
    setPlace(
      below >= 260 || below >= above
        ? { left, width, top: button.bottom + 6, bottom: "auto", maxHeight: below }
        : { left, width, top: "auto", bottom: window.innerHeight - button.top + 6, maxHeight: above }
    );
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    // It's placed on the screen, not the page, so moving the page closes it.
    const onMove = () => setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onMove, { passive: true });
    window.addEventListener("resize", onMove);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onMove);
      window.removeEventListener("resize", onMove);
    };
  }, [open]);

  // A short note that goes by itself (copied, saved, couldn't).
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function run(label: string, action: () => Promise<void>) {
    setOpen(false);
    setBusy(label);
    try {
      await action();
    } catch (err) {
      setMessage(errorMessage(err));
    } finally {
      setBusy("");
    }
  }

  async function share() {
    try {
      const result = await shareText(recipe.title, recipeAsText(recipe, scale));
      if (result === "copied") setMessage("Copied the recipe, ready to paste into a message or email.");
    } catch {
      setMessage("Couldn't share it from here. Try again, or select the text and copy it.");
    }
  }

  async function saveFile() {
    const ratings = await recipeRatings().getFullList({ filter: pb.filter("recipe = {:id}", { id: recipe.id }) });
    const name = `${fileNamePart(recipe.title) || "Recipe"}.paprikarecipes`;
    const { saved, missingPhotos } = await savePaprikaFile([recipe], ratings, pb.authStore.record?.id, name, () => {});
    if (saved) {
      setMessage(
        missingPhotos.length
          ? `Saved “${name}”, but a photo wouldn't load, so it's left out: try again to include it.`
          : `Saved “${name}”. Send it to anyone: Bentotachi, Paprika, Mealie and Tandoor can import it.`
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
        onClick={() => (open ? setOpen(false) : openMenu())}
      >
        <MoreIcon />
      </button>
      {open && (
        <div className="menu-panel recipe-menu" role="menu" style={place}>
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
                setOpen(false);
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
            <button role="menuitem" onClick={() => void run("Re-importing", async () => setMessage(await onReimport()))}>
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
          if (files.length) void run("Adding photos", async () => setMessage(await onAddPhotos(files)));
        }}
      />
      {message && (
        <p className="toast" role="status">
          {message}
        </p>
      )}
    </div>
  );
}
