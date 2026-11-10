// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { parseNumber, withWeightHint } from "../src/weights.ts";

const au = (line: string) => withWeightHint(line, "AU");
const us = (line: string) => withWeightHint(line, "US");

test("a whole number and a fraction joined by 'and' or '&' is one mixed number", () => {
  assert.equal(parseNumber("1 and 1/2"), 1.5);
  assert.equal(parseNumber("2 and 1/4"), 2.25);
  assert.equal(parseNumber("1 & ½"), 1.5);
  assert.equal(parseNumber("3&3/4"), 3.75);
  // The forms it read before still read the same.
  assert.equal(parseNumber("1 1/2"), 1.5);
  assert.equal(parseNumber("1½"), 1.5);
  assert.equal(parseNumber("3 ½"), 3.5);
  assert.equal(parseNumber("1/2"), 0.5);
  assert.equal(parseNumber("2"), 2);
});

test("a mixed number written with 'and' gets the whole weight", () => {
  assert.equal(au("1 and 1/2 pounds chicken thighs"), "1 and 1/2 pounds *(680 g)* chicken thighs");
  assert.equal(au("1 & ½ lbs ground beef"), "1 & ½ lbs *(680 g)* ground beef");
  assert.equal(au("1 and 1/2 to 2 pounds potatoes"), "1 and 1/2 to 2 pounds *(680–905 g)* potatoes");
  // "and" with no whole number before it joins nothing.
  assert.equal(au("Salt and 1/2 lb butter"), "Salt and 1/2 lb *(225 g)* butter");
  assert.equal(au("2 eggs and 1/2 lb butter"), "2 eggs and 1/2 lb *(225 g)* butter");
});

test("pounds and ounces get grams in Australia", () => {
  assert.equal(au("1½ lbs ground beef"), "1½ lbs *(680 g)* ground beef");
  assert.equal(au("1 1/2 pounds chicken thighs"), "1 1/2 pounds *(680 g)* chicken thighs");
  assert.equal(au("8 oz cream cheese"), "8 oz *(225 g)* cream cheese");
  assert.equal(au("1 (14.5 oz) can diced tomatoes"), "1 (14.5 oz *(410 g)*) can diced tomatoes");
  assert.equal(au("3 lb whole chicken"), "3 lb *(1.4 kg)* whole chicken");
  assert.equal(au("½ oz dried porcini"), "½ oz *(14 g)* dried porcini");
  assert.equal(au("3 ½ pounds bone-in chicken"), "3 ½ pounds *(1.6 kg)* bone-in chicken");
  assert.equal(au("1 (14.5-ounce) can fire-roasted tomatoes"), "1 (14.5-ounce *(410 g)*) can fire-roasted tomatoes");
  assert.equal(au("One 28-ounce can chickpeas"), "One 28-ounce *(795 g)* can chickpeas");
  assert.equal(au("2 chicken breasts (approx.1 pound)"), "2 chicken breasts (approx.1 pound *(455 g)*)");
  // "pound" the verb has no amount before it.
  assert.equal(au("Cover and pound each piece to an even thickness."), "Cover and pound each piece to an even thickness.");
});

test("ranges convert both ends", () => {
  assert.equal(au("1-2 lbs potatoes"), "1-2 lbs *(455–905 g)* potatoes");
  assert.equal(us("500 to 600 g pumpkin"), "500 to 600 g *(1.1–1.3 lb)* pumpkin");
  assert.equal(au("2-3 lbs pork shoulder"), "2-3 lbs *(905 g–1.4 kg)* pork shoulder");
});

test("grams and kilos get pounds and ounces in the US", () => {
  assert.equal(us("500 g beef mince"), "500 g *(1.1 lb)* beef mince");
  assert.equal(us("250g mushrooms, sliced"), "250g *(9 oz)* mushrooms, sliced");
  assert.equal(us("100 grams butter"), "100 grams *(3.5 oz)* butter");
  assert.equal(us("1 kg potatoes"), "1 kg *(2.2 lb)* potatoes");
  // Small amounts aren't rounded away to nothing.
  assert.equal(us("7 grams gelatin"), "7 grams *(0.2 oz)* gelatin");
});

test("leaves alone lines with both, fluid ounces, and things that aren't weights", () => {
  assert.equal(au("250 g/8oz beef tenderloin"), "250 g/8oz beef tenderloin");
  assert.equal(us("250 g/8oz beef tenderloin"), "250 g/8oz beef tenderloin");
  assert.equal(au("10 fl oz chicken stock"), "10 fl oz chicken stock");
  assert.equal(au("2 cups flour"), "2 cups flour");
  assert.equal(au("1 garlic clove"), "1 garlic clove");
  assert.equal(us("2 eggs"), "2 eggs");
  assert.equal(au("500 g beef mince"), "500 g beef mince");
  assert.equal(us("1 lb ground beef"), "1 lb ground beef");
});

test("anywhere else weighs in grams, like Australia", () => {
  assert.equal(withWeightHint("2 lbs carrots", "OTHER"), "2 lbs *(905 g)* carrots");
});

test("1-1/2 lbs is one and a half pounds, not 1 to ½", () => {
  assert.equal(withWeightHint("1-1/2 lbs ground beef", "AU"), "1-1/2 lbs *(680 g)* ground beef");
});
