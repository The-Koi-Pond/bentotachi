// The shopping list by aisle, in the order most supermarkets are walked:
// fresh food first, frozen last. Things linked to a pantry item go where
// the pantry keeps them (Fridge → Dairy, Cupboard → Spices, anything in the
// Freezer); everything else is guessed from its name, and what can't be
// guessed goes under Other.

// A word (or two-word name) in the text as a whole word, singular or plural:
// "onion" in "2 onions", "berry" in "berries", but "can" not in "pecans" and
// "egg" not in "eggplant". (Not wordMatch.ts: its rule that "rice vinegar"
// isn't vinegar is right for pantry links, but here the vinegar decides.)
function hasWord(text: string, word: string): boolean {
  const escaped = word.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const forms = escaped.endsWith("y") ? `(?:${escaped}|${escaped.slice(0, -1)}ies)` : `${escaped}(?:e?s)?`;
  return new RegExp(`(?<![a-z])${forms}(?![a-z])`, "i").test(text);
}

export const AISLES = [
  "Fruit & veg",
  "Bakery",
  "Meat & fish",
  "Dairy & eggs",
  "Pasta, rice & grains",
  "Tins & jars",
  "Sauces & oils",
  "Baking & spices",
  "Snacks & drinks",
  "Frozen",
  "Household",
  "Other",
] as const;

export type Aisle = (typeof AISLES)[number];

// Two-word names first, so "red pepper" is veg though "pepper" is a spice,
// and "coconut milk" is a tin though "milk" is dairy.
const PHRASES: [Aisle, string[]][] = [
  ["Fruit & veg", ["bell pepper", "red pepper", "green pepper", "yellow pepper", "green bean", "spring onion", "sweet potato", "snow pea", "bean sprout"]],
  ["Dairy & eggs", ["sour cream", "cream cheese", "oat milk", "almond milk", "soy milk"]],
  ["Tins & jars", ["coconut milk", "coconut cream", "tomato paste", "tomato puree", "baked bean", "peanut butter"]],
  ["Sauces & oils", ["soy sauce", "fish sauce", "lemon juice", "lime juice"]],
  ["Baking & spices", ["baking soda", "baking powder", "black pepper", "bicarb soda", "brown sugar", "icing sugar", "caster sugar"]],
  ["Frozen", ["ice cream", "ice block"]],
  ["Household", ["toilet paper", "paper towel", "dish soap", "bin bag", "cling wrap", "baking paper"]],
];

// Then single words, most telling first: "frozen peas" is frozen, "tinned
// tomatoes" a tin, "garlic bread" bakery, before any veg is looked for.
const WORDS: [Aisle, string[]][] = [
  ["Household", ["detergent", "soap", "shampoo", "conditioner", "toothpaste", "tissue", "foil", "sponge", "bleach", "battery"]],
  ["Frozen", ["frozen"]],
  ["Tins & jars", ["tinned", "canned", "tin", "can", "jar", "chickpea", "lentil", "bean", "tuna", "stock", "broth", "passata"]],
  ["Bakery", ["bread", "roll", "bun", "wrap", "tortilla", "bagel", "croissant", "pita", "sourdough", "baguette", "crumpet"]],
  ["Sauces & oils", ["oil", "vinegar", "sauce", "ketchup", "mayonnaise", "mayo", "mustard", "honey", "jam", "chutney", "salsa", "dressing", "relish", "sriracha"]],
  ["Baking & spices", ["flour", "sugar", "yeast", "cocoa", "vanilla", "salt", "pepper", "cumin", "paprika", "cinnamon", "turmeric", "oregano", "nutmeg", "spice", "powder", "flake", "cornflour", "cornstarch"]],
  ["Snacks & drinks", ["chip", "crisp", "biscuit", "cookie", "chocolate", "cracker", "nut", "pecan", "walnut", "almond", "cashew", "peanut", "juice", "soda", "lemonade", "coffee", "tea", "water", "wine", "beer", "cereal", "muesli"]],
  ["Dairy & eggs", ["milk", "cheese", "butter", "yoghurt", "yogurt", "cream", "egg", "feta", "parmesan", "mozzarella", "cheddar", "ricotta", "halloumi"]],
  ["Meat & fish", ["chicken", "beef", "mince", "pork", "lamb", "bacon", "ham", "sausage", "steak", "turkey", "fish", "salmon", "prawn", "shrimp", "chorizo", "salami"]],
  ["Pasta, rice & grains", ["pasta", "spaghetti", "penne", "fusilli", "lasagne", "lasagna", "noodle", "rice", "oat", "couscous", "quinoa"]],
  ["Fruit & veg", [
    "onion", "garlic", "potato", "carrot", "tomato", "lettuce", "spinach", "kale", "cabbage", "broccoli", "cauliflower", "zucchini", "courgette",
    "capsicum", "cucumber", "celery", "mushroom", "pumpkin", "corn", "pea", "eggplant", "aubergine", "leek", "ginger", "chilli", "chili",
    "avocado", "apple", "banana", "lemon", "lime", "orange", "berry", "strawberry", "blueberry", "grape", "mango", "pear", "peach",
    "coriander", "cilantro", "parsley", "basil", "mint", "thyme", "rosemary", "dill", "herb", "salad", "rocket", "shallot",
  ]],
];

// Where a pantry place and subcategory are in the shop.
const PANTRY_AISLES: Record<string, Aisle> = {
  dairy: "Dairy & eggs",
  "meat & fish": "Meat & fish",
  "fruit & veg": "Fruit & veg",
  "sauces & condiments": "Sauces & oils",
  drinks: "Snacks & drinks",
  baking: "Baking & spices",
  spices: "Baking & spices",
  "grains & pasta": "Pasta, rice & grains",
  "tins & jars": "Tins & jars",
  "oils & vinegars": "Sauces & oils",
  snacks: "Snacks & drinks",
  // Shelves households often make themselves.
  noodles: "Pasta, rice & grains",
  sauce: "Sauces & oils",
  sauces: "Sauces & oils",
  condiments: "Sauces & oils",
  "spreads & syrups": "Tins & jars",
  spreads: "Tins & jars",
  juice: "Snacks & drinks",
};

// The aisle a name sounds like, or Other.
export function guessAisle(name: string): Aisle {
  for (const [aisle, phrases] of PHRASES) if (phrases.some((phrase) => hasWord(name, phrase))) return aisle;
  for (const [aisle, words] of WORDS) if (words.some((word) => hasWord(name, word))) return aisle;
  return "Other";
}

// A shopping item's aisle: its pantry item's place if it's linked to one
// the pantry has sorted, otherwise a guess from its name.
export function aisleOf(text: string, pantryItem?: { name: string; location: string; subcategory: string }): Aisle {
  if (pantryItem) {
    if (pantryItem.location.trim().toLowerCase() === "freezer") return "Frozen";
    const known = PANTRY_AISLES[pantryItem.subcategory.trim().toLowerCase()];
    if (known) return known;
    const guess = guessAisle(pantryItem.name);
    if (guess !== "Other") return guess;
  }
  return guessAisle(text);
}

// Things grouped by aisle in walking order, keeping each group's own order;
// empty aisles are left out.
export function byAisle<T>(things: T[], aisle: (thing: T) => Aisle): { aisle: Aisle; things: T[] }[] {
  const groups = new Map<Aisle, T[]>();
  for (const thing of things) {
    const name = aisle(thing);
    groups.set(name, [...(groups.get(name) ?? []), thing]);
  }
  return AISLES.filter((name) => groups.has(name)).map((name) => ({ aisle: name, things: groups.get(name)! }));
}
