/// <reference path="../pb_data/types.d.ts" />

// Recipe categories: the shelves on the Recipes page. A category is a name
// and the tags that count for it, since recipes imported from websites
// name the same thing many ways ("main course", "mains", "main dish"…).
// Shared by the household: anyone logged in can add, change and remove
// them. A new server starts with a few common ones.

const STARTERS = [
  ["Mains", ["main course", "main courses", "mains", "main", "main dish", "main dishes", "main meals", "dinner", "supper", "entree", "entrée"]],
  ["Sides", ["side", "sides", "side dish", "side dishes"]],
  ["Soups & stews", ["soup", "soups", "stew", "stews"]],
  ["Desserts", ["dessert", "desserts", "sweets", "baking"]],
  ["One-pot", ["one-pot", "one pot", "one-pan", "one pan", "sheet pan"]],
  ["Instant Pot", ["instant pot", "pressure cooker", "pressure cooker {instant pot}"]],
  ["Starters & snacks", ["appetizer", "appetizers", "appetiser", "appetisers", "starter", "starters", "snack", "snacks"]],
];

migrate((app) => {
  const loggedIn = '@request.auth.id != ""';

  const categories = new Collection({
    type: "base",
    name: "recipe_categories",
    listRule: loggedIn,
    viewRule: loggedIn,
    createRule: loggedIn,
    updateRule: loggedIn,
    deleteRule: loggedIn,
    fields: [
      { name: "name", type: "text", required: true, max: 40 },
      // Lowercase tags; a recipe with any of them is in the category.
      { name: "tags", type: "json", maxSize: 20000 },
      // Shelves are shown smallest first.
      { name: "position", type: "number", onlyInt: true },
      { name: "created", type: "autodate", onCreate: true },
      { name: "updated", type: "autodate", onCreate: true, onUpdate: true },
    ],
  });
  app.save(categories);

  STARTERS.forEach(([name, tags], index) => {
    const record = new Record(categories);
    record.set("name", name);
    record.set("tags", tags);
    record.set("position", index);
    app.save(record);
  });
}, (app) => {
  app.delete(app.findCollectionByNameOrId("recipe_categories"));
});
