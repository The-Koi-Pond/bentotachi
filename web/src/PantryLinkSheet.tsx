import { useEffect, useRef, useState, type FormEvent } from "react";
import { errorMessage, pantryItems, type PantryItem } from "./pb";
import { suggestedName, type IngredientLink } from "./pantryLinks";
import { CloseIcon } from "./icons";

const STATUS_LABEL = { have: "Have", low: "Low", out: "Out" } as const;

// Opened from an ingredient's pantry chip: link the line to a pantry item,
// mark it "not a pantry item", or add it to the pantry. Calls onChoose with
// the pantry item id, or "" for "not a pantry item", plus the item itself
// when it was just added here.
export default function PantryLinkSheet({
  line,
  current,
  items,
  onChoose,
  onClose,
}: {
  line: string;
  current: IngredientLink;
  items: PantryItem[];
  onChoose: (pantryItemId: string, added?: PantryItem) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState(() => suggestedName(line));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const words = search.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = items
    .filter((item) => words.every((word) => item.name.toLowerCase().includes(word)))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  // Adds the ingredient to the pantry (as "have") and links it.
  async function addToPantry(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const existing = items.find((item) => item.name.trim().toLowerCase() === name.toLowerCase());
    if (existing) {
      onChoose(existing.id);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const created = await pantryItems().create({ name, status: "have", location: "", subcategory: "" });
      onChoose(created.id, created);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="link-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="sheet-panel">
        <div className="sheet-head">
          <h2 id="link-title">Pantry item for “{line}”</h2>
          <button className="icon-button small" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        <p className="muted link-now">
          {current.item
            ? `${current.kind === "guessed" ? "Bento guessed" : "Linked to"}: ${current.item.name}`
            : current.kind === "notPantry"
              ? "Marked as not a pantry item."
              : "Not linked to anything in the pantry yet."}
        </p>

        <button className="button small" onClick={() => onChoose("")}>
          Not a pantry item (like water)
        </button>

        <form className="add-row" onSubmit={addToPantry}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={200}
            aria-label="Name for a new pantry item"
          />
          <button className="button primary small" disabled={busy || !newName.trim()}>
            {busy ? "Adding…" : "Add to pantry"}
          </button>
        </form>
        {error && <p className="error">{error}</p>}

        <p className="sheet-divider muted">or pick from the pantry</p>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search the pantry"
          aria-label="Search the pantry"
        />
        {items.length === 0 && <p className="muted">The pantry is empty so far.</p>}
        <ul className="chooser-list">
          {shown.map((item) => (
            <li key={item.id}>
              <button onClick={() => onChoose(item.id)} aria-pressed={current.item?.id === item.id}>
                <span className={`status-dot status-${item.status}`} aria-hidden="true" />
                <span className="chooser-text">
                  <span className="chooser-title">{item.name}</span>
                  <span className="muted chooser-details">
                    {STATUS_LABEL[item.status]}
                    {item.location && ` · ${item.location}`}
                    {item.subcategory && ` · ${item.subcategory}`}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </dialog>
  );
}
