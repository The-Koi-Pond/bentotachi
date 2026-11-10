import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { errorMessage, pb, shoppingItems, type PantryItem, type ShoppingItem } from "../pb";
import { BookIcon, CloseIcon } from "../icons";
import { useLiveRecords } from "../useLiveRecords";
import StoreLink from "../StoreLink";
import { brandBesideName, storeLinksOf } from "../pantryItem";
import { useUnsavedChanges } from "../unsavedChanges";
import { PANTRY_KEY, SHOPPING_KEY, isOffline } from "../offline";
import OfflineNote from "../OfflineNote";
import { useUndo } from "../undo";
import { showError, showToast } from "../toast";
import { ensureLoginNow } from "../session";
import { queueSender, setShoppingQueue, useShoppingQueue } from "../shoppingQueue";
import { clearPlan, isUnsent, mustWait, queueAdd, queueCheck, serverDate, withQueued, type QueuedChange } from "../offlineShopping";
import { aisleOf, byAisle } from "../aisles";
import { BenMood } from "../Brand";
import RecipeShoppingSheet from "../RecipeShoppingSheet";
import { sameThing } from "../shoppingMatch";
import { remember, remembered } from "../phoneStorage";

// What's still to buy, grouped by aisle in walking order (aisles.ts), or
// simply in the order it was added. Remembered on this device.
type Order = "aisle" | "added";
const ORDER_KEY = "bento.shoppingOrder";

function savedOrder(): Order {
  return remembered(ORDER_KEY) === "added" ? "added" : "aisle";
}

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
  const [order, setOrder] = useState<Order>(savedOrder);
  const [text, setText] = useState("");
  const [fromRecipe, setFromRecipe] = useState(false);
  // Something typed into "Add to the list" but not added yet.
  useUnsavedChanges(text.trim() !== "");
  // Ticks and additions made offline, kept on the phone until they're sent
  // (offlineShopping.ts), shared by the whole app (shoppingQueue.ts).
  const queue = useShoppingQueue();
  const setQueue = setShoppingQueue;
  // Removing shows "Undo" for a moment before it really happens.
  const undo = useUndo();

  // Back online with changes waiting: send them, then load the list fresh.
  // One send at a time for the whole app, so coming back to this page while
  // one runs doesn't start another.
  useEffect(() => {
    if (offline || !items || !queue.length || queueSender.isSending()) return;
    // A "Clear ticked" still offering Undo, with something added offline
    // among what it clears: carried out first. Sent now, that thing would
    // reach the server just before the clear looked for it in the queue,
    // and come back under Got it.
    if (queue.some((change) => undo.hidden.has(change.id))) {
      void undo.settle();
      return;
    }
    void queueSender
      .send({
        // An expired login would make every change look refused, so make
        // sure of it first. If it's no longer good, the login screen shows
        // and the changes wait for the next login (session.ts).
        loggedIn: async () => (await ensureLoginNow()) === "ok",
        add: (text, checked) => shoppingItems().create({ text, checked, added_by: pb.authStore.record?.id }),
        check: (id, checked) => shoppingItems().update(id, { checked }),
      })
      .then((result) => {
        if (!result) return;
        // Some couldn't go (offline again, the login couldn't be checked, or
        // the server can't take them now): keep trying. Otherwise load the
        // list as everyone now sees it.
        if (result.handled < result.total) setOffline(true);
        if (result.handled) reload();
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

  function changeOrder(next: Order) {
    setOrder(next);
    remember(ORDER_KEY, next);
  }

  async function add(event: FormEvent) {
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    setText("");
    // Already on the list: don't add it twice. Already bought (ticked):
    // put that one back instead.
    const same = shown.find((item) => sameThing({ text: value, pantryItem: "" }, item));
    if (same && !same.checked) return showToast(`“${same.text}” is already on the list.`);
    if (same) {
      showToast(`“${same.text}” is back on the list. That didn't last long.`);
      return toggle(same);
    }
    if (offline) return keepForLater((queue) => queueAdd(queue, value, new Date()));
    try {
      upsert(await shoppingItems().create({ text: value, checked: false, added_by: pb.authStore.record?.id }));
    } catch (err) {
      if (isOffline(err)) return keepForLater((queue) => queueAdd(queue, value, new Date()));
      setText(value);
      showError(errorMessage(err));
    }
  }

  // A change to this item made offline is being sent right now: changing it
  // again would race the send (see mustWait), so wait a moment.
  function busySending(item: ShoppingItem): boolean {
    if (!mustWait(queueSender.isSending(), queue, item.id)) return false;
    showToast(`Still sending what you changed offline. Try “${item.text}” again in a moment.`);
    return true;
  }

  async function toggle(item: ShoppingItem) {
    if (busySending(item)) return;
    const checked = !item.checked;
    if (offline || isUnsent(item.id)) return keepForLater((queue) => queueCheck(queue, item.id, checked, new Date()));
    upsert({ ...item, checked, updated: serverDate(new Date()) });
    try {
      await shoppingItems().update(item.id, { checked });
    } catch (err) {
      if (isOffline(err)) return keepForLater((queue) => queueCheck(queue, item.id, checked, new Date()));
      upsert(item);
      showError(errorMessage(err));
    }
  }

  async function remove(item: ShoppingItem) {
    if (busySending(item)) return;
    // Added offline and not sent yet: just forget it.
    if (isUnsent(item.id)) return setQueue((queue) => queue.filter((change) => change.id !== item.id));
    if (offline) return showError("Removing things needs a connection. Tick it off instead, and remove it later.");
    undo.offer([item.id], `Removed “${item.text}”.`, async () => {
      removeLocally(item.id);
      try {
        await shoppingItems().delete(item.id);
      } catch (err) {
        upsert(item);
        showError(errorMessage(err));
      }
    });
  }

  function clearTicked(ticked: ShoppingItem[]) {
    const plan = clearPlan(queueSender.isSending(), queue, ticked);
    if (plan.wait) return showToast("Still sending what you changed offline. Try Clear again in a moment.");
    // Only things added offline and not sent yet: no connection needed, they
    // just leave the phone's queue.
    if (offline && plan.sent.length)
      return showError("Clearing needs a connection. The ticked things can wait until you're back online.");
    const count = ticked.length;
    undo.offer(
      ticked.map((item) => item.id),
      `Cleared ${count} ticked ${count === 1 ? "thing" : "things"}.`,
      async () => {
        // Added offline and not sent: the server doesn't have them yet.
        if (plan.unsent.length) setQueue((queue) => queue.filter((change) => !plan.unsent.includes(change.id)));
        const sent = ticked.filter((item) => plan.sent.includes(item.id));
        sent.forEach((item) => removeLocally(item.id));
        const results = await Promise.allSettled(sent.map((item) => shoppingItems().delete(item.id)));
        const failed = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
        if (failed) {
          showError(`Couldn't clear everything: ${errorMessage(failed.reason)}`);
          reload();
        }
      }
    );
  }

  if (!items) return loadError ? <p className="error">{loadError}</p> : <p className="muted">Loading the list…</p>;

  // Still to buy: in the order they were added. Got it: most recent first.
  const shown = withQueued(items, queue).filter((item) => !undo.hidden.has(item.id));
  const toBuy = shown.filter((i) => !i.checked).sort((a, b) => a.created.localeCompare(b.created));
  const ticked = shown.filter((i) => i.checked).sort((a, b) => b.updated.localeCompare(a.updated));
  const waiting = queue.length;
  const aisles = byAisle(toBuy, (item) => aisleOf(item.text, pantryById.get(item.pantry_item)));
  const row = (item: ShoppingItem) => (
    <ShoppingRow key={item.id} item={item} pantryItem={pantryById.get(item.pantry_item)} onToggle={toggle} onRemove={remove} />
  );

  return (
    <div className="stack narrow">
      <div className="section-head">
        <h1>Shopping list</h1>
        <div className="view-switch" role="group" aria-label="Order">
          <button aria-pressed={order === "aisle"} onClick={() => changeOrder("aisle")}>
            By aisle
          </button>
          <button aria-pressed={order === "added"} onClick={() => changeOrder("added")}>
            As added
          </button>
        </div>
      </div>
      {offline && (
        <OfflineNote onRetry={reload} heading="Can't reach the server. Your shopping list didn't get the memo.">
          The copy on your phone still works. Keep shopping, and we'll sync your changes when we reconnect.
          {waiting > 0 && (
            <span className="offline-waiting">
              {waiting} {waiting === 1 ? "change" : "changes"} waiting to sync
            </span>
          )}
        </OfflineNote>
      )}

      <form className="add-row joined" onSubmit={add}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Add something, like “milk”"
          aria-label="New shopping item"
          enterKeyHint="done"
        />
        {/* A recipe's ingredients, found from here: a compartment of the
            add tray, beside Add. */}
        {!offline && (
          <button
            type="button"
            className="button from-recipe"
            onClick={() => setFromRecipe(true)}
            aria-label="Add from a recipe"
            title="Add from a recipe"
          >
            <BookIcon />
          </button>
        )}
        <button className="button primary" disabled={!text.trim()}>
          Add
        </button>
      </form>
      {fromRecipe && <RecipeShoppingSheet onClose={() => setFromRecipe(false)} />}

      {toBuy.length === 0 && ticked.length === 0 && (
        <div className="with-ben">
          <BenMood mood="halo" small />
          <p className="muted">
            Nothing to buy, for once. Add things here, or from a recipe's ingredients or from the plan.
          </p>
        </div>
      )}

      {toBuy.length > 0 &&
        (order === "added" ? (
          <ul className="shopping-list">{toBuy.map(row)}</ul>
        ) : (
          // One card, with a small heading row before each aisle's things.
          <ul className="shopping-list">
            {aisles.flatMap(({ aisle, things }) => [
              <li key={aisle} className="aisle-heading divider-label">
                <span>{aisle}</span>
              </li>,
              ...things.map(row),
            ])}
          </ul>
        ))}

      {ticked.length > 0 && (
        <section className="stack tray-section">
          <div className="section-head">
            <h2>Got it</h2>
            <button className="button small" onClick={() => clearTicked(ticked)}>
              Clear ticked items
            </button>
          </div>
          <ul className="shopping-list">{ticked.map(row)}</ul>
        </section>
      )}
      {undo.toast}
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
  // The pantry item's brand, unless it only repeats its name or this line's
  // ("Nutella" by Nutella).
  const brand = pantryItem && brandBesideName(pantryItem) && brandBesideName({ name: item.text, brand: pantryItem.brand });
  return (
    <li className={item.checked ? "ticked" : ""}>
      <label>
        <input type="checkbox" checked={item.checked} onChange={() => onToggle(item)} />
        <span>
          <span className="item-text">{item.text}</span>
          {brand && <span className="item-brand">{brand}</span>}
          {recipe && (
            <Link to={`/recipes/${recipe.id}`} className="item-source">
              for {recipe.title}
            </Link>
          )}
        </span>
      </label>
      {pantryItem &&
        !item.checked &&
        storeLinksOf(pantryItem).map((link) => <StoreLink key={link} url={link} itemName={item.text} />)}
      <button className="icon-button small" onClick={() => onRemove(item)} aria-label={`Remove ${item.text}`}>
        <CloseIcon />
      </button>
    </li>
  );
}
