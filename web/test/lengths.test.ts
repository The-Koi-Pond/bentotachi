// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { withLengthHint } from "../src/lengths.ts";

const au = (line: string) => withLengthHint(line, "AU");
const us = (line: string) => withLengthHint(line, "US");

test("inches get centimetres in Australia", () => {
  assert.equal(au("asparagus, cut into 1-inch pieces"), "asparagus, cut into 1-inch *(2.5 cm)* pieces");
  assert.equal(au("cremini mushrooms, sliced 1/4-inch thick"), "cremini mushrooms, sliced 1/4-inch *(0.6 cm)* thick");
  assert.equal(au('1 yellow pepper, cut into 1/2" slices'), '1 yellow pepper, cut into 1/2" *(1.3 cm)* slices');
  assert.equal(au("(cut into 1” pieces)"), "(cut into 1” *(2.5 cm)* pieces)");
  assert.equal(au("Preheat a large (12 inch) deep skillet"), "Preheat a large (12 inch *(30 cm)*) deep skillet");
});

test("pan sizes, with or without the word inch", () => {
  assert.equal(au("Lightly spray a 9x13 pan with nonstick spray"), "Lightly spray a 9x13 *(23×33 cm)* pan with nonstick spray");
  assert.equal(au("Spray a 9x13 inch baking dish"), "Spray a 9x13 inch *(23×33 cm)* baking dish");
  assert.equal(au("Place parchment in a 13x9-inch pan"), "Place parchment in a 13x9-inch *(33×23 cm)* pan");
  assert.equal(au("a baking dish (mine measured approx. 8 x 8 inches)"), "a baking dish (mine measured approx. 8 x 8 inches *(20×20 cm)*)");
  assert.equal(au("roll into an even 17″x10″ rectangle"), "roll into an even 17″x10″ *(43×25 cm)* rectangle");
});

test("centimetres get inches in the US", () => {
  assert.equal(us("Cut chicken breast into 2cm pieces"), "Cut chicken breast into 2cm *(¾ in)* pieces");
  assert.equal(us("a 30cm skillet"), "a 30cm *(12 in)* skillet");
  assert.equal(us("slices 5mm thick, 0.5 cm"), "slices 5mm thick, 0.5 cm *(¼ in)*");
  assert.equal(us("a 20 x 30 cm tin"), "a 20 x 30 cm *(8×12 in)* tin");
});

test("leaves alone lines with both, and things that aren't lengths", () => {
  assert.equal(au('2.5 cm / 1" pieces'), '2.5 cm / 1" pieces');
  assert.equal(us('2.5 cm / 1" pieces'), '2.5 cm / 1" pieces');
  assert.equal(au("Add 2 cups of stock"), "Add 2 cups of stock");
  assert.equal(au("Put 2 in the pan"), "Put 2 in the pan");
  assert.equal(au("4 x 160g fish fillets"), "4 x 160g fish fillets");
});
