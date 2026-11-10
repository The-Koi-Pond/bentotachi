// "Products we buy", in a pantry item's edit form (docs/VISION.md,
// "Products we buy"): each brand and size with its barcodes and store
// links, the ★ on the favourite ("+ 1 more" and the shopping list add it).
// Changes are saved with the form; the logic is in pantryProducts.ts.
import { useState, type FormEvent, type KeyboardEvent } from "react";
import { errorMessage, type PantryItem, type PantryProduct } from "./pb";
import { productName, productNote, replaceProduct, sameKind, withProduct } from "./pantryProducts";
import { tidySize, type PacketDetails } from "./pantryPackets";
import { barcodesOf, normaliseBarcode } from "./barcodes";
import { canScan, lookUpBarcode, scanBarcode } from "./scanner";
import { storeName } from "./stores";
import { normaliseSiteUrl } from "./recipeSites";
import { useSpell } from "./household";
import { StarIcon } from "./icons";
import StoreLinkField from "./StoreLinkField";

export default function ProductsField({
  item,
  existing,
  products,
  preferred,
  onChange,
  onPrefer,
}: {
  item: PantryItem;
  existing: PantryItem[];
  products: PantryProduct[];
  preferred: PacketDetails | null;
  onChange: (products: PantryProduct[]) => void;
  // null: no favourite (it was removed).
  onPrefer: (details: PacketDetails | null) => void;
}) {
  const spell = useSpell();
  // The product open for changing (its place in the list).
  const [openAt, setOpenAt] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  // A product's brand or size changed while it's the favourite: still the
  // favourite. The favourite removed: none until someone stars another (or
  // the next one counted becomes it), so "+ 1 more" doesn't add it again.
  function change(index: number, product: PantryProduct | null) {
    const before = products[index];
    if (preferred && sameKind(before, preferred)) onPrefer(product ? { brand: product.brand, size: product.size } : null);
    onChange(replaceProduct(products, index, product));
    if (!product) setOpenAt(null);
  }

  function add(details: PacketDetails & { barcode?: string }) {
    const next = withProduct(products, details);
    onChange(next);
    setAdding(false);
    // Open, so one known only by its barcode can be named straight away.
    setOpenAt(next.findIndex((p) => sameKind(p, details)));
  }

  async function scan() {
    setError("");
    try {
      const code = normaliseBarcode((await scanBarcode()) ?? "");
      if (!code) return;
      const other = existing.find((i) => i.id !== item.id && barcodesOf(i).includes(code));
      if (other) {
        setError(`That barcode is already on “${other.name}”.`);
        return;
      }
      // What it is, if Open Food Facts knows; unnamed otherwise.
      const found = await lookUpBarcode(code).catch(() => null);
      add({ brand: (found?.brand ?? "").trim().slice(0, 120), size: tidySize(found?.quantity ?? ""), barcode: code });
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  return (
    <div className="products-field">
      {products.length > 0 && (
        <ul className="products-list">
          {products.map((product, index) => {
            const isPreferred = !!preferred && sameKind(product, preferred);
            const open = openAt === index;
            const name = productName(product);
            return (
              <li key={index} className="product">
                <div className="product-row">
                  <button
                    type="button"
                    className={isPreferred ? "product-star on" : "product-star"}
                    aria-pressed={isPreferred}
                    aria-label={isPreferred ? spell(`${name}, the favourite`) : spell(`Make ${name} the favourite`)}
                    title={isPreferred ? spell("Favourite") : spell("Make favourite")}
                    disabled={!(product.brand.trim() || product.size.trim())}
                    onClick={() => onPrefer({ brand: product.brand, size: product.size })}
                  >
                    <StarIcon filled={isPreferred} />
                  </button>
                  <button type="button" className="product-what" aria-expanded={open} onClick={() => setOpenAt(open ? null : index)}>
                    <strong>{name}</strong>
                    {/* While typing, "coles.com.au/…" is recognised too. */}
                    <span>{productNote(product, (link) => storeName(normaliseSiteUrl(link) ?? link))}</span>
                  </button>
                </div>
                {open && (
                  <ProductEditor
                    product={product}
                    itemName={item.name}
                    onChange={(changed) => change(index, changed)}
                    onRemove={() => change(index, null)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
      {adding ? (
        <NewProduct onAdd={add} onCancel={() => setAdding(false)} />
      ) : (
        <div className="products-add">
          <button type="button" className="button ghost small" onClick={() => setAdding(true)}>
            + Add a product
          </button>
          {canScan && (
            <button type="button" className="button ghost small" onClick={() => void scan()}>
              <span className="button-mark" aria-hidden="true">📷</span> Scan one
            </button>
          )}
        </div>
      )}
      {error && <p className="error">{error}</p>}
    </div>
  );
}

// One product opened up: brand and size, its barcodes (taken off with ✕;
// new ones come from scanning), its store links, and Remove.
function ProductEditor({
  product,
  itemName,
  onChange,
  onRemove,
}: {
  product: PantryProduct;
  itemName: string;
  onChange: (product: PantryProduct) => void;
  onRemove: () => void;
}) {
  return (
    // Not a <form>: it sits inside the item's edit form.
    <div className="product-editor" role="group" aria-label={productName(product)}>
      <label>
        Brand
        <input value={product.brand} onChange={(e) => onChange({ ...product, brand: e.target.value })} maxLength={120} />
      </label>
      <label>
        Size
        <input value={product.size} onChange={(e) => onChange({ ...product, size: e.target.value })} maxLength={60} placeholder="like 400 g" />
      </label>
      {product.barcodes.length > 0 && (
        <div className="product-wide product-codes">
          <span className="label-text">{product.barcodes.length > 1 ? "Barcodes" : "Barcode"}</span>
          {product.barcodes.map((code) => (
            <span key={code} className="barcode-chip">
              {code}
              <button
                type="button"
                className="chip-remove"
                aria-label={`Remove barcode ${code}`}
                onClick={() => onChange({ ...product, barcodes: product.barcodes.filter((other) => other !== code) })}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <div className="product-wide">
        <StoreLinkField
          // Store searches name the exact product: "Nutella 400 g Nutella".
          name={[product.brand, itemName, product.size].map((part) => part.trim()).filter(Boolean).join(" ")}
          value={product.links}
          onChange={(links) => onChange({ ...product, links })}
        />
      </div>
      {/* No Done: tapping the product closes it, and Save keeps it. */}
      <div className="product-actions">
        <button type="button" className="link-button product-remove" onClick={onRemove}>
          Remove this product
        </button>
      </div>
    </div>
  );
}

// "+ Add a product": a brand and size by hand.
function NewProduct({ onAdd, onCancel }: { onAdd: (details: PacketDetails) => void; onCancel: () => void }) {
  const [brand, setBrand] = useState("");
  const [size, setSize] = useState("");
  const canAdd = !!(brand.trim() || size.trim());

  function add(event: FormEvent | KeyboardEvent) {
    event.preventDefault();
    if (canAdd) onAdd({ brand: brand.trim(), size: size.trim() });
  }

  // Enter adds it, rather than saving the whole form.
  const enterAdds = (event: KeyboardEvent) => {
    if (event.key === "Enter") add(event);
  };

  return (
    <div className="product-editor" role="group" aria-label="Add a product">
      <label>
        Brand
        <input autoFocus value={brand} onChange={(e) => setBrand(e.target.value)} onKeyDown={enterAdds} maxLength={120} />
      </label>
      <label>
        Size
        <input value={size} onChange={(e) => setSize(e.target.value)} onKeyDown={enterAdds} maxLength={60} placeholder="like 400 g" />
      </label>
      <div className="product-actions">
        <button type="button" className="button ghost small" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="button primary small" disabled={!canAdd} onClick={add}>
          Add
        </button>
      </div>
    </div>
  );
}
