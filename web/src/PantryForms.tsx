// A pantry item's Add and Edit forms, and their fields (name, places, expiry,
// store links, favourite brand, note, photo, the products we buy and what's
// in stock). The fields' rules are in pantryFields.ts, the packets' in
// pantryPackets.ts, the products' in pantryProducts.ts.
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode, type Ref } from "react";
import { errorMessage, pantryItems, pantryPackets, pantryPhotoUrl, type PantryItem, type PantryPacket } from "./pb";
import { useSpell } from "./household";
import { productNameFromTitle, productNameFromUrl, storeName } from "./stores";
import { CameraIcon, CloseIcon } from "./icons";
import { usePreviewUrl } from "./pantryPhoto";
import { useUnsavedChanges } from "./unsavedChanges";
import { barcodesOf } from "./barcodes";
import type { BarcodeProduct } from "./scanner";
import { brandsOf, cleanStoreLinks, PHOTO_REMOVED, photoSources } from "./pantryItem";
import { norm, placeOptions, subcategoryOptions, uniqueLabels } from "./pantryGroups";
import { HelpBox, HelpButton, useHelp } from "./Help";
import { editChanges, fieldsOf, recordFrom, sameName, STORE_LINK_TYPO, type Fields } from "./pantryFields";
import PantryPhotoField, { type PhotoChoice } from "./PantryPhotoField";
import { brandsToPickFrom, packetToSave, preferredChanges, tidySize, withDetails, type PacketDetails } from "./pantryPackets";
import { showError } from "./toast";
import StockLabels from "./StockLabels";
import DateField from "./DateField";
import StoreLinkField from "./StoreLinkField";
import ProductsField from "./ProductsField";
import {
  cleanProducts,
  otherProducts,
  preferredProduct,
  productName,
  productsOf,
  productSources,
  sameKind,
  usualOf,
  withServerAdditions,
} from "./pantryProducts";

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
  // Added to its item by itself (a known barcode on a counted item), or
  // being added (so it isn't offered to add by hand meanwhile).
  added?: boolean;
  adding?: boolean;
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
  help,
}: {
  label: string;
  value: string;
  options: string[];
  emptyLabel: string;
  newLabel: string;
  newPlaceholder: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  // A "?" beside the label, opening its tip below the field.
  help?: { button: ReactNode; box: ReactNode };
}) {
  const [typingNew, setTypingNew] = useState(false);
  const selectId = useId();

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
  const select = (
    <select
      id={help ? selectId : undefined}
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
  );
  // With a "?", the label and the button sit side by side, so the label is
  // tied to the dropdown by id rather than by wrapping it.
  if (help) {
    return (
      <div className="field-with-help">
        <span>
          <label htmlFor={selectId} className="label-text">
            {label}
          </label>
          {help.button}
        </span>
        {help.box}
        {select}
      </div>
    );
  }
  return (
    <label>
      {label}
      {select}
    </label>
  );
}

// Name, place and subcategory, then the rest. Subcategories only list ones
// belonging to the chosen place, and changing the place clears the
// subcategory. `brief`: only the name and the place, the rest waiting behind
// "More details" (docs/VISION.md: things are introduced when they're needed).
function ItemFields({
  existing,
  fields,
  onChange,
  nameRef,
  brief = false,
  photo,
  photoChoices,
}: {
  existing: PantryItem[];
  fields: Fields;
  onChange: (patch: Partial<Fields>) => void;
  nameRef?: Ref<HTMLInputElement>;
  brief?: boolean;
  // The photo square to the left of the name (PhotoButton), and its
  // choices under that row once it's tapped.
  photo: ReactNode;
  photoChoices: ReactNode;
}) {
  return (
    <>
      <NameRow photo={photo}>
        <input
          ref={nameRef}
          value={fields.name}
          onChange={(e) => onChange({ name: e.target.value })}
          placeholder="Eggs"
          required
        />
      </NameRow>
      {photoChoices}
      <PlaceFields existing={existing} fields={fields} onChange={onChange} brief={brief} />
      {!brief && <MoreItemFields existing={existing} fields={fields} onChange={onChange} />}
    </>
  );
}

// The photo square, then "Name" and its box, on one row (both forms).
function NameRow({ photo, children }: { photo: ReactNode; children: ReactNode }) {
  return (
    <div className="pantry-who">
      {photo}
      <label className="pantry-who-name">
        Name
        {children}
      </label>
    </div>
  );
}

// An item's photo as a square button beside its name (both forms): tapping
// it shows the ways to change it, which the form puts under the row. No
// photo: the name's first letter, or a camera before there's a name.
function PhotoButton({ shown, name, open, onToggle }: { shown: string; name: string; open: boolean; onToggle: () => void }) {
  const letter = name.trim().charAt(0).toUpperCase();
  return (
    <button
      type="button"
      className="pantry-who-photo"
      onClick={onToggle}
      aria-expanded={open}
      aria-label={shown ? "Change its photo" : "Add a photo"}
      title={shown ? "Change its photo" : "Add a photo"}
    >
      {shown ? (
        <img src={shown} alt="" />
      ) : (
        <span className="pantry-tile" aria-hidden="true">
          {letter || <CameraIcon size={24} />}
        </span>
      )}
      {(shown || letter) && (
        <span className="avatar-corner" aria-hidden="true">
          <CameraIcon size={13} />
        </span>
      )}
    </button>
  );
}

// Where it lives and its subcategory, side by side.
function PlaceFields({
  existing,
  fields,
  onChange,
  brief = false,
}: {
  existing: PantryItem[];
  fields: Fields;
  onChange: (patch: Partial<Fields>) => void;
  brief?: boolean;
}) {
  const places = placeOptions(existing);
  const subs = subcategoryOptions(existing, fields.location);
  const placeHelp = useHelp();
  return (
    <div className="row">
      <CategorySelect
        label="Where it lives"
        value={fields.location}
        options={withCurrent(places, fields.location)}
        emptyLabel="Not sorted"
        newLabel="+ New place…"
        newPlaceholder="New place, e.g. Pantry shelf"
        onChange={(location) => onChange({ location, subcategory: "" })}
        help={{
          button: <HelpButton help={placeHelp} label="How places work" />,
          box: (
            <HelpBox help={placeHelp}>
              <p>
                Group things by where they live, like “Fridge” or “Cupboard”, with optional subcategories like
                “Baking” or “Spices”.
              </p>
            </HelpBox>
          ),
        }}
      />
      {/* Brief: the subcategory once there's a place to put it under. */}
      {(!brief || fields.location.trim()) && (
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
      )}
    </div>
  );
}

// Keep a value that isn't in the lists yet (one just typed in) selectable.
const withCurrent = (options: string[], value: string) =>
  value.trim() && !options.some((o) => norm(o) === norm(value)) ? [...options, value.trim()] : options;

// The rest of an item's fields, in the add form's order: its group ("A kind
// of"), note, favourite brand, expiry and store links. The edit form sorts the same pieces into trays (EditPantryItem).
type FieldProps = { existing: PantryItem[]; fields: Fields; onChange: (patch: Partial<Fields>) => void };

function MoreItemFields(props: FieldProps) {
  return (
    <>
      <KindOfField {...props} />
      <NoteField {...props} />
      <BrandField {...props} />
      <ExpiresField {...props} />
      <StoreLinkFor {...props} />
    </>
  );
}

function KindOfField({ existing, fields, onChange }: FieldProps) {
  // The groups already used, to pick from ("Pasta").
  const kinds = uniqueLabels(existing.map((item) => item.kind_of ?? ""));
  const kindHelp = useHelp();
  const kindId = useId();
  return (
    <div className="kind-of-field">
      <span>
        <label htmlFor={kindId} className="label-text">
          A kind of <span className="optional">(optional)</span>
        </label>
        <HelpButton help={kindHelp} label="What a kind of is for" />
      </span>
      <HelpBox help={kindHelp}>
        <p>
          Like Pasta for Linguine, Penne and Spaghetti. Kinds of the same thing sit together in the pantry. A recipe
          asking for linguine only counts Linguine; one that just says pasta can use any of them.
        </p>
      </HelpBox>
      <input
        id={kindId}
        value={fields.kindOf}
        onChange={(e) => onChange({ kindOf: e.target.value })}
        maxLength={60}
        placeholder="e.g. Pasta"
        list={`${kindId}-list`}
      />
      <datalist id={`${kindId}-list`}>
        {kinds.map((kind) => (
          <option key={kind} value={kind} />
        ))}
      </datalist>
    </div>
  );
}

function NoteField({ fields, onChange }: FieldProps) {
  return (
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
  );
}

function BrandField({ fields, onChange }: FieldProps) {
  const spell = useSpell();
  return (
    <>
      <label>
        <span className="label-text">
          {spell("Favourite brand")} <span className="optional">(optional)</span>
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
    </>
  );
}


function ExpiresField({ fields, onChange }: FieldProps) {
  return (
    <label>
      <span className="label-text">
        Expires <span className="optional">(optional)</span>
      </span>
      {/* The calendar's Clear takes the date off. */}
      <DateField label="Expires" value={fields.expires} onChange={(expires) => onChange({ expires })} />
    </label>
  );
}

function StoreLinkFor({ fields, onChange }: FieldProps) {
  return (
    <StoreLinkField
      // Store searches include the (first) brand: "Lea & Perrins Worcestershire".
      name={[brandsOf(fields.brand)[0] ?? "", fields.name].map((part) => part.trim()).filter(Boolean).join(" ")}
      value={fields.storeUrls}
      onChange={(storeUrls) => onChange({ storeUrls })}
    />
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
  startPlace = "",
  onAdded,
  onUseExisting,
  onScanAgain,
  onScan,
  onClose,
  onStartedTyping,
}: {
  existing: PantryItem[];
  // A store product page to start from, if any.
  fromStore?: { url: string; name: string } | null;
  // Or a scanned barcode, with what Open Food Facts says it is.
  fromBarcode?: Scanned;
  // Or a name typed in the pantry's find-or-add box.
  startName?: string;
  // The place it goes, when the pantry shows just one.
  startPlace?: string;
  onAdded: (item: PantryItem) => void;
  // For a scanned barcode named like an item already in the pantry: put the
  // barcode (and brand) on that item instead.
  onUseExisting?: (item: PantryItem, brand: string) => void;
  onScanAgain?: () => void;
  // Scan a packet instead of typing: for an empty pantry, whose find box
  // (with its 📷) isn't shown yet (a tester couldn't find the scanner).
  onScan?: () => void;
  onClose?: () => void;
  // Someone has started filling it in, so it should stay on screen.
  onStartedTyping?: () => void;
}) {
  const product = fromBarcode?.product ?? null;
  const [fields, setFields] = useState<Fields>(() => ({
    ...fieldsOf(),
    name: fromStore ? nameFromStore(fromStore) : (product?.name ?? startName),
    storeUrls: [fromStore?.url ?? ""],
    brand: product?.brand ?? "",
    location: startPlace,
  }));
  // The item already in the pantry with the name typed, once Add finds it.
  const [duplicate, setDuplicate] = useState<PantryItem | null>(null);
  // The scanned barcode goes on the first item added (not ones after it).
  const [barcode, setBarcode] = useState(fromBarcode?.code ?? "");
  const [photo, setPhoto] = useState<PhotoChoice>(undefined);
  // The photo's choices, under the name row once its square is tapped.
  const [photoOpen, setPhotoOpen] = useState(false);
  const photoPreview = usePreviewUrl(photo);
  // The rest of the fields (brand, note, expiry, store links…) wait
  // behind "More details", unless a scan or a store page filled some in.
  const [more, setMore] = useState(!!fromStore || !!fromBarcode);
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
  const typing = ownTyping(fields) !== started || !!photo;
  useUnsavedChanges(typing);
  useEffect(() => {
    if (typing) onStartedTyping?.();
  }, [typing, onStartedTyping]);

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
    // What the scanned one is ("Masterfoods", "560 g"), from Open Food Facts.
    const scannedDetails = barcode && product ? { brand: product.brand, size: tidySize(product.quantity) } : null;
    try {
      const added = await pantryItems().create({
        ...record,
        status: "have",
        barcodes,
        // Remembered for the next one scanned.
        ...(scannedDetails && { barcode_details: withDetails({}, barcode, scannedDetails) }),
        // Without one, its photo is looked up online afterwards
        // (useOnlinePhotos).
        ...(photo && { photo, photo_link_tried: photoSources({ ...record, barcodes }) }),
      });
      onAdded(added);
      // The one in hand is in stock too, so the new item's row says what it
      // is ("Masterfoods 560 g") straight away, as "+ Add this one" does for
      // an item already here.
      if (scannedDetails && (scannedDetails.brand || scannedDetails.size)) {
        try {
          await pantryPackets().create(packetToSave({ item: added.id, ...scannedDetails, barcode, left: "" }));
        } catch (err) {
          // The item is saved either way; a server from before counting
          // (no such collection) just doesn't count it.
          if ((err as { status?: number }).status !== 404) showError(`Added, but not counted in stock: ${errorMessage(err)}`);
        }
      }
      setBarcode("");
      // Keep the places and subcategory chosen, so adding a whole shelf is
      // quick. Each item has its own expiry, store links, brand, note and
      // photo, so those are cleared.
      const cleared = { name: "", expires: "", storeUrls: [""], brand: "", note: "" };
      // From the latest fields: a place picked while it was saving is kept.
      setFields((previous) => ({ ...previous, ...cleared }));
      setStarted(ownTyping({ ...fields, ...cleared }));
      setPhoto(undefined);
      setPhotoOpen(false);
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
      <ItemFields
        key={resetKey}
        existing={existing}
        fields={fields}
        nameRef={nameRef}
        onChange={change}
        brief={!more}
        photo={<PhotoButton shown={photo ? photoPreview : ""} name={fields.name} open={photoOpen} onToggle={() => setPhotoOpen(!photoOpen)} />}
        photoChoices={
          photoOpen && (
            <PantryPhotoField
              bare
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
          )
        }
      />
      {/* Opens the rest, and closes them again (what's typed in them is
          kept, and saved). */}
      <button type="button" className="link-button more-details" aria-expanded={more} onClick={() => setMore(!more)}>
        {more ? "− Fewer details" : "+ More details (brand, note, expiry, store links)"}
      </button>
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
        {onScan && (
          <button type="button" className="button" onClick={onScan}>
            <span className="button-mark" aria-hidden="true">📷</span> Scan a barcode
          </button>
        )}
        <button className="button primary" disabled={busy || !fields.name.trim()}>
          {busy ? "Adding…" : "Add to pantry"}
        </button>
      </div>
    </form>
  );
}

// What's in stock, in an item's edit form. It changes straight away (each
// one is its own record), not on Save: labels (StockLabels.tsx) for the ones
// there, "+ Add one" for another, with its brand, size and use-by.
function PacketsField({
  item,
  packets,
  favouriteBrand,
  onAdd,
  onFinish,
  onSave,
  inTray = false,
}: {
  // Its products, for adding one with a tap.
  item: Pick<PantryItem, "products" | "usual_packet">;
  packets: PantryPacket[];
  favouriteBrand: string;
  // Whether it was added.
  onAdd: (details: PacketDetails) => Promise<boolean>;
  onFinish: (packet: PantryPacket) => void;
  onSave: (packet: PantryPacket, changes: Partial<PantryPacket>) => Promise<boolean>;
  // In the edit form's "In stock" tray, whose rim names it already.
  inTray?: boolean;
}) {
  const labelId = useId();
  const spell = useSpell();
  const [adding, setAdding] = useState(false);
  const preferredOne = preferredProduct(item);
  const picks = [...(preferredOne ? [preferredOne] : []), ...otherProducts(item)];
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
    <div className="packets-field" role="group" aria-labelledby={inTray ? undefined : labelId} aria-label={inTray ? "In stock" : undefined}>
      {!inTray && (
        <span className="label-text" id={labelId}>
          How many in stock <span className="optional">(optional)</span>
        </span>
      )}
      {packets.length > 0 && (
        <StockLabels packets={packets} onUsed={onFinish} onSave={onSave} />
      )}
      {adding ? (
        // Laid out like a label opened up (StockLabels.tsx).
        <div className="stock-label-editor packet-add" role="group" aria-label="Add one">
          <label>
            Brand
            <input
              autoFocus
              value={details.brand}
              onChange={(e) => setDetails({ ...details, brand: e.target.value })}
              onKeyDown={enterAdds}
              maxLength={120}
              placeholder={favouriteBrand}
            />
          </label>
          <label>
            Size
            <input
              value={details.size}
              onChange={(e) => setDetails({ ...details, size: e.target.value })}
              onKeyDown={enterAdds}
              maxLength={60}
              placeholder="like 1 kg"
            />
          </label>
          <label>
            Use by
            <DateField label="Use by" value={details.expires ?? ""} onChange={(expires) => setDetails({ ...details, expires })} />
          </label>
          <div className="stock-label-actions">
            <button type="button" className="button ghost small" onClick={() => setAdding(false)}>
              Cancel
            </button>
            <button type="button" className="button primary small" disabled={busy} onClick={() => void add()}>
              Add
            </button>
          </div>
        </div>
      ) : (
        // One of its products with a tap (the favourite first, ★), or
        // "+ New…" for another brand or size, with a use-by if wanted.
        <div className="stock-add">
          {picks.length > 0 && <p className="pantry-card-head">Add one</p>}
          <div className="pantry-card-products">
            {picks.map((product) => (
              <button
                key={`${product.brand}|${product.size}`}
                type="button"
                className={product === preferredOne ? "button primary small" : "button small"}
                onClick={() => void onAdd({ brand: product.brand, size: product.size })}
              >
                +{" "}
                {product === preferredOne && (
                  <span title={spell("Favourite")}>★ </span>
                )}
                {productName(product)}
              </button>
            ))}
            <button
              type="button"
              className="button small ghost pantry-card-new"
              onClick={() => {
                setDetails({ brand: favouriteBrand, size: "" });
                setAdding(true);
              }}
            >
              {picks.length ? "+ New…" : "+ Add one"}
            </button>
          </div>
        </div>
      )}
      {/* In the tray, the − and + speak for themselves. */}
      {!inTray && (
        <span className="hint">
          {packets.length ? "Tap one for its use-by date or to mark it opened; − when it's used up. These change straight away." : "Only if you'd like to count them."}
        </span>
      )}
    </div>
  );
}

export function EditPantryItem({
  item,
  existing,
  packets,
  onAddPacket,
  onFinishPacket,
  onSavePacket,
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
  onSavePacket?: (packet: PantryPacket, changes: Partial<PantryPacket>) => Promise<boolean>;
  onSaved: (item: PantryItem) => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  // The item as the form opened: saving sends only what differs from it.
  const [start] = useState(item);
  const [fields, setFields] = useState<Fields>(() => fieldsOf(item));
  const [products, setProducts] = useState(() => productsOf(item));
  const [preferred, setPreferred] = useState(() => usualOf(item));
  const [photo, setPhoto] = useState<PhotoChoice>(undefined);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [opened] = useState(() => JSON.stringify([fields, products, preferred]));
  useUnsavedChanges(JSON.stringify([fields, products, preferred]) !== opened || photo !== undefined);
  const change = (patch: Partial<Fields>) => setFields((previous) => ({ ...previous, ...patch }));
  const [photoOpen, setPhotoOpen] = useState(false);
  // "More details" starts open when one of them is set, so nothing set is
  // hidden.
  const [more, setMore] = useState(() => !!(item.kind_of?.trim() || item.note?.trim()));
  const preview = usePreviewUrl(photo);
  const shownPhoto = photo === null ? "" : photo ? preview : pantryPhotoUrl(item);
  // Where its photo can be looked up: its products' barcodes and links.
  const sources = productSources(products, preferred);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const duplicate = sameName(existing, fields.name, item.id);
    if (duplicate) {
      setError(`“${duplicate.name}” is already in the pantry. Give this one a different name.`);
      return;
    }
    const record = recordFrom(fields);
    const cleaned = cleanProducts(products);
    if (!record || !cleaned) {
      setError(STORE_LINK_TYPO);
      return;
    }
    const startUsual = usualOf(start);
    const newFavourite = !!preferred && !(startUsual && sameKind(preferred, startUsual));
    // Its ★ product removed: no favourite, nor the favourite brand that
    // came with it.
    const noFavourite = !preferred && !!startUsual;
    const productsChanged = JSON.stringify(cleaned) !== JSON.stringify(productsOf(start));
    const sending = productsChanged ? withServerAdditions(cleaned, productsOf(start), productsOf(item)) : productsOf(item);
    const saving = productSources(sending, preferred);
    const changes = editChanges(start, record, barcodesOf(start));
    // With labels (the first may have been added in this form) Expires is
    // hidden: each label has its own date, and a date for the item would go
    // onto the oldest (server/pb_hooks/pantry.pb.js).
    if (packets?.length) delete changes.expires;
    setBusy(true);
    setError("");
    try {
      const saved = await pantryItems().update(item.id, {
        // Barcodes and store links follow the products, on the server.
        ...changes,
        ...(productsChanged && { products: sending }),
        ...(newFavourite && preferred && preferredChanges(start, preferred)),
        ...(noFavourite && { usual_packet: null, ...(norm(start.brand) === norm(startUsual?.brand ?? "") && { brand: "" }) }),
        // A photo chosen here: these barcodes and links count as tried. No
        // photo: never looked up by itself again, so a removed photo stays
        // removed (wantsOnlinePhoto).
        ...(photo !== undefined && {
          photo,
          photo_link_tried:
            photo === null
              ? PHOTO_REMOVED
              : photoSources({ barcodes: saving.barcodes, store_url: saving.links[0] ?? "", more_store_urls: saving.links.slice(1) }),
        }),
      });
      onSaved(saved);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  // Opened by tapping the item, so easy to open by accident: its name with
  // a ✕ right where the tap was closes it again (like Cancel), Escape too,
  // and Remove / Cancel / Save stay in reach at the bottom of the screen
  // while scrolling through the form.
  return (
    <form
      className="pantry-edit stack"
      onSubmit={submit}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <div className="pantry-edit-head">
        <h3>{item.name}</h3>
        <button type="button" className="icon-button" onClick={onCancel} aria-label="Close without saving" title="Close without saving">
          <CloseIcon />
        </button>
      </div>
      {/* Its photo beside its name; tapping the photo offers the ways to
          change it (docs/VISION.md, "Pantry item edit form"). */}
      <NameRow
        photo={<PhotoButton shown={shownPhoto} name={fields.name || item.name} open={photoOpen} onToggle={() => setPhotoOpen(!photoOpen)} />}
      >
        <input value={fields.name} onChange={(e) => change({ name: e.target.value })} placeholder="Eggs" required />
      </NameRow>
      {photoOpen && (
        <PantryPhotoField
          bare
          savedUrl={pantryPhotoUrl(item)}
          barcodes={sources.barcodes}
          storeUrls={cleanStoreLinks(sources.links) ?? []}
          choice={photo}
          onChoose={setPhoto}
        />
      )}
      <section className="stack tray-section">
        <h2>Storage</h2>
        <div className="tray-body">
          <PlaceFields existing={existing} fields={fields} onChange={change} />
          {/* With labels, each has its own (In stock below). */}
          {!packets?.length && <ExpiresField existing={existing} fields={fields} onChange={change} />}
        </div>
      </section>
      <section className="stack tray-section">
        <h2>Products we buy</h2>
        <div className="tray-body">
          <ProductsField item={item} existing={existing} products={products} preferred={preferred} onChange={setProducts} onPrefer={setPreferred} />
        </div>
      </section>
      {packets && onAddPacket && onFinishPacket && onSavePacket && (
        <section className="stack tray-section">
          <h2>In stock</h2>
          <div className="tray-body">
            <PacketsField
              inTray
              item={item}
              packets={packets}
              favouriteBrand={brandsToPickFrom(item.brand).length ? "" : item.brand.trim()}
              onAdd={onAddPacket}
              onFinish={onFinishPacket}
              onSave={onSavePacket}
            />
          </div>
        </section>
      )}
      {/* The rarely needed ones, out of the way unless one is set. */}
      <button type="button" className="link-button pantry-edit-more" aria-expanded={more} onClick={() => setMore(!more)}>
        {more ? "− Fewer details" : "+ More details"}
      </button>
      {more && (
        <div className="stack">
          <KindOfField existing={existing} fields={fields} onChange={change} />
          <NoteField existing={existing} fields={fields} onChange={change} />
        </div>
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
