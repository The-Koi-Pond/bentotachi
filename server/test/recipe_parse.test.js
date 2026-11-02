// Run from the project folder with: node --test "server/test/*.test.js"
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseRecipe, durationToMinutes } = require("../pb_hooks/recipe_parse.js");

function page(jsonLd, extraHead = "") {
  const scripts = [].concat(jsonLd).map(
    (block) => `<script type="application/ld+json">${typeof block === "string" ? block : JSON.stringify(block)}</script>`
  );
  return `<html><head>${extraHead}${scripts.join("")}</head><body>hi</body></html>`;
}

test("reads a recipe nested in an @graph list (WordPress/Yoast style)", () => {
  const html = page({
    "@context": "https://schema.org",
    "@graph": [
      { "@type": "WebPage", name: "Not this" },
      {
        "@type": "Recipe",
        name: "Mum&amp;#39;s Lentil Soup",
        description: "<p>Cosy &amp; quick.</p>",
        image: [{ "@type": "ImageObject", url: "https://example.com/soup.jpg" }],
        recipeYield: ["4", "4 servings"],
        prepTime: "PT15M",
        cookTime: "PT1H",
        totalTime: "PT1H15M",
        recipeIngredient: ["1 cup red lentils", "  2 carrots ((diced)) ", ""],
        recipeInstructions: [
          { "@type": "HowToStep", text: "Rinse the lentils." },
          { "@type": "HowToStep", name: "Simmer", text: "Simmer for <b>40</b> minutes." },
        ],
        recipeCategory: "Soup",
        recipeCuisine: ["British", "soup"],
      },
    ],
  });

  const recipe = parseRecipe(html, "https://example.com/soup");
  assert.equal(recipe.title, "Mum's Lentil Soup");
  assert.equal(recipe.description, "Cosy & quick.");
  assert.equal(recipe.imageUrl, "https://example.com/soup.jpg");
  assert.equal(recipe.servings, "4 servings");
  assert.equal(recipe.prepMinutes, 15);
  assert.equal(recipe.cookMinutes, 60);
  assert.equal(recipe.totalMinutes, 75);
  assert.deepEqual(recipe.ingredients, ["1 cup red lentils", "2 carrots (diced)"]);
  assert.deepEqual(recipe.steps, ["Rinse the lentils.", "Simmer for 40 minutes."]);
  assert.deepEqual(recipe.tags, ["soup", "british"]);
  assert.equal(recipe.sourceUrl, "https://example.com/soup");
});

test("turns instruction sections into # headings", () => {
  const html = page({
    "@type": "Recipe",
    name: "Pasta",
    recipeInstructions: [
      {
        "@type": "HowToSection",
        name: "For the sauce",
        itemListElement: [{ "@type": "HowToStep", text: "Fry garlic." }],
      },
      {
        "@type": "HowToSection",
        name: "To serve",
        itemListElement: [{ "@type": "HowToStep", text: "Add basil." }],
      },
    ],
  });

  assert.deepEqual(parseRecipe(html, "https://example.com/p").steps, [
    "# For the sauce",
    "Fry garlic.",
    "# To serve",
    "Add basil.",
  ]);
});

test("splits one block of instruction text into steps", () => {
  const html = page({
    "@type": ["Recipe", "NewsArticle"],
    name: "Toast",
    recipeInstructions: "Slice bread.\nToast it.<br/>Butter it.",
  });

  assert.deepEqual(parseRecipe(html, "https://example.com/t").steps, ["Slice bread.", "Toast it.", "Butter it."]);
});

test("falls back to the page's preview image, and fixes relative links", () => {
  const withMeta = page({ "@type": "Recipe", name: "A" }, '<meta property="og:image" content="/img/a.png">');
  assert.equal(parseRecipe(withMeta, "https://example.com/recipes/a").imageUrl, "https://example.com/img/a.png");

  const protocolRelative = page({ "@type": "Recipe", name: "B", image: "//cdn.example.com/b.jpg" });
  assert.equal(parseRecipe(protocolRelative, "https://example.com/b").imageUrl, "https://cdn.example.com/b.jpg");
});

test("skips broken data blocks and still finds the recipe", () => {
  const html = page(["{ this is not json", { "@type": "Recipe", name: "Survivor" }]);
  assert.equal(parseRecipe(html, "https://example.com/s").title, "Survivor");
});

test("returns null when the page has no recipe data", () => {
  assert.equal(parseRecipe("<html><body>No recipe here</body></html>", "https://example.com"), null);
  assert.equal(parseRecipe(page({ "@type": "Article", name: "News" }), "https://example.com"), null);
});

test("reads standard durations", () => {
  assert.equal(durationToMinutes("PT90M"), 90);
  assert.equal(durationToMinutes("P0DT1H5M"), 65);
  assert.equal(durationToMinutes("PT30S"), 1);
  assert.equal(durationToMinutes("20 minutes"), 0);
  assert.equal(durationToMinutes(undefined), 0);
});

test("reads a microdata recipe (EasyRecipe style) when there's no JSON-LD", () => {
  const html = `<html><head><meta property="og:image" content="https://example.com/full.jpg"></head><body>
    <div class="easyrecipe" itemscope itemtype="http://schema.org/Recipe">
      <div itemprop="aggregateRating" itemscope itemtype="http://schema.org/AggregateRating"><span itemprop="ratingValue">4.9</span></div>
      <div itemprop="name">Spicy Chicken Bowls</div>
      <img itemprop="image" src="https://example.com/thumb-320x320.jpg">
      <time itemprop="prepTime" datetime="PT10M">10 mins</time>
      <time itemprop="totalTime" datetime="PT45M">45 mins</time>
      <div itemprop="description">Healthy &amp; quick.</div>
      <div>Author: <span itemprop="author" itemscope itemtype="http://schema.org/Person"><span itemprop="name">Ally</span></span></div>
      <span itemprop="recipeYield">4 servings</span>
      <ul>
        <li itemprop="ingredients">For the chicken:</li>
        <li itemprop="ingredients">1&frac12; tsp paprika</li>
        <li itemprop="ingredients">.</li>
        <li itemprop="ingredients">Fresh <b>fruit</b></li>
      </ul>
      <ol>
        <li itemprop="recipeInstructions">Preheat the oven.</li>
        <li itemprop="recipeInstructions">Bake for <strong>25</strong> minutes.</li>
      </ol>
    </div></body></html>`;

  const recipe = parseRecipe(html, "https://example.com/bowls");
  assert.equal(recipe.title, "Spicy Chicken Bowls");
  assert.equal(recipe.description, "Healthy & quick.");
  assert.equal(recipe.imageUrl, "https://example.com/full.jpg");
  assert.equal(recipe.servings, "4 servings");
  assert.equal(recipe.prepMinutes, 10);
  assert.equal(recipe.totalMinutes, 45);
  assert.deepEqual(recipe.ingredients, ["# For the chicken", "1½ tsp paprika", "Fresh fruit"]);
  assert.deepEqual(recipe.steps, ["Preheat the oven.", "Bake for 25 minutes."]);
});

test("uses a microdata recipe's own photo when the page has no preview image", () => {
  const html = `<div itemscope itemtype="https://schema.org/Recipe"><h2 itemprop="name">Toast</h2>
    <img itemprop="image" data-src="/img/toast.jpg" src="data:,"><meta itemprop="recipeIngredient" content="Bread"></div>`;
  const recipe = parseRecipe(html, "https://example.com/toast");
  // A content="" value is read, and a blank placeholder src is skipped for the real one.
  assert.deepEqual(recipe.ingredients, ["Bread"]);
  assert.equal(recipe.title, "Toast");
  assert.equal(recipe.imageUrl, "https://example.com/img/toast.jpg");
});

test("reads the older data-vocabulary.org recipe labels", () => {
  const html = `<div itemscope itemtype="http://data-vocabulary.org/Recipe">
    <h1 itemprop="name">Old Soup</h1><p itemprop="summary">From 2012.</p>
    <span itemprop="yield">2 bowls</span>
    <span itemprop="ingredient">1 onion</span><span itemprop="ingredient">Water</span>
    <div itemprop="instructions"><ol><li>Chop.</li><li>Boil.</li></ol></div></div>`;
  const recipe = parseRecipe(html, "https://example.com/old");
  assert.equal(recipe.title, "Old Soup");
  assert.equal(recipe.description, "From 2012.");
  assert.equal(recipe.servings, "2 bowls");
  assert.deepEqual(recipe.ingredients, ["1 onion", "Water"]);
  assert.deepEqual(recipe.steps, ["Chop.", "Boil."]);
});

test("JSON-LD still wins over microdata on the same page", () => {
  const html = page({ "@type": "Recipe", name: "From JSON-LD" }) +
    `<div itemscope itemtype="http://schema.org/Recipe"><span itemprop="name">From microdata</span></div>`;
  assert.equal(parseRecipe(html, "https://example.com/both").title, "From JSON-LD");
});

test("finds recipe data that a script adds to the page later (PureWow style)", () => {
  const data = [{ "@context": "https://schema.org/", "@type": "Recipe", name: "Coconut Curry", recipeIngredient: ["1 can chickpeas"] }];
  const html = `<html><head><script>
    const recipeSchema = window.document.createElement("script");
    recipeSchema.type = "application/ld+json";
    recipeSchema.innerHTML = JSON.stringify(${JSON.stringify(data)});
    if (${JSON.stringify(data)}.length) { loadThings(); }
  </script></head><body></body></html>`;
  const recipe = parseRecipe(html, "https://example.com/curry");
  assert.equal(recipe.title, "Coconut Curry");
  assert.deepEqual(recipe.ingredients, ["1 can chickpeas"]);
});

test("splits numbered steps that run together, and drops their numbers", () => {
  const steps = (text) => parseRecipe(page({ "@type": "Recipe", name: "x", recipeInstructions: text }), "https://e.com").steps;
  assert.deepEqual(steps("1. Heat the oil, about 1 minute.2. Add 1.5 cups of rice. 3. Serve."), [
    "Heat the oil, about 1 minute.",
    "Add 1.5 cups of rice.",
    "Serve.",
  ]);
  // Not a numbered list: left as one step.
  assert.deepEqual(steps("Bake at 350. Then rest for 2. Serve."), ["Bake at 350. Then rest for 2. Serve."]);
  assert.deepEqual(steps("1. Mix. 3. Bake."), ["Mix. 3. Bake."]);
  // Separate steps that each start with their number.
  assert.deepEqual(
    parseRecipe(page({ "@type": "Recipe", name: "y", recipeInstructions: [{ "@type": "HowToStep", text: "1) Chop." }, { "@type": "HowToStep", text: "2) Fry." }] }), "https://e.com").steps,
    ["Chop.", "Fry."]
  );
});

test("recognises photos by their first bytes, whatever the website calls them", () => {
  const { imageExtension } = require("../pb_hooks/recipe_parse.js");
  const bytes = (...values) => values.flatMap((v) => (typeof v === "string" ? [...v].map((c) => c.charCodeAt(0)) : [v]));
  // PocketBase checks what a file really is, so a site's label alone isn't
  // enough: a "photo" that's really a web page would fail the whole import.
  assert.equal(imageExtension("image/jpeg", bytes("<!doctype html>")), "");
  assert.equal(imageExtension("image/png; charset=binary", []), "");
  assert.equal(imageExtension("image/jpeg", bytes(0x89, "PNG", 0x0d, 0x0a)), "png");
  assert.equal(imageExtension("binary/octet-stream", bytes(0xff, 0xd8, 0xff, 0xe0)), "jpg");
  assert.equal(imageExtension("application/octet-stream", bytes(0x89, "PNG", 0x0d, 0x0a)), "png");
  assert.equal(imageExtension("", bytes("GIF89a")), "gif");
  assert.equal(imageExtension("", bytes("RIFF", 0, 0, 0, 0, "WEBP")), "webp");
  assert.equal(imageExtension("", bytes(0, 0, 0, 0x1c, "ftypavif")), "avif");
  assert.equal(imageExtension("text/html", bytes("<!doctype html>")), "");
  assert.equal(imageExtension("binary/octet-stream", []), "");
});

test("an imported recipe is cut to fit what the database keeps", () => {
  const { fitRecipe, LIMITS } = require("../pb_hooks/recipe_parse.js");
  const recipe = {
    title: "T".repeat(400),
    description: "Once upon a time. ".repeat(400),
    servings: "Serves ".repeat(30),
    authorNotes: "n".repeat(25000),
    ingredients: ["1 egg"],
    steps: Array.from({ length: 5000 }, (_, i) => `Step ${i}: stir the pot for a while and taste it again.`),
    tags: ["dinner"],
  };
  const fitted = fitRecipe(recipe);
  assert.equal([...fitted.title].length, LIMITS.title);
  assert.ok(fitted.title.endsWith("…"));
  assert.ok([...fitted.description].length <= LIMITS.description);
  assert.ok([...fitted.servings].length <= LIMITS.servings);
  assert.ok([...fitted.authorNotes].length <= LIMITS.authorNotes);
  assert.ok(Buffer.byteLength(JSON.stringify(fitted.steps)) <= LIMITS.listBytes);
  assert.ok(fitted.steps.length > 1000, "keeps as many steps as fit");
  assert.equal(fitted.steps[0], recipe.steps[0]);
  // Ones that fit are left exactly as they were.
  assert.deepEqual(fitted.ingredients, ["1 egg"]);
  assert.deepEqual(fitted.tags, ["dinner"]);
  const small = { title: "Soup", description: "Hot.", servings: "4", authorNotes: "", ingredients: [], steps: [], tags: [] };
  assert.deepEqual(fitRecipe(small), small);
  // Emoji count as one character each, and are never cut in half.
  const emoji = fitRecipe({ ...small, title: "🍲".repeat(400) }).title;
  assert.equal([...emoji].length, LIMITS.title);
  assert.ok(!/[\ud800-\udbff]…$/.test(emoji));
});

test("reads a recipe written as ordinary text in a blog post", () => {
  const html = `<html><head><meta property="og:title" content="Gochujang Spaghetti -">
    <meta property="og:image" content="https://example.com/pasta.jpg"></head><body>
    <div class="entry-content wp-block-post-content">
      <p>A long story about my week, which mentions the ingredients I love.</p>
      <p><strong>Ingredients:</strong></p>
      <p>350 grams of mushrooms<br>2 tbsp of <a href="#">gochujang</a> , or more<br>For the sauce:<br>1 cup of milk<br>Salt to taste</p>
      <p>Preheat the oven to 200C and grease a large tin.</p>
      <p>Cook the pasta. Then stir everything together until creamy.</p>
      <p>Related posts:</p><p>Mochi donuts</p>
    </div><div class="comments">Great recipe! I made it twice.</div></body></html>`;
  const recipe = parseRecipe(html, "https://example.com/pasta");
  assert.equal(recipe.title, "Gochujang Spaghetti");
  assert.equal(recipe.imageUrl, "https://example.com/pasta.jpg");
  assert.deepEqual(recipe.ingredients, ["350 grams of mushrooms", "2 tbsp of gochujang, or more", "# For the sauce", "1 cup of milk", "Salt to taste"]);
  assert.deepEqual(recipe.steps, ["Preheat the oven to 200C and grease a large tin.", "Cook the pasta. Then stir everything together until creamy."]);
});

test("a plain-text recipe can have a Method heading", () => {
  const html = `<article><h2>Ingredients</h2><ul><li>2 eggs</li><li>1 cup flour</li></ul>
    <h2>Method</h2><p>Whisk.</p><p>Bake for twenty minutes.</p><p>Share this:</p><p>Twitter</p></article>`;
  const recipe = parseRecipe(html, "https://example.com/cake");
  assert.deepEqual(recipe.ingredients, ["2 eggs", "1 cup flour"]);
  // "Whisk." is too short to count as a step; the share links are left out.
  assert.deepEqual(recipe.steps, ["Bake for twenty minutes."]);
});

test("doesn't mistake a post that just mentions ingredients for a recipe", () => {
  const story = `<div class="entry-content"><p>Ingredients</p><p>Fresh things matter.</p><p>I went to the market today and bought lots of lovely things.</p></div>`;
  assert.equal(parseRecipe(story, "https://example.com/story"), null);
});

const RECIPE_DATA = `<script type="application/ld+json">{"@type":"Recipe","name":"Soup","recipeIngredient":["1 onion"],"recipeInstructions":["Simmer."]}</script>`;

test("keeps the recipe writer's notes from WP Recipe Maker's notes box", () => {
  const html = `${RECIPE_DATA}
    <div class="wprm-recipe-notes-container wprm-block-text-normal"><h3 class="wprm-recipe-header">Notes</h3>
      <div class="wprm-recipe-notes"><span style="display: block;">1. <strong>Stock</strong> – use chicken or vegetable.</span><span style="display: block;">2. Keeps 3 days in the fridge.</span></div></div>`;
  assert.equal(parseRecipe(html, "https://example.com/soup").authorNotes, "1. Stock – use chicken or vegetable.\n2. Keeps 3 days in the fridge.");
});

test("keeps Tasty Recipes notes without their heading", () => {
  const html = `${RECIPE_DATA}<div class="tasty-recipes-notes"><h3>Notes</h3><p>Swap the cream for coconut milk.</p><ul><li>Freezes well.</li></ul></div>`;
  assert.equal(parseRecipe(html, "https://example.com/soup").authorNotes, "Swap the cream for coconut milk.\nFreezes well.");
});

test("a recipe without a notes box has no author's notes", () => {
  assert.equal(parseRecipe(RECIPE_DATA, "https://example.com/soup").authorNotes, "");
});

test("drops the stray comma WP Recipe Maker puts inside ingredient brackets", () => {
  const html = `<script type="application/ld+json">{"@type":"Recipe","name":"Bibimbap","recipeIngredient":["1 garlic clove (, finely grated)","2 carrots (, large, cut into batons)","1 tbsp honey ( , )","4 eggs"],"recipeInstructions":["Cook."]}</script>`;
  assert.deepEqual(parseRecipe(html, "https://example.com/b").ingredients, [
    "1 garlic clove (finely grated)",
    "2 carrots (large, cut into batons)",
    "1 tbsp honey",
    "4 eggs",
  ]);
});
