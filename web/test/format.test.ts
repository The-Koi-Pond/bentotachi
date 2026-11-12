// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { continuesNumbering, extraTimes, formatMinutes, headingOf, isQuick, sizeText, totalMinutes } from "../src/format.ts";

test("a size in words", () => {
  assert.equal(sizeText(18_400_000), "18 MB");
  assert.equal(sizeText(2_006_398), "2 MB");
  assert.equal(sizeText(400_000), "400 KB");
  assert.equal(sizeText(0), "1 KB");
});

const recipe = (prep: number, cook: number, total: number) => ({ prep_minutes: prep, cook_minutes: cook, total_minutes: total });

test("extra times count in a total the recipe doesn't give", () => {
  const extras = [{ label: "Cool", minutes: 420 }, { label: "", minutes: 5 }, { label: "Release", minutes: 0 }];
  assert.equal(totalMinutes({ ...recipe(10, 20, 0), extra_times: extras }), 450);
  // A recipe's own total stays as it is.
  assert.equal(totalMinutes({ ...recipe(10, 20, 60), extra_times: extras }), 60);
  // Blank, zero or garbled ones are left out.
  assert.deepEqual(extraTimes({ extra_times: extras }), [{ label: "Cool", minutes: 420 }]);
  assert.deepEqual(extraTimes({ extra_times: "nope" }), []);
});

test("total time falls back to prep + cook", () => {
  assert.equal(totalMinutes(recipe(5, 25, 0)), 30);
  assert.equal(totalMinutes(recipe(5, 25, 40)), 40);
  assert.equal(totalMinutes(recipe(0, 0, 0)), 0);
});

test("quick means at or under the limit, and never without a time", () => {
  assert.equal(isQuick(recipe(0, 0, 30), 30), true);
  assert.equal(isQuick(recipe(0, 0, 31), 30), false);
  assert.equal(isQuick(recipe(10, 10, 0), 20), true);
  assert.equal(isQuick(recipe(0, 0, 0), 30), false);
  assert.equal(isQuick(recipe(0, 0, 45), 60), true);
});

test("formats minutes", () => {
  assert.equal(formatMinutes(75), "1 h 15 min");
  assert.equal(formatMinutes(60), "1 h");
  assert.equal(formatMinutes(25), "25 min");
  assert.equal(formatMinutes(0), "");
});

test("cleans up typed site addresses", async () => {
  const { normaliseSiteUrl, savedSiteSearchUrl, siteHost } = await import("../src/recipeSites.ts");
  assert.equal(normaliseSiteUrl("smittenkitchen.com"), "https://smittenkitchen.com/");
  assert.equal(normaliseSiteUrl("  https://www.example.com/recipes "), "https://www.example.com/recipes");
  assert.equal(normaliseSiteUrl("http://example.com"), "http://example.com/");
  assert.equal(normaliseSiteUrl("lasagne"), null);
  assert.equal(normaliseSiteUrl("ftp://example.com"), null);
  assert.equal(normaliseSiteUrl(""), null);
  assert.equal(siteHost("https://www.example.com/recipes"), "example.com");
  assert.equal(savedSiteSearchUrl("https://www.example.com/", " beef pie "), "https://www.google.com/search?q=site%3Aexample.com%20beef%20pie");
});

test("a site's categories page carries its name and link intact, and only a category's says inside", async () => {
  const { categoriesPath } = await import("../src/recipeSites.ts");
  const site = categoriesPath({ name: "Fish & chips?", url: "https://example.com/?a=1&b=2" });
  const query = new URLSearchParams(site.split("?").slice(1).join("?"));
  assert.ok(site.startsWith("/browse/categories?"));
  assert.equal(query.get("name"), "Fish & chips?");
  assert.equal(query.get("url"), "https://example.com/?a=1&b=2");
  assert.equal(query.get("inside"), null);
  const inside = categoriesPath({ name: "Soups", url: "https://example.com/category/soups/", inside: true });
  assert.equal(new URLSearchParams(inside.split("?")[1]).get("inside"), "1");
});

test("finds the link in shared text", async () => {
  const { sharedLink } = await import("../src/recipeSites.ts");
  assert.equal(sharedLink("https://www.recipetineats.com/lasagne/"), "https://www.recipetineats.com/lasagne/");
  assert.equal(sharedLink("Easy lasagne https://example.com/lasagne?x=1 via the app"), "https://example.com/lasagne?x=1");
  assert.equal(sharedLink("Look at this (https://example.com/pie)."), "https://example.com/pie");
  assert.equal(sharedLink("no link here"), null);
});

test("store search links and product link names", async () => {
  const { STORES, storeName, storeSearchUrl } = await import("../src/stores.ts");
  const [coles, woolworths] = STORES;
  assert.equal(storeSearchUrl(coles, " worcestershire sauce "), "https://www.coles.com.au/search/products?q=worcestershire%20sauce");
  assert.equal(storeSearchUrl(woolworths, "eggs"), "https://www.woolworths.com.au/shop/search/products?searchTerm=eggs");
  assert.equal(storeName("https://www.coles.com.au/product/lea-perrins-worcestershire-sauce-250ml-123"), "Coles");
  assert.equal(storeName("https://www.woolworths.com.au/shop/productdetails/12345/lea-perrins"), "Woolworths");
  assert.equal(storeName("https://shop.iga.com.au/item/1"), "shop.iga.com.au");
  assert.equal(storeName("not a link"), "Store");
});

test("names pantry items from store product pages", async () => {
  const { isStoreLink, productNameFromTitle, productNameFromUrl } = await import("../src/stores.ts");
  assert.equal(isStoreLink("https://www.coles.com.au/product/x-123"), true);
  assert.equal(isStoreLink("https://www.recipetineats.com/lasagne/"), false);
  assert.equal(productNameFromUrl("https://www.coles.com.au/product/lea-perrins-worcestershire-sauce-250ml-1234567"), "Lea perrins worcestershire sauce");
  assert.equal(productNameFromUrl("https://www.woolworths.com.au/shop/productdetails/39927/harris-filter-papers-4-6-cup-size-2"), "Harris filter papers 4 6 cup size 2");
  assert.equal(productNameFromUrl("https://www.woolworths.com.au/shop/productdetails/690093"), "");
  assert.equal(productNameFromUrl("not a link"), "");
  assert.equal(productNameFromTitle("Buy Lea & Perrins Worcestershire Sauce | 250mL | Coles"), "Lea & Perrins Worcestershire Sauce");
  assert.equal(productNameFromTitle("Lea & Perrins Worcestershire Sauce 250ml | Woolworths"), "Lea & Perrins Worcestershire Sauce");
  assert.equal(productNameFromTitle("Coles Free Range Eggs 12 Pack | 700g"), "Coles Free Range Eggs");
  assert.equal(productNameFromTitle("Woolworths"), "");
});

test("pasted lines lose the tick-boxes recipe sites put in front", async () => {
  const { textToLines } = await import("../src/format.ts");
  assert.deepEqual(textToLines("▢ 2 eggs\n☐1 cup flour\n  ▢  \n✓ salt\n□ □ pepper"), ["2 eggs", "1 cup flour", "salt", "pepper"]);
  // A box only goes when it's in front: the rest of the line is kept as is.
  assert.deepEqual(textToLines("Tick ▢ when done"), ["Tick ▢ when done"]);
  // Some copies put each box on its own line.
  assert.deepEqual(textToLines("▢\n2 eggs\n▢\n1 onion"), ["2 eggs", "1 onion"]);
});

test("a ## heading carries on the step numbers; a # heading starts again", () => {
  assert.equal(continuesNumbering("## Cook the vegetables"), true);
  assert.equal(continuesNumbering("# Sauce"), false);
  assert.equal(continuesNumbering("Stir well."), false);
  assert.equal(headingOf("## Cook the vegetables"), "Cook the vegetables");
});
