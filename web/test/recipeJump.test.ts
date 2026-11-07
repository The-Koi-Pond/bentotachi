// Run from the web folder with: node --test "test/*.test.ts"
import test from "node:test";
import assert from "node:assert/strict";
import { currentSection, jumpTarget, stillTapped } from "../src/recipeJump.ts";

// Ingredients from 600 to 1400, the method to 3000, notes to 3400; the
// bars cover the top 100 px of the screen.
const sections = [
  { key: "ingredients", top: 600, bottom: 1400 },
  { key: "method", top: 1400, bottom: 3000 },
  { key: "notes", top: 3000, bottom: 3400 },
];
const OFFSET = 100;

test("the section being read is the last one to reach the bars", () => {
  assert.equal(currentSection(sections, 0, OFFSET), "ingredients");
  assert.equal(currentSection(sections, 900, OFFSET), "ingredients");
  assert.equal(currentSection(sections, 1300, OFFSET), "method");
  assert.equal(currentSection(sections, 2950, OFFSET), "notes");
  assert.equal(currentSection([], 0, OFFSET), null);
});

test("a section's first visit lands at its top, just under the bars", () => {
  assert.deepEqual(jumpTarget(sections, "method", 700, OFFSET, {}), { scrollTo: 1300, saved: { ingredients: 700 } });
});

test("going back to a section returns to where you were in it", () => {
  // Reading step 5 (2200), off to the ingredients, then back.
  const away = jumpTarget(sections, "ingredients", 2200, OFFSET, {});
  assert.deepEqual(away, { scrollTo: 500, saved: { method: 2200 } });
  const back = jumpTarget(sections, "method", 650, OFFSET, away!.saved);
  assert.equal(back?.scrollTo, 2200);
  // ...and the ingredients now remember 650.
  assert.equal(back?.saved.ingredients, 650);
});

test("tapping the section you're in goes to its top and forgets the place", () => {
  assert.deepEqual(jumpTarget(sections, "method", 2200, OFFSET, { method: 1900, notes: 3100 }), {
    scrollTo: 1300,
    saved: { notes: 3100 },
  });
});

test("just before a section's top reaches the bars, the one above is still being read", () => {
  assert.equal(currentSection(sections, 1250, OFFSET), "ingredients");
});

test("at the bottom of the page, the short last section counts as being read", () => {
  // The page ends before the notes can scroll up to the bars: it scrolls
  // no further than 2600, where the notes (3000) are on screen.
  const MAX = 2600;
  assert.equal(currentSection(sections, 2600, OFFSET, MAX), "notes");
  assert.equal(currentSection(sections, 2200, OFFSET, MAX), "method");
  // Reading step 5 (2200), tap Notes: the page stops at 2600...
  const toNotes = jumpTarget(sections, "notes", 2200, OFFSET, {}, MAX);
  assert.deepEqual(toNotes?.saved, { method: 2200 });
  // ...and Method goes back to step 5, not the top of the method.
  assert.equal(jumpTarget(sections, "method", 2600, OFFSET, toNotes!.saved, MAX)?.scrollTo, 2200);
  // Reading the method's last steps right at the bottom (notes lit): off
  // to the ingredients and back still returns to those steps.
  const away = jumpTarget(sections, "ingredients", 2600, OFFSET, {}, MAX);
  assert.equal(away?.saved.method, 2600);
  assert.equal(jumpTarget(sections, "method", 500, OFFSET, away!.saved, MAX)?.scrollTo, 2600);
  // A recipe short enough not to scroll at all isn't "at the bottom".
  assert.equal(currentSection(sections, 0, OFFSET, 0), "ingredients");
});

test("the section last tapped counts as the one you're in, even where it can't reach the bars", () => {
  // A wide screen: method and notes both fit below the ingredients, so the
  // page stops (at 1233) before the method's top reaches the bars. You
  // tapped Method and landed there; Ingredients then remembers it as the
  // method's place, and tapping Method again goes to its top.
  const wide = [
    { key: "ingredients", top: 600, bottom: 1459 },
    { key: "method", top: 1459, bottom: 1900 },
    { key: "notes", top: 1900, bottom: 2000 },
  ];
  assert.equal(jumpTarget(wide, "ingredients", 1233, OFFSET, {}, 1233, "method")?.saved.method, 1233);
  assert.equal(jumpTarget(wide, "method", 1233, OFFSET, { method: 1233 }, 1233, "method")?.scrollTo, 1359);
  // Scrolled to the bottom yourself (notes lit), tap Method (the page can't
  // move), then Ingredients: it goes to the ingredients' top, not "back"
  // to the very spot you're on (found in review: the button did nothing).
  const toMethod = jumpTarget(wide, "method", 1233, OFFSET, {}, 1233);
  const toIngredients = jumpTarget(wide, "ingredients", 1233, OFFSET, toMethod!.saved, 1233, "method");
  assert.equal(toIngredients?.scrollTo, 500);
});

test("a tap's highlight lasts while the page is on its way or there, and ends when you scroll yourself", () => {
  const tap = { from: 2200, to: 500, arrived: false, until: 1500 };
  assert.equal(stillTapped(tap, 1400, 300), true); // on its way up
  assert.equal(stillTapped(tap, 2300, 300), false); // scrolled down instead
  // Stopped on the way (a finger on the screen): over once it's had time to arrive.
  assert.equal(stillTapped(tap, 1400, 2000), false);
  const there = { from: 2200, to: 500, arrived: true, until: 1500 };
  assert.equal(stillTapped(there, 501, 9000), true);
  assert.equal(stillTapped(there, 700, 9000), false); // scrolled on from there
});

test("a remembered place no longer inside its section isn't used", () => {
  // The ingredients grew (a line added): the method's old place is now
  // above it, among the ingredients.
  const longer = [{ key: "ingredients", top: 600, bottom: 1900 }, { key: "method", top: 1900, bottom: 3000 }];
  assert.equal(jumpTarget(longer, "method", 700, OFFSET, { method: 1500 })?.scrollTo, 1800);
  // The method got shorter (a step deleted): 2900 is now in the notes.
  const shorter = [sections[0], { key: "method", top: 1400, bottom: 2500 }, { key: "notes", top: 2500, bottom: 2900 }];
  assert.equal(jumpTarget(shorter, "method", 700, OFFSET, { method: 2900 })?.scrollTo, 1300);
  assert.equal(jumpTarget(sections, "nowhere", 700, OFFSET, {}), null);
});
