import { storeFor, storeName } from "./stores";
import StoreLogo from "./StoreLogo";

// A pantry item's product page: the store's logo (or, for other shops, the
// site's name) with ↗, opened in the phone's own browser (where you're
// logged in to the store, with your trolley), or a new tab.
export default function StoreLink({ url, itemName }: { url: string; itemName: string }) {
  const store = storeFor(url);
  return (
    <a
      className="store-link"
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${itemName} on ${storeName(url)}`}
    >
      {store ? <StoreLogo store={store} /> : storeName(url)} ↗
    </a>
  );
}
