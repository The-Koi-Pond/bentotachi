// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { recipeMeasures, withVolumeHint } from "../src/volumes.ts";

const us = recipeMeasures("https://www.pinchofyum.com/x");
const au = recipeMeasures("https://www.taste.com.au/recipes/x");

test("a recipe's spoons and cups come from its website", () => {
  assert.equal(us.tablespoon, 15);
  assert.equal(au.tablespoon, 20);
  assert.equal(au.cup, 250);
  assert.equal(recipeMeasures("https://www.recipetineats.com/x").tablespoon, 15);
  assert.equal(recipeMeasures("https://www.example.co.uk/x").pint, 568);
  assert.equal(recipeMeasures("").tablespoon, 15);
});

test("tablespoons get a hint only when they aren't the household's spoon", () => {
  assert.equal(withVolumeHint("2 tbsp soy sauce", "AU", us, 15), "2 tbsp soy sauce");
  assert.equal(withVolumeHint("2 tbsp soy sauce", "AU", us, 20), "2 tbsp *(your 1 tbsp + 2 tsp)* soy sauce");
  assert.equal(withVolumeHint("1 tablespoon oil", "AU", us, 20), "1 tablespoon *(your 3 tsp)* oil");
  assert.equal(withVolumeHint("½ Tbsp butter", "AU", us, 20), "½ Tbsp *(your 1½ tsp)* butter");
  assert.equal(withVolumeHint("2 tbsp sugar", "AU", au, 15), "2 tbsp *(your 2 tbsp + 2 tsp)* sugar");
  assert.equal(withVolumeHint("1-2 tbsp honey", "US", au, 15), "1-2 tbsp *(your 1 tbsp + 1 tsp to 2 tbsp + 2 tsp)* honey");
  assert.equal(withVolumeHint("1 tsp salt", "AU", us, 20), "1 tsp salt");
});

test("outside the US, US liquid measures get millilitres (and cups, except in Australia)", () => {
  assert.equal(withVolumeHint("1 cup milk", "NL", us, 15), "1 cup *(240 ml)* milk");
  assert.equal(withVolumeHint("1/3 cup water", "OTHER", us, 15), "1/3 cup *(80 ml)* water");
  assert.equal(withVolumeHint("1 ½ cups stock", "NL", au, 15), "1 ½ cups *(380 ml)* stock");
  assert.equal(withVolumeHint("1 cup milk", "AU", us, 15), "1 cup milk");
  assert.equal(withVolumeHint("8 fl oz cream", "AU", us, 15), "8 fl oz *(240 ml)* cream");
  assert.equal(withVolumeHint("2 quarts chicken broth", "AU", us, 15), "2 quarts *(1.9 l)* chicken broth");
  assert.equal(withVolumeHint("1 pint beer", "AU", recipeMeasures("https://x.co.uk/y"), 15), "1 pint *(570 ml)* beer");
  // Already both.
  assert.equal(withVolumeHint("1 cup (250 ml) milk", "NL", us, 15), "1 cup (250 ml) milk");
  // Not units.
  assert.equal(withVolumeHint("2 large eggs", "NL", us, 15), "2 large eggs");
});

test("in the US, millilitres and litres get cups or spoons", () => {
  assert.equal(withVolumeHint("250 ml milk", "US", au, 15), "250 ml *(1 cup)* milk");
  assert.equal(withVolumeHint("375ml coconut milk", "US", au, 15), "375ml *(1½ cups)* coconut milk");
  assert.equal(withVolumeHint("1 litre stock", "US", au, 15), "1 litre *(4¼ cups)* stock");
  assert.equal(withVolumeHint("30 ml lime juice", "US", us, 15), "30 ml *(2 tbsp)* lime juice");
  assert.equal(withVolumeHint("2 L water", "US", us, 15), "2 L *(8⅓ cups)* water");
  assert.equal(withVolumeHint("250 ml (1 cup) milk", "US", us, 15), "250 ml (1 cup) milk");
});

test("found in real recipes: 1-1/4 is one and a quarter, and weighed cups need no hint", () => {
  assert.equal(withVolumeHint("1-1/4 cups water", "NL", us, 15), "1-1/4 cups *(300 ml)* water");
  assert.equal(withVolumeHint("75 g (1/2 cup + 1/2 tablespoon) cake flour", "NL", us, 15), "75 g (1/2 cup + 1/2 tablespoon) cake flour");
  assert.equal(withVolumeHint("1-2 cups stock", "NL", us, 15), "1-2 cups *(240 ml to 480 ml)* stock");
});
