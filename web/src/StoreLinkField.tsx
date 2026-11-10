import { useId, useState } from "react";
import { errorMessage } from "./pb";
import { useStores } from "./household";
import { storeSearchUrl, type Store } from "./stores";
import { hasBuiltInBrowser, pickPageLink } from "./bentoBrowser";
import StoreLogo from "./StoreLogo";
import { MOST_STORE_LINKS, withPickedLink } from "./pantryItem";
import { HelpBox, HelpButton, useHelp } from "./Help";

// "Store links": the item's product pages, like Coles' page for our exact
// Worcestershire sauce, and Woolworths' too (up to 5, one box each). In the
// Android app, "Find on Coles" opens Bento's browser on the store's search;
// open the product and tap "Link this item" (it replaces the item's Coles
// link, if it has one; see withPickedLink). In a web browser, the store
// opens in a new tab to copy the address from.
export default function StoreLinkField({
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
  const help = useHelp();
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
      {/* How to get one is a tip, behind its "?" (docs/VISION.md, Voice). */}
      <span className="field-head">
        <span className="label-text" id={labelId}>
          {several ? "Store links" : "Store link"} <span className="optional">(optional)</span>
        </span>
        <HelpButton help={help} label="How to link a store's page" />
      </span>
      <HelpBox help={help}>
        <p>
          {!stores.length
            ? "A shop's page for this product, copied from your browser."
            : hasBuiltInBrowser
              ? "Find it in a store, open the product, then tap Link this item."
              : "Search a store, open the product, then copy its address into here."}
        </p>
      </HelpBox>
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
