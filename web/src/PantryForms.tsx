// A pantry item's Add and Edit forms, and their fields (name, places, expiry,
// store links, favourite brand, note, photo, barcodes, and the packets in
// stock). The fields' rules are in pantryFields.ts, the packets' in
// pantryPackets.ts.
import { useId, useRef, useState, type FormEvent, type KeyboardEvent, type Ref } from "react";
import { errorMessage, pantryItems, pantryPhotoUrl, type PantryItem, type PantryPacket } from "./pb";
import { useStores } from "./household";
import { productNameFromTitle, productNameFromUrl, storeName, storeSearchUrl, type Store } from "./stores";
import { hasBuiltInBrowser, pickPageLink } from "./bentoBrowser";
import StoreLogo from "./StoreLogo";
import { useUnsavedChanges } from "./unsavedChanges";
import { barcodesOf, normaliseBarcode, withBarcode } from "./barcodes";
import { canScan, scanBarcode, type BarcodeProduct } from "./scanner";
import { brandsOf, cleanStoreLinks, MOST_STORE_LINKS, PHOTO_REMOVED, photoSources, withPickedLink } from "./pantryItem";
import { norm, placeOptions, subcategoryOptions } from "./pantryGroups";
import { fieldsOf, recordFrom, sameName, STORE_LINK_TYPO, type Fields } from "./pantryFields";
import PantryPhotoField, { type PhotoChoice } from "./PantryPhotoField";
import { brandsToPickFrom, packetLabel, tidySize, withDetails, type PacketDetails } from "./pantryPackets";

// A barcode just scanned (or typed): what Open Food Facts says it is, once
// looked up (null if it doesn't know), for ones not in the pantry yet.
// The scanner sometimes misreads a digit (giving a number nothing has), so a
// scan nothing has is only believed once it's scanned the same twice, typed,
// or checked against the packet: `sure`.
export interface Scanned {
  code: string;
  looking: boolean;
  product: BarcodeProduct | null;
  lookupError: string;
  sure: boolean;
}

const NEW_OPTION = "__new__";

// A dropdown of choices, with a last option to type a new one instead.
function CategorySelect({
  label,
  value,
  options,
  emptyLabel,
  newLabel,
  newPlaceholder,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  emptyLabel: string;
  newLabel: string;
  newPlaceholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [typingNew, setTypingNew] = useState(false);

  if (typingNew) {
    return (
      <label>
        {label}
        <span className="new-category">
          <input autoFocus value={value} onChange={(e) => onChange(e.target.value)} placeholder={newPlaceholder} />
          <button
            type="button"
            className="button ghost small"
            onClick={() => {
              setTypingNew(false);
              onChange("");
            }}
          >
            Cancel
          </button>
        </span>
      </label>
    );
  }

  // Match the saved value to its option regardless of capitals.
  const selected = options.find((option) => norm(option) === norm(value)) ?? "";
  return (
    <label>
      {label}
      <select
        value={selected}
        disabled={disabled}
        onChange={(e) => {
          if (e.target.value === NEW_OPTION) {
            setTypingNew(true);
            onChange("");
          } else {
            onChange(e.target.value);
          }
        }}
      >
        <option value="">{emptyLabel}</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
        <option value={NEW_OPTION}>{newLabel}</option>
      </select>
    </label>
  );
}

// Name, place and subcategory. Subcategories only list ones belonging to the
// chosen place, and changing the place clears the subcategory.
function ItemFields({
  existing,
  fields,
  onChange,
  nameRef,
}: {
  existing: PantryItem[];
  fields: Fields;
  onChange: (patch: Partial<Fields>) => void;
  nameRef?: Ref<HTMLInputElement>;
}) {
  const places = placeOptions(existing);
  const subs = subcategoryOptions(existing, fields.location);
  // Keep a value that isn't in the lists yet (one just typed in) selectable.
  const withCurrent = (options: string[], value: string) =>
    value.trim() && !options.some((o) => norm(o) === norm(value)) ? [...options, value.trim()] : options;

  return (
    <>
      <label>
        Name
        <input
          ref={nameRef}
          value={fields.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Eggs"
          required
        />
      </label>
      <label>
        <span className="label-text">
          Note <span className="optional">(optional)</span>
        </span>
        <input
          value={fields.note}
          onChange={(e) => onChange({ note: e.target.value })}
          maxLength={200}
          placeholder="e.g. 3 cans"
        />
      </label>
      <label>
        <span className="label-text">
          Favourite brand <span className="optional">(optional)</span>
        </span>
        <input
          value={fields.brand}
          onChange={(e) => onChange({ brand: e.target.value })}
          maxLength={120}
          placeholder="e.g. White Mill"
        />
      </label>
      {/* Older items listed every brand bought ("Coles, White Mill"): pick
          the one to look for. Only a person picks it. */}
      {brandsToPickFrom(fields.brand).length > 0 && (
        <div className="brand-pick">
          <span className="hint">The one to look for when shopping. Which is it?</span>
          {brandsToPickFrom(fields.brand).map((brand) => (
            <button key={brand} type="button" className="button small" onClick={() => onChange({ brand })}>
              {brand}
            </button>
          ))}
        </div>
      )}
      <div className="row">
        <CategorySelect
          label="Where it lives"
          value={fields.location}
          options={withCurrent(places, fields.location)}
          emptyLabel="Not sorted"
          newLabel="+ New place…"
          newPlaceholder="New place, e.g. Pantry shelf"
          onChange={(location) => onChange({ location, subcategory: "" })}
        />
        <CategorySelect
          // A fresh dropdown for each place, so typing a new subcategory
          // under one place doesn't carry over to another.
          key={norm(fields.location)}
          label="Subcategory"
          value={fields.subcategory}
          options={withCurrent(subs, fields.subcategory)}
          emptyLabel={fields.location.trim() ? "None" : "Pick a place first"}
          newLabel="+ New subcategory…"
          newPlaceholder="New subcategory"
          disabled={!fields.location.trim()}
          onChange={(subcategory) => onChange({ subcategory })}
        />
      </div>
      <CategorySelect
        label="Once opened, keep in"
        value={fields.openedLocation}
        options={withCurrent(places, fields.openedLocation)}
        emptyLabel="The same place"
        newLabel="+ New place…"
        newPlaceholder="New place, e.g. Door shelf"
        onChange={(openedLocation) => onChange({ openedLocation })}
      />
      <label>
        <span className="label-text">
          Expires <span className="optional">(optional)</span>
        </span>
        <span className="date-row">
          <input type="date" value={fields.expires} onChange={(e) => onChange({ expires: e.target.value })} />
          {fields.expires && (
            <button type="button" className="button ghost small" onClick={() => onChange({ expires: "" })}>
              No date
            </button>
          )}
        </span>
      </label>
      <StoreLinkField
        // Store searches include the (first) brand: "Lea & Perrins Worcestershire".
        name={[brandsOf(fields.brand)[0] ?? "", fields.name].map((part) => part.trim()).filter(Boolean).join(" ")}
        value={fields.storeUrls}
        onChange={(storeUrls) => onChange({ storeUrls })}
      />
    </>
  );
}

// "Store links": the item's product pages, like Coles' page for our exact
// Worcestershire sauce, and Woolworths' too (up to 5, one box each). In the
// Android app, "Find on Coles" opens Bento's browser on the store's search;
// open the product and tap "Link this item" (it replaces the item's Coles
// link, if it has one; see withPickedLink). In a web browser, the store
// opens in a new tab to copy the address from.
function StoreLinkField({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string[];
  onChange: (urls: string[]) => void;
}) {
  // Its own for each form: an Add and an Edit form can be open together.
  const labelId = useId();
  const [error, setError] = useState("");
  const stores = useStores();
  const boxes = value.length ? value : [""];
  const several = boxes.length > 1;

  async function find(store: Store) {
    setError("");
    try {
      const picked = await pickPageLink(storeSearchUrl(store, name));
      if (picked) onChange(withPickedLink(boxes, picked.url));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  const remove = (index: number) => {
    const rest = boxes.filter((_, i) => i !== index);
    onChange(rest.length ? rest : [""]);
  };

  return (
    <div className="store-link-field" role="group" aria-labelledby={labelId}>
      <span className="label-text" id={labelId}>
        {several ? "Store links" : "Store link"} <span className="optional">(optional)</span>
      </span>
      <span className="hint">
        {!stores.length
          ? "A shop's page for this product, copied from your browser."
          : hasBuiltInBrowser
            ? "Find it in a store, open the product, then tap Link this item."
            : "Search a store, open the product, then copy its address into here."}
      </span>
      {boxes.map((box, index) => (
        <span className="store-link-box" key={index}>
          {/* Plain text (with the web address keyboard), so "coles.com.au/…"
              without https:// isn't blocked by the browser; it's fixed up on save. */}
          <input
            inputMode="url"
            value={box}
            onChange={(e) => onChange(boxes.map((other, i) => (i === index ? e.target.value : other)))}
            placeholder={stores.length ? `https://www.${stores[index % stores.length].host}/…` : "https://…"}
            aria-label={several ? `Store link ${index + 1}` : "Store link"}
            autoCapitalize="none"
            autoCorrect="off"
          />
          {(box || several) && (
            <button
              type="button"
              className="button ghost small"
              aria-label={several ? `Remove store link ${index + 1}` : "Remove the store link"}
              onClick={() => remove(index)}
            >
              ✕
            </button>
          )}
        </span>
      ))}
      <div className="store-buttons">
        {stores.map((store) =>
          hasBuiltInBrowser ? (
            <button
              key={store.name}
              type="button"
              className="button small"
              disabled={!name.trim()}
              onClick={() => void find(store)}
            >
              Find on <StoreLogo store={store} />
            </button>
          ) : (
            <a
              key={store.name}
              className={`button small ${name.trim() ? "" : "disabled"}`}
              href={name.trim() ? storeSearchUrl(store, name) : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!name.trim()}
            >
              Search <StoreLogo store={store} /> ↗
            </a>
          )
        )}
        {boxes.length < MOST_STORE_LINKS && boxes.every((box) => box.trim()) && (
          <button type="button" className="button ghost small" onClick={() => onChange([...boxes, ""])}>
            + Another store
          </button>
        )}
      </div>
      {error && <p className="error">{error}</p>}
    </div>
  );
}

// The starting name for an item from a store page: the page's product name
// (tidied), else words from its address.
function nameFromStore(picked: { url: string; name: string }): string {
  return productNameFromTitle(picked.name) || productNameFromUrl(picked.url);
}

export function AddPantryItem({
  existing,
  fromStore,
  fromBarcode,
  startName = "",
  onAdded,
  onUseExisting,
  onScanAgain,
  onClose,
}: {
  existing: PantryItem[];
  // A store product page to start from, if any.
  fromStore?: { url: string; name: string } | null;
  // Or a scanned barcode, with what Open Food Facts says it is.
  fromBarcode?: Scanned;
  // Or a name typed in the pantry's find-or-add box.
  startName?: string;
  onAdded: (item: PantryItem) => void;
  // For a scanned barcode named like an item already in the pantry: put the
  // barcode (and brand) on that item instead.
  onUseExisting?: (item: PantryItem, brand: string) => void;
  onScanAgain?: () => void;
  onClose?: () => void;
}) {
  const product = fromBarcode?.product ?? null;
  const [fields, setFields] = useState<Fields>(() => ({
    ...fieldsOf(),
    name: fromStore ? nameFromStore(fromStore) : (product?.name ?? startName),
    storeUrls: [fromStore?.url ?? ""],
    brand: product?.brand ?? "",
  }));
  // The item already in the pantry with the name typed, once Add finds it.
  const [duplicate, setDuplicate] = useState<PantryItem | null>(null);
  // The scanned barcode goes on the first item added (not ones after it).
  const [barcode, setBarcode] = useState(fromBarcode?.code ?? "");
  const [photo, setPhoto] = useState<PhotoChoice>(undefined);
  // Putting a store link into a new item suggests a name from it (the first
  // link), and keeps updating that suggestion (while the link is typed)
  // until someone types their own name. A name typed in the find box is
  // their own already.
  const suggested = useRef(fromStore || product ? fields.name : "");
  const change = (patch: Partial<Fields>) =>
    setFields((previous) => {
      const next = { ...previous, ...patch };
      if (patch.storeUrls !== undefined && (!previous.name.trim() || previous.name === suggested.current)) {
        const first = patch.storeUrls.find((url) => url.trim()) ?? "";
        next.name = productNameFromUrl(cleanStoreLinks([first])?.[0] ?? "");
        suggested.current = next.name;
      }
      return next;
    });
  // Bumped after each add so "new place" boxes turn back into dropdowns
  // (which now include the new name).
  const [resetKey, setResetKey] = useState(0);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);
  // An item half filled in (the place chosen is kept between items, so that
  // alone doesn't count).
  // Changed from how it started: what's filled in for someone (a scan's
  // name, a store page, a name from the find box) isn't their typing, and
  // the place chosen is kept between items, so neither counts.
  const ownTyping = (f: Fields) =>
    JSON.stringify([f.name.trim(), f.brand.trim(), f.note.trim(), f.expires, f.storeUrls.filter((url) => url.trim())]);
  const [started, setStarted] = useState(() => ownTyping(fields));
  useUnsavedChanges(ownTyping(fields) !== started || !!photo);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const same = sameName(existing, fields.name);
    setDuplicate(same ?? null);
    if (same) {
      setError(
        `“${same.name}” is already in the pantry${same.location ? ` (${same.location})` : ""}.` +
          (barcode && onUseExisting
            ? " If this is the same thing (another brand is fine), add it to that one. Or give this one a different name."
            : " Give this one a different name, or change that one."),
      );
      return;
    }
    const record = recordFrom(fields);
    if (!record) {
      setError(STORE_LINK_TYPO);
      return;
    }
    const barcodes = barcode ? [barcode] : [];
    setBusy(true);
    setError("");
    try {
      onAdded(
        await pantryItems().create({
          ...record,
          status: "have",
          barcodes,
          // What the scanned packet is, for the next one scanned.
          ...(barcode &&
            product && {
              barcode_details: withDetails({}, barcode, { brand: product.brand, size: tidySize(product.quantity) }),
            }),
          // Without one, its photo is looked up online afterwards
          // (useOnlinePhotos).
          ...(photo && { photo, photo_link_tried: photoSources({ ...record, barcodes }) }),
        })
      );
      setBarcode("");
      // Keep the places and subcategory chosen, so adding a whole shelf is
      // quick. Each item has its own expiry, store links, brand, note and
      // photo, so those are cleared.
      const cleared = { name: "", expires: "", storeUrls: [""], brand: "", note: "" };
      // From the latest fields: a place picked while it was saving is kept.
      setFields((previous) => ({ ...previous, ...cleared }));
      setStarted(ownTyping({ ...fields, ...cleared }));
      setPhoto(undefined);
      setResetKey((key) => key + 1);
      nameRef.current?.focus();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={submit}>
      {fromStore && fields.storeUrls[0] === fromStore.url && (
        <p className="muted small-note">
          From {storeName(fromStore.url)}. Shorten the name to what recipes call it, like “Worcestershire sauce”, so
          they find it.
        </p>
      )}
      {fromBarcode && barcode && (
        <p className="muted small-note">
          {product ? (
            <>
              Scanned: “{product.name}
              {product.quantity && `, ${product.quantity}`}” (from Open Food Facts). Shorten the name to what recipes call
              it, like “Basmati rice”, so they find it.
              {onScanAgain && (
                <>
                  {" "}
                  Not what you scanned?{" "}
                  <button type="button" className="link-button" onClick={onScanAgain}>
                    Scan again
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              {fromBarcode.lookupError || "Open Food Facts doesn't know this barcode."} Type what it is, and Bentotachi will
              know it next time.
            </>
          )}
        </p>
      )}
      <ItemFields key={resetKey} existing={existing} fields={fields} nameRef={nameRef} onChange={change} />
      <PantryPhotoField
        savedUrl=""
        barcodes={[]}
        storeUrls={[]}
        choice={photo}
        onChoose={setPhoto}
        hint={
          (barcode || fields.storeUrls.some((url) => url.trim())) && !photo
            ? "Leave it empty and Bentotachi looks for its photo online by itself."
            : undefined
        }
      />
      {error && <p className="error">{error}</p>}
      {error && duplicate && barcode && onUseExisting && (
        <div className="actions">
          <button type="button" className="button small" onClick={() => onUseExisting(duplicate, fields.brand)}>
            Add to {duplicate.name}
          </button>
        </div>
      )}
      <div className="actions">
        {onClose && (
          <button type="button" className="button ghost" onClick={onClose}>
            Done
          </button>
        )}
        <button className="button primary" disabled={busy || !fields.name.trim()}>
          {busy ? "Adding…" : "Add to pantry"}
        </button>
      </div>
    </form>
  );
}

// Packets in stock, in an item's edit form. They change straight away (each
// is its own record), not on Save: Add puts one in, ✕ finishes one.
function PacketsField({
  packets,
  favourite,
  onAdd,
  onFinish,
}: {
  packets: PantryPacket[];
  favourite: string;
  // Whether it was added.
  onAdd: (details: PacketDetails) => Promise<boolean>;
  onFinish: (packet: PantryPacket) => void;
}) {
  const labelId = useId();
  const [adding, setAdding] = useState(false);
  const [details, setDetails] = useState<PacketDetails>({ brand: "", size: "" });
  const [busy, setBusy] = useState(false);

  async function add() {
    // Enter pressed again while it saves (the button is disabled, Enter isn't).
    if (busy) return;
    setBusy(true);
    // Not added (the page says why): its boxes stay, to try again.
    if (await onAdd(details)) setAdding(false);
    setBusy(false);
  }

  // Enter in its boxes adds the packet, rather than saving the whole form.
  const enterAdds = (event: KeyboardEvent) => {
    if (event.key !== "Enter") return;
    event.preventDefault();
    void add();
  };

  return (
    <div className="packets-field" role="group" aria-labelledby={labelId}>
      <span className="label-text" id={labelId}>
        Packets in stock <span className="optional">(optional)</span>
      </span>
      {packets.length > 0 && (
        <span className="pantry-packets-chips">
          {packets.map((packet) => (
            <button
              key={packet.id}
              type="button"
              className="packet-chip"
              onClick={() => onFinish(packet)}
              aria-label={`${packetLabel(packet)}: tap when it's finished`}
            >
              {packetLabel(packet)}
              <span className="packet-chip-x" aria-hidden="true">
                ✕
              </span>
            </button>
          ))}
        </span>
      )}
      {adding ? (
        <span className="packet-add">
          <input
            autoFocus
            value={details.brand}
            onChange={(e) => setDetails({ ...details, brand: e.target.value })}
            onKeyDown={enterAdds}
            maxLength={120}
            placeholder={favourite || "Brand"}
            aria-label="The packet's brand"
          />
          <input
            value={details.size}
            onChange={(e) => setDetails({ ...details, size: e.target.value })}
            onKeyDown={enterAdds}
            maxLength={60}
            placeholder="Size, e.g. 1 kg"
            aria-label="The packet's size"
          />
          <button type="button" className="button small" disabled={busy} onClick={() => void add()}>
            Add
          </button>
          <button type="button" className="button ghost small" onClick={() => setAdding(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <span>
          <button
            type="button"
            className="button ghost small"
            onClick={() => {
              setDetails({ brand: favourite, size: "" });
              setAdding(true);
            }}
          >
            + Add a packet
          </button>
        </span>
      )}
      <span className="hint">
        {packets.length ? "Tap one when it's finished. These change straight away." : "Only if you'd like to count them."}
      </span>
    </div>
  );
}

export function EditPantryItem({
  item,
  existing,
  packets,
  onAddPacket,
  onFinishPacket,
  onSaved,
  onCancel,
  onDelete,
}: {
  item: PantryItem;
  existing: PantryItem[];
  // Its packets in stock; null when the server has none (one from before
  // packets), so they aren't offered.
  packets?: PantryPacket[] | null;
  onAddPacket?: (details: PacketDetails) => Promise<boolean>;
  onFinishPacket?: (packet: PantryPacket) => void;
  onSaved: (item: PantryItem) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const [fields, setFields] = useState<Fields>(() => fieldsOf(item));
  const [barcodes, setBarcodes] = useState(() => barcodesOf(item));
  const [photo, setPhoto] = useState<PhotoChoice>(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [opened] = useState(() => JSON.stringify([fields, barcodes]));
  useUnsavedChanges(JSON.stringify([fields, barcodes]) !== opened || photo !== undefined);

  async function scanAnother() {
    setError("");
    try {
      const code = normaliseBarcode((await scanBarcode()) ?? "");
      if (!code) return;
      const other = existing.find((i) => i.id !== item.id && barcodesOf(i).includes(code));
      if (other) setError(`That barcode is already on “${other.name}”.`);
      else setBarcodes(withBarcode({ barcodes }, code));
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const duplicate = sameName(existing, fields.name, item.id);
    if (duplicate) {
      setError(`“${duplicate.name}” is already in the pantry. Give this one a different name.`);
      return;
    }
    const record = recordFrom(fields);
    if (!record) {
      setError(STORE_LINK_TYPO);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const saved = await pantryItems().update(item.id, {
        ...record,
        barcodes,
        // Nowhere else to keep it once opened: it's just in its place.
        opened: record.opened_location ? !!item.opened : false,
        // A photo chosen here: these barcodes and links count as tried. No
        // photo: never looked up by itself again, so a removed photo stays
        // removed (wantsOnlinePhoto).
        ...(photo !== undefined && {
          photo,
          photo_link_tried: photo === null ? PHOTO_REMOVED : photoSources({ ...record, barcodes }),
        }),
      });
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="pantry-edit stack" onSubmit={submit}>
      <ItemFields
        existing={existing}
        fields={fields}
        onChange={(patch) => setFields((previous) => ({ ...previous, ...patch }))}
      />
      <PantryPhotoField
        savedUrl={pantryPhotoUrl(item)}
        barcodes={barcodes}
        storeUrls={cleanStoreLinks(fields.storeUrls) ?? []}
        choice={photo}
        onChoose={setPhoto}
      />
      {(barcodes.length > 0 || canScan) && (
        <div className="barcode-list">
          <span className="label-text">Barcodes</span>
          {barcodes.map((code) => (
            <span key={code} className="barcode-chip">
              {code}
              <button
                type="button"
                className="chip-remove"
                aria-label={`Remove barcode ${code}`}
                onClick={() => setBarcodes(barcodes.filter((other) => other !== code))}
              >
                ✕
              </button>
            </span>
          ))}
          {canScan && (
            <button type="button" className="button small" onClick={() => void scanAnother()}>
              <span className="button-mark" aria-hidden="true">📷</span> Add one
            </button>
          )}
        </div>
      )}
      {packets && onAddPacket && onFinishPacket && (
        <PacketsField
          packets={packets}
          favourite={brandsToPickFrom(item.brand).length ? "" : item.brand.trim()}
          onAdd={onAddPacket}
          onFinish={onFinishPacket}
        />
      )}
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="button" className="button danger small push-left" onClick={onDelete}>
          Remove
        </button>
        <button type="button" className="button ghost small" onClick={onCancel}>
          Cancel
        </button>
        <button className="button primary small" disabled={busy || !fields.name.trim()}>
          Save
        </button>
      </div>
    </form>
  );
}
