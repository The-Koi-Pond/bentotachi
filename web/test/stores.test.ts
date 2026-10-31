// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { productNameFromTitle, productNameFromUrl, storeFor, storeSearchUrl, storesIn } from "../src/stores.ts";

test("each country offers its own stores", () => {
  assert.deepEqual(storesIn("AU").map((s) => s.name), ["Coles", "Woolworths"]);
  assert.deepEqual(storesIn("US").map((s) => s.name), ["Walmart", "Target", "Kroger"]);
  assert.deepEqual(storesIn("OTHER"), []);
});

test("search links", () => {
  const [walmart, target, kroger] = storesIn("US");
  assert.equal(storeSearchUrl(walmart, " soy sauce "), "https://www.walmart.com/search?q=soy%20sauce");
  assert.equal(storeSearchUrl(target, "soy sauce"), "https://www.target.com/s?searchTerm=soy%20sauce");
  assert.equal(storeSearchUrl(kroger, "soy sauce"), "https://www.kroger.com/search?query=soy%20sauce");
});

test("a saved link shows its store whatever the household's country", () => {
  assert.equal(storeFor("https://www.target.com/p/x/-/A-1")?.name, "Target");
  assert.equal(storeFor("https://www.coles.com.au/product/x-123")?.name, "Coles");
  assert.equal(storeFor("https://www.iga.com.au/x"), undefined);
});

test("product names from Australian store links and titles", () => {
  assert.equal(productNameFromUrl("https://www.coles.com.au/product/lea-perrins-worcestershire-sauce-250ml-1234567"), "Lea perrins worcestershire sauce");
  assert.equal(productNameFromTitle("Buy Lea & Perrins Worcestershire Sauce | 250mL | Coles"), "Lea & Perrins Worcestershire Sauce");
});

test("product names from US store links", () => {
  assert.equal(
    productNameFromUrl("https://www.walmart.com/ip/Lea-Perrins-Worcestershire-Sauce-10-fl-oz-Bottle/10308169"),
    "Lea perrins worcestershire sauce 10 fl oz bottle",
  );
  assert.equal(
    productNameFromUrl("https://www.target.com/p/rao-39-s-homemade-arrabbiata-sauce-24oz/-/A-13349591"),
    "Rao's homemade arrabbiata sauce",
  );
  assert.equal(productNameFromUrl("https://www.kroger.com/p/kroger-worcestershire-sauce/0001111085120"), "Kroger worcestershire sauce");
});

test("product names from US store titles", () => {
  assert.equal(productNameFromTitle("Lea & Perrins Worcestershire Sauce, 10 fl oz - Walmart.com"), "Lea & Perrins Worcestershire Sauce");
  assert.equal(productNameFromTitle("Rao's Homemade Arrabbiata Sauce - 24oz : Target"), "Rao's Homemade Arrabbiata Sauce");
  assert.equal(productNameFromTitle("Kroger® Worcestershire Sauce, 10 fl oz - Kroger"), "Kroger® Worcestershire Sauce");
});
