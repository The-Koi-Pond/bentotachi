import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { errorMessage, pb, shoppingItems, shoppingLists, type PantryItem, type ShoppingItem } from "../pb";
import { BookIcon, CloseIcon } from "../icons";
import { useLiveRecords } from "../useLiveRecords";
import StoreLink from "../StoreLink";
import { brandBesideName, storeLinksOf } from "../pantryItem";
import { useUnsavedChanges } from "../unsavedChanges";
import { isOffline, pantryCopy, shoppingCopy } from "../offline";
import OfflineNote from "../OfflineNote";
import { useUndo } from "../undo";
import { showError, showToast } from "../toast";
import { ensureLoginNow } from "../session";
import { queueSender, setShoppingQueue, useShoppingQueue } from "../shoppingQueue";
import { clearPlan, isUnsent, mustWait, newRecordId, queueAdd, queueCheck, withQueued, type QueuedChange } from "../offlineShopping";
import { serverDate } from "../dates";
import { aisleOf, byAisle } from "../aisles";
import { BenMood } from "../Brand";
import RecipeShoppingSheet from "../RecipeShoppingSheet";
import { sameThing } from "../shoppingMatch";
import { remember, remembered } from "../phoneStorage";
import { askFirst } from "../askFirst";
import TitlePicker, { type TitleWords } from "../TitlePicker";
import { useShoppingLists } from "../useShoppingLists";
import { rowsOn, storedList, toBuyOn, waitingElsewhere } from "../shoppingLists";
import { HelpBox, HelpButton, useHelp } from "../Help";
import { sharesOf, type Share } from "../shoppingAddUp";

// The title's menu of lists (TitlePicker; docs/PLAN.md, "several shopping
// lists").
const LIST_WORDS: TitleWords = { title: "Shopping list", choose: "choose a list", edit: "Edit lists…", newName: "New list", maxLength: 60 };

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
    { expand: "recipe", copy: shoppingCopy }
  );
  // Things linked to a pantry item show its preferred brand and store link.
  // Kept live, so changes made in the pantry show up here too.
  const pantry = useLiveRecords<PantryItem>("pantry_items", { copy: pantryCopy });
  const pantryById = new Map((pantry.items ?? []).map((p) => [p.id, p]));
  // The household's lists, and the one shown (the one last open here).
  const shop = useShoppingLists();
  const help = useHelp();
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
        add: (text, checked, record, list) =>
          shoppingItems().create({ ...(record && { id: record }), text, checked, list, added_by: pb.authStore.record?.id }),
        check: (id, checked) => shoppingItems().update(id, { checked }),
        onMoved: (text) => showToast(`“${text}” went on ${shop.nameOf(shop.mainId) || "the shopping list"}: its list was deleted meanwhile.`),
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
    // Waiting on another list: maybe that's where it was meant to be.
    const elsewhere = waitingElsewhere({ text: value, pantryItem: "" }, everything, shop.open, shop.lists);
    const list = storedList(shop.open, shop.mainId);
    if (
      elsewhere &&
      !(await askFirst(`“${value}” is already on ${elsewhere.name}. Add it to ${shop.nameOf(shop.open)} too?`, {
        yes: "Add it here too",
        no: "Leave it",
      }))
    )
      return;
    if (offline) return keepForLater((queue) => queueAdd(queue, value, new Date(), { list }));
    // Its id picked here: if the server saved it but the answer was lost,
    // sending it again later can't add a second one.
    const record = newRecordId();
    try {
      upsert(await shoppingItems().create({ id: record, text: value, checked: false, list, added_by: pb.authStore.record?.id }));
    } catch (err) {
      if (isOffline(err)) return keepForLater((queue) => queueAdd(queue, value, new Date(), { record, list }));
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

  // "Edit lists…": making, renaming and deleting lists need a connection.
  async function addList(name: string) {
    if (offline) return showError("Making a list needs a connection.");
    try {
      const made = await shoppingLists().create({ name, added_by: pb.authStore.record?.id });
      shop.live.upsert(made);
      shop.choose(made.id);
    } catch (err) {
      showError(errorMessage(err));
    }
  }

  async function renameList(id: string, name: string) {
    if (offline) return showError("Renaming a list needs a connection.");
    try {
      shop.live.upsert(await shoppingLists().update(id, { name }));
    } catch (err) {
      showError(errorMessage(err));
    }
  }

  // Asks first, saying what goes with it: the server deletes a list's rows
  // with it, so there's no Undo.
  async function deleteList(id: string) {
    if (offline) return showError("Deleting a list needs a connection.");
    const on = rowsOn(everything, id, shop.mainId).length;
    const name = shop.nameOf(id);
    const question = on ? `Delete “${name}” and the ${on} ${on === 1 ? "thing" : "things"} on it?` : `Delete “${name}”?`;
    if (!(await askFirst(question, { yes: "Delete list", danger: true }))) return;
    try {
      await shoppingLists().delete(id);
      shop.live.removeLocally(id);
      for (const row of rowsOn(items ?? [], id, shop.mainId)) removeLocally(row.id);
      if (shop.open === id) shop.choose(shop.mainId);
    } catch (err) {
      showError(errorMessage(err));
    }
  }

  if (!items) return loadError ? <p className="error">{loadError}</p> : <p className="muted">Loading the list…</p>;

  // Every list's rows (for "already on another list"), then the open one's.
  const everything = withQueued(items, queue).filter((item) => !undo.hidden.has(item.id));
  // Still to buy: in the order they were added. Got it: most recent first.
  const shown = rowsOn(everything, shop.open, shop.mainId);
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
        {shop.lists.length > 0 ? (
          <TitlePicker
            options={shop.lists.map((list) => {
              const left = toBuyOn(everything, list.id, shop.mainId);
              return { key: list.id, label: list.name, note: left ? `${left} to buy` : "", deletable: !list.main };
            })}
            current={shop.open}
            words={LIST_WORDS}
            onPick={(key) => key && shop.choose(key)}
            onAdd={(name) => void addList(name)}
            onRename={renameList}
            onDelete={deleteList}
            help={<HelpButton help={help} label="How the lists work" />}
          />
        ) : (
          // A server from before lists, or none loaded yet offline.
          <h1>Shopping list</h1>
        )}
        <div className="view-switch" role="group" aria-label="Order">
          <button aria-pressed={order === "aisle"} onClick={() => changeOrder("aisle")}>
            By aisle
          </button>
          <button aria-pressed={order === "added"} onClick={() => changeOrder("added")}>
            As added
          </button>
        </div>
      </div>
      <HelpBox help={help}>
        <p>Tap the list's name to switch lists, or to make one for the party, the hardware store or the next big shop.</p>
        <p>Adding from a recipe, the plan or the pantry goes to the list you last had open.</p>
      </HelpBox>
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
      {fromRecipe && <RecipeShoppingSheet list={{ list: shop.open, mainId: shop.mainId }} listName={shop.several ? shop.nameOf(shop.open) : ""} onClose={() => setFromRecipe(false)} />}

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
  // The pantry item's brand, unless it only repeats its name or this line's
  // ("Nutella" by Nutella).
  const brand = pantryItem && brandBesideName(pantryItem) && brandBesideName({ name: item.text, brand: pantryItem.brand });
  const shares = sharesOf(item);
  return (
    <li className={item.checked ? "ticked" : ""}>
      <label>
        <input type="checkbox" checked={item.checked} onChange={() => onToggle(item)} />
        <span>
          <span className="item-text">{item.text}</span>
          {brand && <span className="item-brand">{brand}</span>}
        </span>
      </label>
      {pantryItem &&
        !item.checked &&
        storeLinksOf(pantryItem).map((link) => <StoreLink key={link} url={link} itemName={item.text} />)}
      {shares.some((share) => share.recipe || share.title) && <SharesButton item={item} shares={shares} />}
      <button className="icon-button small" onClick={() => onRemove(item)} aria-label={`Remove ${item.text}`}>
        <CloseIcon />
      </button>
    </li>
  );
}

// The book on a line from recipes: which recipes need it and how much of it
// each, in their own words, with a link to each. The line itself stays only
// what to buy: a "for …" under every line made the list noisy.
function SharesButton({ item, shares }: { item: ShoppingItem; shares: Share[] }) {
  const help = useHelp();
  return (
    <>
      <HelpButton help={help} label={`Recipes for ${item.text}`} className="icon-button small">
        <BookIcon />
      </HelpButton>
      <HelpBox help={help}>
        {/* Not a list: inside a list row, the rows' own rules would reach it. */}
        <div className="share-list">
          {shares.map((share, index) => (
            <p key={index}>
              <strong>{share.text}</strong>
              {share.recipe ? (
                <Link to={`/recipes/${share.recipe}`}>{share.title || "A recipe"}</Link>
              ) : share.title ? (
                // Its recipe was deleted since (pb_hooks/shopping.pb.js).
                <span className="muted">{share.title} (deleted)</span>
              ) : (
                <span className="muted">Typed in</span>
              )}
            </p>
          ))}
        </div>
      </HelpBox>
    </>
  );
}
