// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { withTemperatureHint } from "../src/temperatures.ts";

const au = (line: string) => withTemperatureHint(line, "AU");
const us = (line: string) => withTemperatureHint(line, "US");

test("Fahrenheit gets Celsius in Australia, rounded like an oven dial", () => {
  assert.equal(au("Preheat your oven to 375°F."), "Preheat your oven to 375°F *(190°C)*.");
  assert.equal(au("If baking: preheat oven to 350 degrees F. Lightly spray a pan."), "If baking: preheat oven to 350 degrees F *(180°C)*. Lightly spray a pan.");
  assert.equal(au("preheat to 425℉. Prep ingredients"), "preheat to 425℉ *(220°C)*. Prep ingredients");
  assert.equal(au("Preheat the oven to 350F."), "Preheat the oven to 350F *(180°C)*.");
  assert.equal(au("Bake at 325-350 °F"), "Bake at 325-350 °F *(160–180°C)*");
});

test("cooking temperatures under boiling stay exact", () => {
  assert.equal(au("Cook until the chicken reaches 165°F inside."), "Cook until the chicken reaches 165°F *(74°C)* inside.");
  assert.equal(us("Heat the milk to 40°C."), "Heat the milk to 40°C *(104°F)*.");
});

test("Celsius gets Fahrenheit in the US", () => {
  assert.equal(us("Preheat oven to 200C (180C fan)."), "Preheat oven to 200C *(400°F)* (180C *(350°F)* fan).");
  assert.equal(us("Bake at 220°C for 25 minutes"), "Bake at 220°C *(425°F)* for 25 minutes");
  assert.equal(us("Roast at 190 degrees Celsius"), "Roast at 190 degrees Celsius *(375°F)*");
});

test("leaves alone cups, small numbers, and lines with both", () => {
  assert.equal(us("1 C flour"), "1 C flour");
  assert.equal(us("Add 12 C of stock"), "Add 12 C of stock");
  assert.equal(au("Preheat oven to 180°C / 350°F"), "Preheat oven to 180°C / 350°F");
  assert.equal(au("Cook for 10 minutes."), "Cook for 10 minutes.");
  assert.equal(au("Section F: assembly"), "Section F: assembly");
});
