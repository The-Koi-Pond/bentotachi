// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { productNameFromTitle, productNameFromUrl, storeFor, storeName, storeSearchUrl, storesIn } from "../src/stores.ts";

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

test("Dutch stores", () => {
  assert.deepEqual(storesIn("NL").map((s) => s.name), ["Albert Heijn", "Jumbo", "Plus", "Dirk"]);
  const [ah, jumbo, plus, dirk] = storesIn("NL");
  assert.equal(storeSearchUrl(ah, "pindakaas"), "https://www.ah.nl/zoeken?query=pindakaas");
  assert.equal(storeSearchUrl(jumbo, "halfvolle melk"), "https://www.jumbo.com/zoeken/producten?searchTerms=halfvolle%20melk");
  assert.equal(storeSearchUrl(plus, "pindakaas"), "https://www.plus.nl/zoekresultaten?SearchTerm=pindakaas");
  assert.equal(storeSearchUrl(dirk, "halfvolle melk"), "https://www.dirk.nl/zoeken/producten/halfvolle%20melk");
  assert.equal(storeFor("https://www.ah.nl/producten/product/wi1525/ah-halfvolle-melk")?.name, "Albert Heijn");
});

test("product names from Dutch store links and titles", () => {
  // Real links from Plus's and Dirk's searches (2026-10-31).
  assert.equal(productNameFromUrl("https://www.plus.nl/product/calve-pindakaas-regular-pot-350-g-191311"), "Calve pindakaas regular pot");
  assert.equal(
    productNameFromUrl("https://www.dirk.nl/boodschappen/brood-beleg-koek/broodbeleg/calv%c3%a9%20pindakaas/44286"),
    "Calvé pindakaas",
  );
  assert.equal(productNameFromUrl("https://www.ah.nl/producten/product/wi1525/ah-halfvolle-melk"), "Ah halfvolle melk");
  assert.equal(productNameFromUrl("https://www.jumbo.com/producten/jumbo-halfvolle-melk-1l-67649PAK"), "Jumbo halfvolle melk");
  assert.equal(productNameFromTitle("Calvé Pindakaas. Nu bij Dirk | Dirk"), "Calvé Pindakaas");
  assert.equal(productNameFromTitle("AH Pindakaas bestellen | Albert Heijn"), "AH Pindakaas");
  assert.equal(productNameFromTitle("Jumbo Eieren 6 stuks | Jumbo"), "Jumbo Eieren");
});

test("a store link's name: the store, else the site, else just Store", () => {
  assert.equal(storeName("https://www.coles.com.au/product/x-123"), "Coles");
  assert.equal(storeName("https://www.iga.com.au/x"), "iga.com.au");
  assert.equal(storeName("not a link"), "Store");
  assert.equal(storeFor("not a link"), undefined);
});
