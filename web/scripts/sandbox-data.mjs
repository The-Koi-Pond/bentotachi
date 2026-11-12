// The made-up household `npm run sandbox` starts with: two members, recipes,
// a pantry, a shopping list, this week's plan and fridge notes. Made-up
// names only (the repository is public). Change it freely; the sandbox
// fills a fresh server from it each time it starts. The shelves are the
// ones every new server gets (the recipe_categories migration), and the
// recipes' tags fill some of them, leaving two bare.

// Both members log in with this. It's only for the sandbox's throwaway
// server, never a real one.
export const PASSWORD = "sandbox-tries";

export const MEMBERS = [
  { username: "sam", name: "Sam" },
  { username: "alex", name: "Alex" },
];

export const RECIPES = [
  {
    title: "Pumpkin soup",
    description: "Thick, sweet and ready in half an hour.",
    servings: "4 servings",
    prep_minutes: 10,
    cook_minutes: 25,
    ingredients: ["1 kg pumpkin, peeled and cubed", "1 onion, chopped", "2 cloves garlic", "750 ml chicken stock", "1/2 cup cream"],
    steps: ["Soften the onion and garlic in a little oil for 5 minutes.", "Add the pumpkin and stock and simmer for 20 minutes.", "Blend until smooth, then stir in the cream."],
    tags: ["soup", "dinner", "quick"],
    notes: "Freezes well without the cream.",
  },
  {
    title: "Chicken curry",
    description: "Mild, for everyone.",
    servings: "4 servings",
    total_minutes: 40,
    ingredients: ["# Paste", "2 tbsp curry paste", "1 tsp ground cumin", "# Curry", "500 g chicken thighs", "400 ml coconut milk", "1 and 1/2 cups frozen peas"],
    steps: ["# Paste", "Fry the paste and cumin for 1 minute.", "# Curry", "Add the chicken and brown it.", "Pour in the coconut milk and simmer for 20 minutes.", "Add the peas for the last 5 minutes."],
    tags: ["dinner", "one-pot"],
    notes: "Serve with rice.",
  },
  {
    title: "Beef stew",
    description: "Better the next day.",
    servings: "6 servings",
    total_minutes: 150,
    ingredients: ["1 kg chuck steak", "3 carrots", "2 onions", "2 tbsp flour", "500 ml beef stock"],
    steps: ["Toss the beef in the flour and brown it in batches.", "Add the vegetables and stock.", "Simmer gently for 2 hours."],
    tags: ["dinner", "stew"],
  },
  {
    title: "Tomato soup",
    description: "",
    servings: "2 servings",
    total_minutes: 25,
    ingredients: ["800 g tinned tomatoes", "1 onion", "1 tsp sugar", "salt and pepper"],
    steps: ["Cook the onion until soft.", "Add the tomatoes and sugar and simmer for 15 minutes.", "Blend and season."],
    tags: ["soup", "quick"],
  },
  {
    title: "Garlic bread",
    description: "Crunchy outside, soft inside.",
    servings: "4 servings",
    total_minutes: 15,
    ingredients: ["1 baguette", "3 cloves garlic", "50 g butter, softened"],
    steps: ["Mash the garlic into the butter.", "Spread it into cuts in the bread and bake for 10 minutes."],
    tags: ["side", "quick"],
  },
  {
    title: "Plain rice",
    description: "",
    servings: "4 servings",
    total_minutes: 15,
    ingredients: ["2 cups jasmine rice", "3 cups water"],
    steps: ["Rinse the rice, then simmer it covered for 12 minutes.", "Rest for 5 minutes off the heat."],
    tags: ["side"],
  },
  {
    title: "Chocolate cake",
    description: "Rich and dark.",
    servings: "12 slices",
    total_minutes: 60,
    ingredients: ["200 g plain flour", "200 g caster sugar", "50 g cocoa", "2 eggs", "1 cup milk"],
    steps: ["Mix the dry things, then the wet.", "Bake at 180°C for 40 minutes."],
    tags: ["dessert"],
  },
  {
    // On no shelf: shows in "One list" and under search only.
    title: "Pancakes",
    description: "Weekend breakfast.",
    servings: "8 pancakes",
    total_minutes: 20,
    ingredients: ["1 cup self-raising flour", "1 egg", "3/4 cup milk"],
    steps: ["Whisk it all together.", "Cook spoonfuls for 2 minutes a side."],
    tags: ["breakfast"],
  },
];

// [name, place, subcategory, Have / Low / Out, use-by in days from today or null]
export const PANTRY = [
  ["Milk", "Fridge", "Dairy", "have", 4],
  ["Butter", "Fridge", "Dairy", "have", null],
  ["Cream", "Fridge", "Dairy", "low", 1],
  ["Eggs", "Fridge", "", "have", 12],
  ["Plain flour", "Cupboard", "Baking", "have", null],
  ["Caster sugar", "Cupboard", "Baking", "low", null],
  ["Jasmine rice", "Cupboard", "Grains & pasta", "have", null],
  ["Coconut milk", "Cupboard", "Tins & jars", "out", null],
  ["Frozen peas", "Freezer", "", "have", null],
  ["Ice cream", "Freezer", "", "have", null],
];

// [text, ticked]
export const SHOPPING = [
  ["Bananas", false],
  ["Bread", false],
  ["Coffee", true],
];

// Another shopping list beside the main one, and what's on it.
export const OTHER_LIST = { name: "Party", items: ["Candles", "Sparkling water", "Bananas"] };

// [days from today, meal, recipe title]
export const PLAN = [
  [-1, "dinner", "Beef stew"],
  [0, "dinner", "Chicken curry"],
  [0, "dinner", "Plain rice"],
  [1, "dinner", "Pumpkin soup"],
  [3, "dinner", "Tomato soup"],
];

// [member's username, text]
export const NOTES = [
  ["alex", "Don't buy eggs, I got a dozen."],
  ["sam", "Defrost the chicken tonight."],
];
