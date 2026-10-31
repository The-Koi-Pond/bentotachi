import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { errorMessage, pb, shoppingItems, type PantryItem, type ShoppingItem } from "../pb";
import { CloseIcon } from "../icons";
import { useLiveRecords } from "../useLiveRecords";
import StoreLink from "../StoreLink";
import { useUnsavedChanges } from "../unsavedChanges";
import { PANTRY_KEY, SHOPPING_KEY, SHOPPING_QUEUE_KEY, isOffline, read, write } from "../offline";
import OfflineNote from "../OfflineNote";
import { isUnsent, queueAdd, queueCheck, sendQueued, serverDate, withQueued, type QueuedChange } from "../offlineShopping";

export default function ShoppingList() {
  const { items, loadError, offline, setOffline, reload, upsert, removeLocally } = useLiveRecords<ShoppingItem>(
    "shopping_items",
    "recipe",
    SHOPPING_KEY
  );
  // Things linked to a pantry item show its preferred brand and store link.
  // Kept live, so changes made in the pantry show up here too.
  const pantry = useLiveRecords<PantryItem>("pantry_items", undefined, PANTRY_KEY);
  const pantryById = new Map((pantry.items ?? []).map((p) => [p.id, p]));
  const [error, setError] = useState("");
  const [text, setText] = useState("");
  // Something typed into "Add to the list" but not added yet.
  useUnsavedChanges(text.trim() !== "");
  // Ticks and additions made offline, kept on the phone until they're sent
  // (see offlineShopping.ts).
  const [queue, setQueueState] = useState<QueuedChange[]>(() => read<QueuedChange>(SHOPPING_QUEUE_KEY) ?? []);
  const setQueue = (update: (queue: QueuedChange[]) => QueuedChange[]) =>
    setQueueState((previous) => {
      const next = update(previous);
      write(SHOPPING_QUEUE_KEY, next);
      return next;
    });
  const sending = useRef(false);

  // Back online with changes waiting: send them, then load the list fresh.
  useEffect(() => {
    if (offline || !items || !queue.length || sending.current) return;
    sending.current = true;
    void sendQueued(
      queue,
      {
        add: (text, checked) => shoppingItems().create({ text, checked, added_by: pb.authStore.record?.id }),
        check: (id, checked) => shoppingItems().update(id, { checked }),
      },
      isOffline
    ).then((left) => {
      // Changes made while sending stay waiting too.
      setQueue((current) => [...left, ...current.slice(queue.length)]);
      sending.current = false;
      // Still offline: wait for the connection to come back. Otherwise load
      // the list as everyone now sees it.
      if (left.length) setOffline(true);
      if (left.length < queue.length) reload();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline, items, queue]);

  // The phone may have signal while the server was off (no "back online"
  // event then), so offline, try again every half minute.
  useEffect(() => {
    if (!offline) return;
    const timer = window.setInterval(reload, 30_000);
    return () => window.clearInterval(timer);
  }, [offline, reload]);

  // Offline: kept to send later. A failure that turns out to be offline is
  // treated the same, so nothing typed or ticked is lost.
  function keepForLater(change: (queue: QueuedChange[]) => QueuedChange[]) {
    setQueue(change);
    setOffline(true);
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    setError("");
    if (offline) return keepForLater((queue) => queueAdd(queue, value, new Date()));
    try {
      upsert(await shoppingItems().create({ text: value, checked: false, added_by: pb.authStore.record?.id }));
    } catch (err) {
      if (isOffline(err)) return keepForLater((queue) => queueAdd(queue, value, new Date()));
      setText(value);
      setError(errorMessage(err));
    }
  }

  async function toggle(item: ShoppingItem) {
    setError("");
    const checked = !item.checked;
    if (offline || isUnsent(item.id)) return keepForLater((queue) => queueCheck(queue, item.id, checked, new Date()));
    upsert({ ...item, checked, updated: serverDate(new Date()) });
    try {
      await shoppingItems().update(item.id, { checked });
    } catch (err) {
      if (isOffline(err)) return keepForLater((queue) => queueCheck(queue, item.id, checked, new Date()));
      upsert(item);
      setError(errorMessage(err));
    }
  }

  async function remove(item: ShoppingItem) {
    setError("");
    // Added offline and not sent yet: just forget it.
    if (isUnsent(item.id)) return setQueue((queue) => queue.filter((change) => change.id !== item.id));
    if (offline) return setError("Removing things needs a connection. Tick it off instead, and remove it later.");
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
    if (offline) return setError("Clearing needs a connection. The ticked things can wait until you're back online.");
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
  const shown = withQueued(items, queue);
  const toBuy = shown.filter((i) => !i.checked).sort((a, b) => a.created.localeCompare(b.created));
  const ticked = shown.filter((i) => i.checked).sort((a, b) => b.updated.localeCompare(a.updated));
  const waiting = queue.length;

  return (
    <div className="stack narrow">
      <h1>Shopping list</h1>
      {offline && (
        <OfflineNote onRetry={reload}>
          Showing the list saved on this phone. Ticking off and adding still work
          {waiting ? ` (${waiting} ${waiting === 1 ? "change" : "changes"} waiting)` : ""}, and are sent when you're back
          online.
        </OfflineNote>
      )}

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
