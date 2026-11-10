import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cleanProducts,
  otherProducts,
  productSources,
  preferredProduct,
  productName,
  productNote,
  productWithBarcode,
  replaceProduct,
  addProduct,
  withServerAdditions,
} from "../src/pantryProducts.ts";

const NUT = "3017620422003";
const small = { brand: "Nutella", size: "400 g", barcodes: [NUT], links: ["https://www.coles.com.au/x"] };
const big = { brand: "Nutella", size: "750 g", barcodes: [], links: [] };
const unnamed = { brand: "", size: "", barcodes: ["9300633603161"], links: [] };
const item = { products: [small, big, unnamed], usual_packet: { brand: "nutella", size: "400 G" } };

test("a product's name, or Not named yet", () => {
  assert.equal(productName(small), "Nutella 400 g");
  assert.equal(productName(unnamed), "Not named yet");
});

test("under a product's name: its barcode and stores", () => {
  const store = () => "Coles";
  assert.equal(productNote(small, store), `Barcode ${NUT} · Coles link`);
  assert.equal(productNote({ ...small, barcodes: [NUT, "1"], links: [] }, store), "2 barcodes");
  assert.equal(productNote(big, store), "No barcode yet");
});

test("the favourite, and the other named products to add with one tap", () => {
  assert.equal(preferredProduct(item), small);
  assert.deepEqual(otherProducts(item), [big]);
  assert.equal(preferredProduct({ products: [big], usual_packet: null }), null);
  assert.deepEqual(otherProducts({ products: [big], usual_packet: null }), [big], "no favourite: all of them");
});

test("which product a barcode is on", () => {
  assert.equal(productWithBarcode(item, NUT), small);
  assert.equal(productWithBarcode(item, "123"), null);
});

test("adding a product joins the same brand and size, else goes at the end", () => {
  assert.deepEqual(addProduct([small], { brand: "nutella", size: "400 g", barcode: "111" })[0].barcodes, [NUT, "111"]);
  assert.deepEqual(addProduct([small], { brand: " Bon Maman", size: "360 g " }).at(-1), { brand: "Bon Maman", size: "360 g", barcodes: [], links: [] });
});

test("products as saved: trimmed, links made full, empty ones gone", () => {
  assert.deepEqual(
    cleanProducts([
      { brand: " Nutella ", size: "400 g", barcodes: [NUT], links: ["coles.com.au/product/nutella", ""] },
      { brand: "", size: " ", barcodes: [], links: [""] },
    ]),
    [{ brand: "Nutella", size: "400 g", barcodes: [NUT], links: ["https://coles.com.au/product/nutella"] }]
  );
  assert.equal(cleanProducts([{ brand: "Nutella", size: "", barcodes: [], links: ["not a link"] }]), null);
});

test("all the products' barcodes and links, the favourite's first", () => {
  assert.deepEqual(productSources([big, small], { brand: "Nutella", size: "400 g" }), {
    barcodes: [NUT],
    links: ["https://www.coles.com.au/x"],
  });
});

test("changing or taking out one product", () => {
  assert.deepEqual(replaceProduct([small, big], 1, null), [small]);
  assert.deepEqual(replaceProduct([small, big], 0, { ...small, size: "350 g" })[0].size, "350 g");
});

test("the edit form's save keeps what the server added while it was open", () => {
  const BON = "3608580758686";
  const bonMaman = { brand: "Bon Maman", size: "360 g", barcodes: [BON], links: [] };
  const start = [small, big];
  // Meanwhile: a product remembered from a label, and a barcode on `big`.
  const live = [small, { ...big, barcodes: ["3017620425035"] }, bonMaman];
  // The form gave `small` a link and took `big` out.
  const edited = [{ ...small, links: [...small.links, "https://www.woolworths.com.au/x"] }];
  assert.deepEqual(withServerAdditions(edited, start, live), [edited[0], bonMaman]);
  // Nothing new on the server: the form's list as it is.
  assert.deepEqual(withServerAdditions(edited, start, start), edited);
  // The form renamed `small` (found by its barcode): what reached it stays.
  const renamed = [{ ...small, size: "350 g" }];
  const grew = [{ ...small, barcodes: [NUT, "9300000000011"] }];
  assert.deepEqual(withServerAdditions(renamed, [small], grew), [{ ...renamed[0], barcodes: [NUT, "9300000000011"] }]);
  // The form added the same one by hand: not twice.
  assert.deepEqual(withServerAdditions([...edited, { ...bonMaman, barcodes: [] }], start, live), [...edited, bonMaman]);
});
