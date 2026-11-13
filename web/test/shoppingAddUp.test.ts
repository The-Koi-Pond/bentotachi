import { test } from "node:test";
import assert from "node:assert/strict";
import { addedUp, plannedAdds, sharesOf, type Share, type Step } from "../src/shoppingAddUp.ts";

const share = (recipe: string, text: string): Share => ({ recipe, title: recipe, text });
const thing = (text: string, recipe: string, pantryItem = "") => ({ text, pantryItem, shares: [share(recipe, text)] });
// Each step as a short line: "+ 3 carrots [Beef]" or "~ id: 5 garlic cloves [Tuscan, Beef]".
const steps = (list: Step[]) =>
  list.map((step) =>
    "create" in step
      ? `+ ${step.create.text} [${step.create.shares.map((s) => s.recipe).join(", ")}]`
      : `~ ${step.update.id}: ${step.update.text} [${step.update.shares.map((s) => s.recipe).join(", ")}]`
  );

test("adding a recipe adds up with what's waiting, and the rest are new lines", () => {
  const waiting = [
    { id: "g", text: "3 garlic cloves", pantryItem: "", shares: [share("Tuscan", "3 garlic cloves")] },
    { id: "o", text: "1 onion", pantryItem: "", shares: [share("Tuscan", "1 onion")] },
  ];
  const plan = plannedAdds([thing("1 large onion", "Beef"), thing("2 garlic cloves", "Beef"), thing("3 carrots", "Beef")], waiting);
  assert.deepEqual(steps(plan.steps), ["~ o: 2 onions [Tuscan, Beef]", "~ g: 5 garlic cloves [Tuscan, Beef]", "+ 3 carrots [Beef]"]);
  assert.deepEqual([plan.added, plan.addedUp, plan.skipped], [1, 2, 0]);
  // The waiting lines themselves aren't changed.
  assert.equal(waiting[0].text, "3 garlic cloves");
});

test("the same recipe again isn't counted twice; two of its lines in one go are", () => {
  const waiting = [{ id: "g", text: "5 garlic cloves", pantryItem: "", shares: [share("Tuscan", "3 garlic cloves"), share("Beef", "2 garlic cloves")] }];
  const again = plannedAdds([thing("2 garlic cloves", "Beef")], waiting);
  assert.deepEqual([again.steps.length, again.skipped], [0, 1]);
  const twoLines = plannedAdds([thing("2 garlic cloves", "Soup"), thing("1 garlic clove", "Soup")], []);
  assert.deepEqual(steps(twoLines.steps), ["+ 3 garlic cloves [Soup, Soup]"]);
});

test("the same words from another recipe add up too; without an amount, the line stays and gets the share", () => {
  const plan = plannedAdds([thing("3 garlic cloves", "Beef"), thing("Salt", "Beef")], [
    { id: "g", text: "3 garlic cloves", pantryItem: "", shares: [share("Tuscan", "3 garlic cloves")] },
    { id: "s", text: "Salt", pantryItem: "", shares: [share("Tuscan", "Salt")] },
  ]);
  assert.deepEqual(steps(plan.steps), ["~ g: 6 garlic cloves [Tuscan, Beef]", "~ s: Salt [Tuscan, Beef]"]);
  assert.deepEqual([plan.addedUp, plan.skipped], [1, 1]);
});

test("pantry links: the same item adds to its line, another item's line isn't touched", () => {
  const waiting = [{ id: "m", text: "Milk", pantryItem: "milk", shares: [share("", "Milk")] }];
  const plan = plannedAdds([thing("2 L milk", "Pancakes", "milk"), thing("1 L milk", "Soup", "oat-milk")], waiting);
  assert.deepEqual(steps(plan.steps), ["~ m: Milk [, Pancakes]", "+ 1 L milk [Soup]"]);
});

test("different things, or units that don't add up, stay separate lines", () => {
  const plan = plannedAdds([thing("1 cup flour", "Scones"), thing("200 g flour", "Pancakes"), thing("2 red onions", "Salsa")], [
    { id: "o", text: "1 onion", pantryItem: "", shares: [share("Soup", "1 onion")] },
  ]);
  assert.deepEqual(steps(plan.steps), ["+ 1 cup flour [Scones]", "+ 200 g flour [Pancakes]", "+ 2 red onions [Salsa]"]);
});

test("a recipe added again at another size takes its old share's place", () => {
  const waiting = [{ id: "g", text: "5 garlic cloves", pantryItem: "", shares: [share("Tuscan", "3 garlic cloves"), share("Beef", "2 garlic cloves")] }];
  const plan = plannedAdds([thing("6 garlic cloves", "Tuscan")], waiting);
  assert.deepEqual(steps(plan.steps), ["~ g: 8 garlic cloves [Beef, Tuscan]"]);
  assert.deepEqual([plan.addedUp, plan.skipped], [1, 0]);
});

test("a recipe planned twice in the week counts twice, less what's already on the list", () => {
  const waiting = [{ id: "c", text: "3 carrots", pantryItem: "", shares: [share("Stew", "3 carrots")] }];
  const week = { text: "6 carrots", pantryItem: "", shares: [share("Stew", "3 carrots"), share("Stew", "3 carrots")] };
  assert.deepEqual(steps(plannedAdds([week], waiting).steps), ["~ c: 6 carrots [Stew, Stew]"]);
});

test("the plan's week by the pantry's name adds no amount, so nothing's bought twice", () => {
  const waiting = [{ id: "o", text: "2 onions", pantryItem: "onion", shares: [share("Soup", "2 onions")] }];
  const week = { text: "Onion", pantryItem: "onion", shares: [share("Curry", "2 onions"), share("Pie", "1 onion")] };
  const plan = plannedAdds([week], waiting);
  assert.deepEqual(steps(plan.steps), ["~ o: 2 onions [Soup, Curry, Pie]"]);
  assert.deepEqual([plan.addedUp, plan.skipped], [0, 1]);
});

test("a linked thing joining a typed-in line gives it the link", () => {
  const plan = plannedAdds([thing("2 onions", "Soup", "onion")], [{ id: "o", text: "1 onion", pantryItem: "", shares: [share("", "1 onion")] }]);
  assert.deepEqual(plan.steps, [
    { update: { id: "o", text: "3 onions", pantryItem: "onion", shares: [share("", "1 onion"), share("Soup", "2 onions")] } },
  ]);
});

test("lines that add up within one go count as one added, not as added up", () => {
  const plan = plannedAdds([thing("1 onion", "Soup"), thing("1 onion", "Stew")], []);
  assert.deepEqual(steps(plan.steps), ["+ 2 onions [Soup, Stew]"]);
  assert.deepEqual([plan.added, plan.addedUp, plan.skipped], [1, 0, 0]);
});

test("a line from before shares is read as its recipe's, or as typed in", () => {
  assert.deepEqual(sharesOf({ text: "2 onions", recipe: "r", shares: null, expand: { recipe: { title: "Soup" } } }), [
    { recipe: "r", title: "Soup", text: "2 onions" },
  ]);
  assert.deepEqual(sharesOf({ text: "Milk", recipe: "", shares: [] }), [{ recipe: "", title: "", text: "Milk" }]);
});

test("the same thing from two recipes adds up", () => {
  // From a tester's two stews.
  assert.equal(addedUp("3 garlic cloves", "2 garlic cloves"), "5 garlic cloves");
  assert.equal(addedUp("1 onion", "1 large onion"), "2 onions");
  assert.equal(addedUp("1 large onion", "1 onion"), "2 onions");
  assert.equal(addedUp("1 small onion", "1 large onion"), "2 onions");
  assert.equal(addedUp("3 carrots", "3 carrots"), "6 carrots");
  // Counts: the plural from whichever has it, or on the right word.
  assert.equal(addedUp("1 egg", "2 eggs"), "3 eggs");
  assert.equal(addedUp("2 cloves garlic", "3 garlic cloves"), "5 cloves garlic");
  assert.equal(addedUp("1 clove garlic", "1 clove garlic"), "2 cloves garlic");
  assert.equal(addedUp("1 garlic clove", "1 garlic clove"), "2 garlic cloves");
  assert.equal(addedUp("1 can coconut milk", "1 can coconut milk"), "2 cans coconut milk");
  assert.equal(addedUp("1 bay leaf", "1 bay leaf"), "2 bay leaves");
  assert.equal(addedUp("1 pinch salt", "1 pinch salt"), "2 pinches salt");
  assert.equal(addedUp("1 knob of butter", "1 knob of butter"), "2 knobs of butter");
  assert.equal(addedUp("1 bunch coriander", "1 bunch coriander"), "2 bunches coriander");
  // A pack size stays, and has to match.
  assert.equal(addedUp("2 (400 g) cans chickpeas", "1 (400 g) can chickpeas"), "3 (400 g) cans chickpeas");
  assert.equal(addedUp("1 (400 g) can tomatoes", "1 (400 g) can tomatoes"), "2 (400 g) cans tomatoes");
  // Units of one kind, written the bigger way.
  assert.equal(addedUp("200 g cherry tomatoes", "100 g cherry tomatoes"), "300 g cherry tomatoes");
  assert.equal(addedUp("200g cherry tomatoes", "100g cherry tomatoes"), "300g cherry tomatoes");
  assert.equal(addedUp("1 kg potatoes", "500 g potatoes"), "1.5 kg potatoes");
  assert.equal(addedUp("500 g potatoes", "1 kg potatoes"), "1.5 kg potatoes");
  assert.equal(addedUp("1 gallon milk", "2 gallons milk"), "3 gallons milk");
  // The same amount given another way changes with it.
  assert.equal(addedUp("1/2 cup (100 g) sun dried tomatoes", "1/4 cup sun dried tomatoes"), "¾ cup (150 g) sun dried tomatoes");
  assert.equal(addedUp("250 g/8 oz butter", "250 g/8 oz butter"), "500 g/16 oz butter");
  assert.equal(addedUp("1 cup milk", "1 cup milk"), "2 cups milk");
  // A kind in brackets stays, when both say it.
  assert.equal(addedUp("1 cup flour (plain)", "1 cup flour (plain)"), "2 cups flour (plain)");
});

test("different things, or amounts that don't add up, stay apart", () => {
  assert.equal(addedUp("2 red onions", "1 onion"), null);
  assert.equal(addedUp("3 sprigs fresh thyme", "1 tsp dried thyme"), null);
  assert.equal(addedUp("1 cup flour", "200 g flour"), null);
  assert.equal(addedUp("1 tsp salt", "1 tbsp salt"), null);
  assert.equal(addedUp("Salt", "1 tsp salt"), null);
  assert.equal(addedUp("2-3 onions", "1 onion"), null);
  assert.equal(addedUp("1 cup plus 2 tbsp flour", "1 cup flour"), null);
  assert.equal(addedUp("2 garlic cloves", "2 garlic bulbs"), null);
  // Kinds and sizes that differ: buying one of them would be wrong.
  assert.equal(addedUp("1 cup flour (plain)", "1 cup flour (self-raising)"), null);
  assert.equal(addedUp("1 cup flour (plain)", "1 cup flour"), null);
  assert.equal(addedUp("1 (400 g) can tomatoes", "1 (800 g) can tomatoes"), null);
  assert.equal(addedUp("1 small can coconut milk", "1 large can coconut milk"), null);
  // Another number further on wouldn't change with the total.
  assert.equal(addedUp("3 sprigs fresh thyme (or 1/2 tsp dried thyme)", "2 sprigs fresh thyme"), null);
  assert.equal(addedUp("200g cherry tomatoes (1 punnet)", "200g cherry tomatoes (1 punnet)"), null);
  assert.equal(addedUp("1 can tomatoes (or 4 fresh tomatoes)", "1 can tomatoes"), null);
  assert.equal(addedUp("2 eggs", "1 egg yolk"), null);
  assert.equal(addedUp("Juice of 1 lemon", "Juice of 1 lemon"), null);
});
