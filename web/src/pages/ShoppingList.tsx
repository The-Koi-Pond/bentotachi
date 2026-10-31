import { useState, type FormEvent } from "react";
import { Link } from "react-router";
import { errorMessage, pb, shoppingItems, type PantryItem, type ShoppingItem } from "../pb";
import { CloseIcon } from "../icons";
import { useLiveRecords } from "../useLiveRecords";
import StoreLink from "../StoreLink";
import { useUnsavedChanges } from "../unsavedChanges";

export default function ShoppingList() {
  const { items, loadError, reload, upsert, removeLocally } = useLiveRecords<ShoppingItem>("shopping_items", "recipe");
  // Things linked to a pantry item show its preferred brand and store link.
  // Kept live, so changes made in the pantry show up here too.
  const pantry = useLiveRecords<PantryItem>("pantry_items");
  const pantryById = new Map((pantry.items ?? []).map((p) => [p.id, p]));
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  // Something typed into "Add to the list" but not added yet.
  useUnsavedChanges(text.trim() !== "");

  async function add(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    setError("");
    try {
      upsert(await shoppingItems().create({ text: value, checked: false, added_by: pb.authStore.record?.id }));
    } catch (err) {
      setText(value);
      setError(errorMessage(err));
    }
  }

  async function toggle(item: ShoppingItem) {
    setError("");
    // Same date format as the server ("2026-10-30 09:15:00.000Z") so sorting matches.
    upsert({ ...item, checked: !item.checked, updated: new Date().toISOString().replace("T", " ") });
    try {
      await shoppingItems().update(item.id, { checked: !item.checked });
    } catch (err) {
      upsert(item);
      setError(errorMessage(err));
    }
  }

  async function remove(item: ShoppingItem) {
    setError("");
    removeLocally(item.id);
    try {
      await shoppingItems().delete(item.id);
    } catch (err) {
      upsert(item);
      setError(errorMessage(err));
    }
  }

  async function clearTicked(ticked: ShoppingItem[]) {
    setError("");
    ticked.forEach((item) => removeLocally(item.id));
    const results = await Promise.allSettled(ticked.map((item) => shoppingItems().delete(item.id)));
    const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failed) {
      setError(`Couldn't clear everything: ${errorMessage(failed.reason)}`);
      reload();
    }
  }

  if (!items) return loadError ? <p className="error">{loadError}</p> : <p className="muted">Loading the list…</p>;

  // Still to buy: in the order they were added. Got it: most recent first.
  const toBuy = items.filter((i) => !i.checked).sort((a, b) => a.created.localeCompare(b.created));
  const ticked = items.filter((i) => i.checked).sort((a, b) => b.updated.localeCompare(a.updated));

  return (
    <div className="stack narrow">
      <h1>Shopping list</h1>

      <form className="add-row" onSubmit={add}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add something, like “milk”"
          aria-label="New shopping item"
          enterKeyHint="done"
        />
        <button className="button primary" disabled={!text.trim()}>
          Add
        </button>
      </form>
      {error && <p className="error">{error}</p>}

      {toBuy.length === 0 && ticked.length === 0 && (
        <p className="muted">The list is empty. Add things here, or from a recipe's ingredients.</p>
      )}

      {toBuy.length > 0 && (
        <ul className="shopping-list">
          {toBuy.map((item) => (
            <ShoppingRow
              key={item.id}
              item={item}
              pantryItem={pantryById.get(item.pantry_item)}
              onToggle={toggle}
              onRemove={remove}
            />
          ))}
        </ul>
      )}

      {ticked.length > 0 && (
        <section className="stack">
          <div className="section-head">
            <h2>Got it</h2>
            <button className="button small" onClick={() => clearTicked(ticked)}>
              Clear ticked items
            </button>
          </div>
          <ul className="shopping-list">
            {ticked.map((item) => (
              <ShoppingRow
              key={item.id}
              item={item}
              pantryItem={pantryById.get(item.pantry_item)}
              onToggle={toggle}
              onRemove={remove}
            />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function ShoppingRow({
  item,
  pantryItem,
  onToggle,
  onRemove,
}: {
  item: ShoppingItem;
  // The pantry item it's for, if linked: for its brand and store link.
  pantryItem?: PantryItem;
  onToggle: (item: ShoppingItem) => void;
  onRemove: (item: ShoppingItem) => void;
}) {
  const recipe = item.expand?.recipe;
  return (
    <li className={item.checked ? "ticked" : ""}>
      <label>
        <input type="checkbox" checked={item.checked} onChange={() => onToggle(item)} />
        <span>
          <span className="item-text">{item.text}</span>
          {pantryItem?.brand && <span className="item-brand">{pantryItem.brand}</span>}
          {recipe && (
            <Link to={`/recipes/${recipe.id}`} className="item-source">
              for {recipe.title}
            </Link>
          )}
        </span>
      </label>
      {pantryItem?.store_url && !item.checked && <StoreLink url={pantryItem.store_url} itemName={item.text} />}
      <button className="icon-button small" onClick={() => onRemove(item)} aria-label={`Remove ${item.text}`}>
        <CloseIcon />
      </button>
    </li>
  );
}
