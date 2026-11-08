import { useEffect, useRef, useState, type FormEvent } from "react";
import { errorMessage, pantryItems, type PantryItem } from "./pb";
import { familiesOf, familyLinkValue, familyStatus, suggestedName, type Family, type IngredientLink } from "./pantryLinks";
import { CloseIcon } from "./icons";
import { placeOf } from "./pantryItem";
import { matchesPantrySearch } from "./pantryGroups";
import { sameName } from "./pantryFields";

const STATUS_LABEL = { have: "Have", low: "Low", out: "Out" } as const;

// Opened from an ingredient's pantry chip: link the line to a pantry item
// or to a group of kinds ("any pasta"), mark it "not a pantry item", or add
// it to the pantry. Calls onChoose with the pantry item id, the group's
// "kind:Pasta" (familyLinkValue), or "" for "not a pantry item", plus the
// item itself when it was just added here.
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

  const shown = items
    .filter((item) => matchesPantrySearch(item, search))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  // Groups of kinds ("Any pasta"), when the search matches the group or one
  // of its kinds.
  const families = [...familiesOf(items).values()]
    .filter((family) => matchesPantrySearch({ name: family.name, brand: "" }, search) || family.items.some((item) => shown.includes(item)))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  // Linked to a kind of something ("Linguine", a kind of Pasta), or to the
  // group: offered as "Linguine only" or "Any pasta will do" at the top.
  const family =
    current.family ?? (current.item?.kind_of ? familiesOf(items).get(current.item.kind_of.trim().toLowerCase()) : undefined);
  const kindsIn = (f: Family) =>
    f.items
      .filter((item) => item.status !== "out")
      .map((item) => item.name)
      .join(", ");

  // Adds the ingredient to the pantry (as "have") and links it.
  async function addToPantry(event: FormEvent) {
    event.preventDefault();
    const name = newName.trim();
    if (!name) return;
    const existing = sameName(items, name);
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
          {current.item || current.family
            ? `${current.kind === "guessed" ? "Bentotachi guessed" : "Linked to"}: ${current.item?.name ?? `any ${current.family?.name.toLowerCase()}`}`
            : current.kind === "notPantry"
              ? "Marked as not a pantry item."
              : "Not linked to anything in the pantry yet."}
        </p>

        {family && (
          <div className="link-kind-choice" role="group" aria-label={`Which ${family.name.toLowerCase()}`}>
            {current.item && (
              <button aria-pressed={current.kind === "chosen"} onClick={() => onChoose(current.item!.id)}>
                <span className="chooser-title">{current.item.name} only</span>
                <span className="muted chooser-details">{STATUS_LABEL[current.item.status]}</span>
              </button>
            )}
            <button aria-pressed={!!current.family && current.kind === "chosen"} onClick={() => onChoose(familyLinkValue(family.name))}>
              <span className="chooser-title">Any {family.name.toLowerCase()} will do</span>
              <span className="muted chooser-details">{kindsIn(family) ? `${kindsIn(family)} in` : "None in"}</span>
            </button>
          </div>
        )}

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
          {families.map((f) => (
            <li key={`kind:${f.name}`}>
              <button onClick={() => onChoose(familyLinkValue(f.name))} aria-pressed={current.family?.name === f.name}>
                <span className={`status-dot status-${familyStatus(f.items)}`} aria-hidden="true" />
                <span className="chooser-text">
                  <span className="chooser-title">Any {f.name.toLowerCase()}</span>
                  <span className="muted chooser-details">{kindsIn(f) ? `${kindsIn(f)} in` : "None in"}</span>
                </span>
              </button>
            </li>
          ))}
          {shown.map((item) => (
            <li key={item.id}>
              <button onClick={() => onChoose(item.id)} aria-pressed={current.item?.id === item.id}>
                <span className={`status-dot status-${item.status}`} aria-hidden="true" />
                <span className="chooser-text">
                  <span className="chooser-title">{item.name}</span>
                  <span className="muted chooser-details">
                    {STATUS_LABEL[item.status]}
                    {placeOf(item).location && ` · ${placeOf(item).location}`}
                    {placeOf(item).subcategory && ` · ${placeOf(item).subcategory}`}
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
