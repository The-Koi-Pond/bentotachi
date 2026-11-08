// Run from the project folder with: node --test "server/test/*.test.js"
const test = require("node:test");
const assert = require("node:assert/strict");
const { parseRecipe, durationToMinutes, linkKey, recipeLinks } = require("../pb_hooks/recipe_parse.js");

// A WordPress-style category page: one <article> card per recipe.
const card = (slug, title, extra = "") =>
  `<article class="post entry" aria-label="${title}"><a class="entry-image-link" href="https://www.site.example/${slug}/">` +
  `<img src="data:image/gif;base64,R0lGOD" data-src="/photos/${slug}.jpg" alt="${title}"></a>` +
  `<h2 class="entry-title"><a href="https://www.site.example/${slug}/">${title}</a></h2>` +
  `<a href="https://www.site.example/category/dinner/">Dinner</a>${extra}</article>`;
const categoryPage = (cards, head = "") =>
  `<html><head><title>Quick and Easy Archives - Site</title>${head}</head><body><main>${cards.join("")}</main></body></html>`;

test("a category page gives its recipes: link, name, photo and the next page", () => {
  const list = recipeLinks(
    categoryPage(
      [card("butter-chicken", "Butter Chicken"), card("aglio-e-olio", "Aglio e Olio &amp; Chilli"), card("butter-chicken", "Butter Chicken")],
      `<link rel="next" href="https://www.site.example/category/quick/page/2/" />`
    ),
    "https://site.example/category/quick/"
  );
  assert.equal(list.title, "Quick and Easy");
  assert.deepEqual(list.recipes, [
    { url: "https://www.site.example/butter-chicken/", title: "Butter Chicken", image: "https://site.example/photos/butter-chicken.jpg" },
    { url: "https://www.site.example/aglio-e-olio/", title: "Aglio e Olio & Chilli", image: "https://site.example/photos/aglio-e-olio.jpg" },
  ]);
  assert.equal(list.next, "https://www.site.example/category/quick/page/2/");
});

test("a category page leaves out other sites, the site's own lists, and wrapper articles", () => {
  const offSite = `<article><h2><a href="https://elsewhere.example/soup/">Soup</a></h2></article>`;
  const onlyCategory = `<article><h2><a href="https://www.site.example/tag/easy/">Easy</a></h2></article>`;
  const wrapped = `<article class="page">${card("pho", "Pho")}${card("laksa", "Laksa")}</article>`;
  const list = recipeLinks(categoryPage([offSite, onlyCategory, wrapped]), "https://www.site.example/category/soups/");
  assert.deepEqual(
    list.recipes.map((recipe) => recipe.title),
    ["Pho", "Laksa"]
  );
});

test("when most recipes share a folder, cards outside it (a subscription offer) are dropped", () => {
  const recipe = (slug) => `<article><h2><a href="/recipes/${slug}">${slug}</a></h2></article>`;
  const offer = `<article><h2><a href="/subscribe/?utm_source=x">Subscribe</a></h2></article>`;
  const list = recipeLinks(categoryPage([recipe("pasta"), recipe("ramen"), offer, recipe("dhal")]), "https://food.example/recipes/collection/quick");
  assert.deepEqual(
    list.recipes.map((r) => r.title),
    ["pasta", "ramen", "dhal"]
  );
});

test("a page without cards can still list recipes through its JSON-LD ItemList", () => {
  const data = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    itemListElement: [
      { "@type": "ListItem", position: 1, url: "https://tasty.example/recipe/chicken-veggie-stir-fry" },
      { "@type": "ListItem", position: 2, item: { url: "https://tasty.example/recipe/noodle-soup", name: "Noodle soup", image: "https://img.example/soup.jpg" } },
    ],
  };
  const list = recipeLinks(categoryPage([], `<script type="application/ld+json">${JSON.stringify(data)}</script>`), "https://tasty.example/topic/easy");
  assert.deepEqual(list.recipes, [
    { url: "https://tasty.example/recipe/chicken-veggie-stir-fry", title: "Chicken veggie stir fry", image: "" },
    { url: "https://tasty.example/recipe/noodle-soup", title: "Noodle soup", image: "https://img.example/soup.jpg" },
  ]);
});

test("a recipe page's comments aren't a list: each 'Reply' is the page itself", () => {
  const comment = (n) =>
    `<article id="div-comment-${n}" class="comment-body"><p>Lovely!</p>` +
    `<a class="comment-reply-link" href="https://www.site.example/laksa/?replytocom=${n}#respond">Reply</a></article>`;
  assert.equal(recipeLinks(categoryPage([comment(1), comment(2), comment(3)]), "https://www.site.example/laksa/"), null);
  // Comments that link to the site's other recipes still aren't the list.
  const mention = (slug) => `<article class="comment-body"><p>Also try <a href="/${slug}/">this</a></p></article>`;
  assert.equal(recipeLinks(categoryPage([mention("pho"), mention("ramen")]), "https://www.site.example/laksa/"), null);
  // Nor are "Reply" links in a theme whose comments carry no "comment" name.
  const plainReply = (n) => `<article><a href="/laksa/?replytocom=${n}">Reply to this</a></article>`;
  assert.equal(recipeLinks(categoryPage([plainReply(1), plainReply(2)]), "https://www.site.example/laksa/"), null);
});

test("sites whose addresses differ only after the ? (/?p=12) still list their recipes", () => {
  const post = (n) => `<article><h2><a href="/?p=${n}">Recipe ${n}</a></h2></article>`;
  const list = recipeLinks(categoryPage([post(1), post(2), post(3)]), "https://blog.example/?cat=5");
  assert.deepEqual(
    list.recipes.map((r) => r.url),
    ["https://blog.example/?p=1", "https://blog.example/?p=2", "https://blog.example/?p=3"]
  );
});

test("titles: an h1 heading counts, and a one-word badge on the photo isn't the name", () => {
  const badged = (slug, title) =>
    `<article class="post"><a href="/2024/05/${slug}/"><img src="/${slug}.jpg"><span>Recipe</span></a>` +
    `<h1 class="entry-title"><a href="/2024/05/${slug}/">${title}</a></h1></article>`;
  const list = recipeLinks(categoryPage([badged("pho", "beef pho"), badged("laksa", "chicken laksa")]), "https://sk.example/recipes/quick/");
  assert.deepEqual(
    list.recipes.map((r) => r.title),
    ["beef pho", "chicken laksa"]
  );
  // With no heading at all, the address names it, not the badge.
  const bare = (slug) => `<article><a href="/${slug}/"><img src="/${slug}.jpg"><span>Recipe</span></a></article>`;
  assert.deepEqual(
    recipeLinks(categoryPage([bare("beef-pho"), bare("chicken-laksa")]), "https://sk.example/").recipes.map((r) => r.title),
    ["Beef pho", "Chicken laksa"]
  );
});

test("dated addresses (/2024/05/…) aren't a folder, so older recipes stay", () => {
  const dated = (year, slug) => `<article><h2><a href="/${year}/05/${slug}/">${slug}</a></h2></article>`;
  const cards = [dated(2024, "a"), dated(2024, "b"), dated(2024, "c"), dated(2023, "d"), dated(2023, "e")];
  assert.equal(recipeLinks(categoryPage(cards), "https://sk.example/recipes/quick/").recipes.length, 5);
});

test("a card's category label before its recipe link is passed over", () => {
  const labelFirst = (slug, title) =>
    `<article><a href="/category/dinner/">Dinner</a><h2><a href="/${slug}/">${title}</a></h2></article>`;
  assert.deepEqual(
    recipeLinks(categoryPage([labelFirst("pho", "Pho"), labelFirst("laksa", "Laksa")]), "https://www.site.example/").recipes.map((r) => r.title),
    ["Pho", "Laksa"]
  );
});

test("a wrapper <article> with its own heading still isn't a card", () => {
  const wrapped = `<article class="page"><h2>Our soups</h2>${card("pho", "Pho")}${card("laksa", "Laksa")}</article>`;
  assert.deepEqual(
    recipeLinks(categoryPage([wrapped]), "https://www.site.example/category/soups/").recipes.map((r) => r.title),
    ["Pho", "Laksa"]
  );
});

test("a stray % in an address doesn't break the list", () => {
  const imageOnly = (slug) => `<article><a href="/${slug}/"><img src="/x.jpg"></a></article>`;
  const list = recipeLinks(categoryPage([imageOnly("100%-rye-bread"), imageOnly("seeded-loaf")]), "https://www.site.example/");
  assert.deepEqual(
    list.recipes.map((r) => r.title),
    ["100% rye bread", "Seeded loaf"]
  );
});

test("WordPress's own 'next page' button counts when there's no rel=next", () => {
  const nav = `<nav><a class="next page-numbers" href="/category/quick/page/2/">Next</a></nav>`;
  const list = recipeLinks(categoryPage([card("pho", "Pho"), card("laksa", "Laksa"), nav]), "https://www.site.example/category/quick/");
  assert.equal(list.next, "https://www.site.example/category/quick/page/2/");
});

test("a recipe page with one related-recipe card isn't a list", () => {
  assert.equal(recipeLinks(categoryPage([card("pho", "Pho")]), "https://www.site.example/laksa/"), null);
  assert.equal(recipeLinks("<html><body><p>Just words.</p></body></html>", "https://www.site.example/"), null);
});

test("the same recipe page counts as the same link, however it's written", () => {
  const key = linkKey("https://www.recipetineats.com/chicken-chasseur/");
  for (const same of [
    "http://recipetineats.com/chicken-chasseur",
    "https://WWW.RecipeTinEats.com/chicken-chasseur/#comments",
    "https://www.recipetineats.com/chicken-chasseur/?utm_source=facebook&fbclid=abc",
    "https://www.recipetineats.com:443/chicken-chasseur",
  ])
    assert.equal(linkKey(same), key, same);
  // A different page, or a query that picks the recipe, isn't the same.
  assert.notEqual(linkKey("https://www.recipetineats.com/chicken-chasseur-2/"), key);
  assert.notEqual(linkKey("https://example.com/recipe?id=1"), linkKey("https://example.com/recipe?id=2"));
  assert.equal(linkKey("https://example.com/r?b=2&a=1"), linkKey("https://example.com/r?a=1&b=2"));
  assert.equal(linkKey("not a link"), "");
});

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

test("a plain-text recipe's ingredients can be under \"What you'll need\", curly apostrophe or not", () => {
  for (const heading of ["What you'll need", "What you’ll need", "You will need"]) {
    const html = `<article><h2>${heading}</h2><ul><li>2 eggs</li><li>1 cup flour</li></ul>
      <h2>Method</h2><p>Bake for twenty minutes.</p></article>`;
    assert.deepEqual(parseRecipe(html, "https://example.com/cake")?.ingredients, ["2 eggs", "1 cup flour"], heading);
  }
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

test("keeps the nutrition facts per serving, in label order, with units", () => {
  const nutrition = (facts) =>
    parseRecipe(page({ "@type": "Recipe", name: "Soup", recipeIngredient: ["1 onion"], recipeInstructions: ["Simmer."], nutrition: facts }), "https://example.com/soup").nutrition;
  assert.deepEqual(
    nutrition({
      "@type": "NutritionInformation",
      proteinContent: "12 g",
      calories: "420 calories",
      servingSize: "1 bowl",
      fatContent: 9,
      sodiumContent: "800",
      sugarContent: "0 g",
    }),
    ["Serving: 1 bowl", "Calories: 420 kcal", "Fat: 9 g", "Sodium: 800 mg", "Sugar: 0 g", "Protein: 12 g"]
  );
  // Every usual way of writing calories says "N kcal" (once).
  for (const calories of ["420 kcal", "420", 420, "420kcal", "420 KCAL", "420 Cal", "420 kilocalories", "420 calories."])
    assert.deepEqual(nutrition({ calories }), ["Calories: 420 kcal"], String(calories));
  assert.deepEqual(nutrition({ calories: "1,200 kcal" }), ["Calories: 1,200 kcal"]);
  assert.deepEqual(nutrition({ calories: "420 calories per serving" }), ["Calories: 420 calories per serving"]);
  // A label the site repeats in the value isn't shown twice.
  assert.deepEqual(nutrition({ calories: "Calories: 420", proteinContent: "protein 12 g" }), ["Calories: 420 kcal", "Protein: 12 g"]);
  // Unknowns written as 0 calories or a lone unit are left out; none at all is [].
  assert.deepEqual(nutrition({ calories: "0", fatContent: "g", proteinContent: "3g" }), ["Protein: 3g"]);
  // A serving needn't have a number; one written as an object is left out.
  assert.deepEqual(nutrition({ servingSize: "one bowl" }), ["Serving: one bowl"]);
  assert.deepEqual(nutrition({ servingSize: { "@type": "QuantitativeValue", value: 250, unitText: "g" }, proteinContent: "3 g" }), ["Protein: 3 g"]);
  // Some sites wrap the facts, or a value, in a list.
  assert.deepEqual(nutrition([{ proteinContent: ["5 g"] }]), ["Protein: 5 g"]);
  assert.deepEqual(nutrition(undefined), []);
  assert.deepEqual(nutrition("lots"), []);
});

test("an amount listed apart from its ingredient is joined back to it", () => {
  const ingredients = (recipeIngredient) =>
    parseRecipe(page({ "@type": "Recipe", name: "Stew", recipeIngredient, recipeInstructions: ["Cook."] }), "https://www.thekitchn.com/stew").ingredients;
  assert.deepEqual(ingredients(["1 tablespoon", "olive oil", "2 pounds", "beef chuck", "1", "sprig of rosemary", "1 1/2 cups", "stock", "½ tsp", "salt", "1 Tablespoon", "honey", "1 tbsp.", "soy sauce"]), [
    "1 tablespoon olive oil",
    "2 pounds beef chuck",
    "1 sprig of rosemary",
    "1 1/2 cups stock",
    "½ tsp salt",
    "1 Tablespoon honey",
    "1 tbsp. soy sauce",
  ]);
  // Whole lines, a heading after an amount, and two amounts in a row stay put.
  assert.deepEqual(ingredients(["2 eggs", "Salt", "For the sauce:", "1 cup", "# Topping", "3", "200 g"]), [
    "2 eggs",
    "Salt",
    "# For the sauce",
    "1 cup",
    "# Topping",
    "3",
    "200 g",
  ]);
});

test("keeps the site's own rating, out of 5, when the page gives one", () => {
  const recipe = (aggregateRating) =>
    parseRecipe(page({ "@type": "Recipe", name: "Soup", recipeIngredient: ["1 onion"], recipeInstructions: ["Simmer."], aggregateRating }), "https://example.com/soup");
  assert.deepEqual(recipe({ "@type": "AggregateRating", ratingValue: "4.83", ratingCount: "2341" }).siteRating, { value: 4.8, count: 2341 });
  // Review counts stand in for rating counts; commas for decimal points.
  assert.deepEqual(recipe({ ratingValue: "4,5", reviewCount: 12 }).siteRating, { value: 4.5, count: 12 });
  // Out of 10, scaled to 5.
  assert.deepEqual(recipe({ ratingValue: 9, bestRating: 10, ratingCount: 3 }).siteRating, { value: 4.5, count: 3 });
  // No ratings yet, nonsense, or none at all: nothing.
  assert.equal(recipe({ ratingValue: 0, ratingCount: 0 }).siteRating, null);
  assert.equal(recipe({ ratingValue: 5, ratingCount: 0 }).siteRating, null);
  assert.equal(recipe({ ratingValue: 7, ratingCount: 4 }).siteRating, null);
  assert.equal(recipe({ ratingValue: "great", ratingCount: 4 }).siteRating, null);
  assert.equal(recipe(undefined).siteRating, null);
  // A perfect score is kept, and the rating count wins over reviews.
  assert.deepEqual(recipe({ ratingValue: 5, ratingCount: 3 }).siteRating, { value: 5, count: 3 });
  assert.deepEqual(recipe({ ratingValue: 4.6, ratingCount: 120, reviewCount: 30 }).siteRating, { value: 4.6, count: 120 });
  // Counts written with thousands separators are whole numbers.
  assert.deepEqual(recipe({ ratingValue: "4.6", ratingCount: "1,234" }).siteRating, { value: 4.6, count: 1234 });
  assert.deepEqual(recipe({ ratingValue: "4,6", ratingCount: "1.234.567" }).siteRating, { value: 4.6, count: 1234567 });
  assert.deepEqual(recipe({ ratingValue: "4.6", ratingCount: "1 234" }).siteRating, { value: 4.6, count: 1234 });
  // ...but a count written as a decimal is just that number.
  assert.deepEqual(recipe({ ratingValue: "4.6", ratingCount: "12.0" }).siteRating, { value: 4.6, count: 12 });
  assert.deepEqual(recipe({ ratingValue: "4.6", ratingCount: " 12 " }).siteRating, { value: 4.6, count: 12 });
  // A negative count falls back to reviews; an absurd one (which the
  // database would refuse, failing the whole import) means no rating.
  assert.deepEqual(recipe({ ratingValue: 4, ratingCount: "-5", reviewCount: 8 }).siteRating, { value: 4, count: 8 });
  assert.equal(recipe({ ratingValue: 4, ratingCount: "99999999999999999999" }).siteRating, null);
  assert.equal(recipe({ ratingValue: 4, ratingCount: 1e20 }).siteRating, null);
});

test("a step's own photo is noted with the step it belongs to", () => {
  const parsed = parseRecipe(
    page({
      "@type": "Recipe",
      name: "Lasagne",
      image: "https://e.com/cover.jpg",
      recipeInstructions: [
        {
          "@type": "HowToSection",
          name: "Sauce",
          itemListElement: [
            { "@type": "HowToStep", text: "1. Fry the onions.", image: "/img/onions.jpg" },
            { "@type": "HowToStep", text: "Add the tomatoes.", image: [{ "@type": "ImageObject", url: "https://cdn.e.com/tomatoes.jpg" }] },
            { "@type": "HowToStep", text: "Simmer." },
          ],
        },
        // The cover again, and a photo already used: not noted twice.
        { "@type": "HowToStep", text: "Layer it up.", image: "https://e.com/cover.jpg" },
        { "@type": "HowToStep", text: "Bake.", image: { url: "https://cdn.e.com/tomatoes.jpg" } },
        // A photo with no step text: no step to put it on.
        { "@type": "HowToStep", text: "", image: "https://e.com/empty.jpg" },
      ],
    }),
    "https://e.com/lasagne"
  );
  assert.deepEqual(parsed.steps, ["# Sauce", "Fry the onions.", "Add the tomatoes.", "Simmer.", "Layer it up.", "Bake."]);
  assert.deepEqual(parsed.stepImages, [
    { step: "Fry the onions.", url: "https://e.com/img/onions.jpg" },
    { step: "Add the tomatoes.", url: "https://cdn.e.com/tomatoes.jpg" },
  ]);
  // Plain-text steps have none.
  assert.deepEqual(parseRecipe(page({ "@type": "Recipe", name: "x", recipeInstructions: "Mix.\nBake." }), "https://e.com").stepImages, []);
});

test("no more step photos than a recipe keeps", () => {
  const steps = Array.from({ length: 25 }, (_, i) => ({ "@type": "HowToStep", text: `Step ${i}.`, image: `https://e.com/${i}.jpg` }));
  const parsed = parseRecipe(page({ "@type": "Recipe", name: "Long", recipeInstructions: steps }), "https://e.com");
  assert.equal(parsed.stepImages.length, 20);
});

// A recipe card's ingredient sections (WP Recipe Maker style, as on
// RecipeTin Eats): the data's list is flat, the card has the headings.
const chickenData = {
  "@type": "Recipe",
  name: "Butter chicken",
  recipeIngredient: ["1 kg chicken thighs", "1/2 cup yoghurt", "1 tbsp lemon juice", "1 cup passata", "Rice"],
  recipeInstructions: ["Bake."],
};
const wprmCard = (groups) =>
  `<div class="wprm-recipe-ingredients-container wprm-block-text-normal"><h3 class="wprm-recipe-header">Ingredients</h3>` +
  groups
    .map(
      ([name, items]) =>
        `<div class="wprm-recipe-ingredient-group">${name ? `<h4 class="wprm-recipe-group-name">${name}</h4>` : ""}` +
        `<ul class="wprm-recipe-ingredients">${items.map((item) => `<li class="wprm-recipe-ingredient">${item}</li>`).join("")}</ul></div>`
    )
    .join("") +
  `</div>`;

test("reads the recipe card's ingredient sections as # headings", () => {
  const card = wprmCard([
    ["", ["1 kg chicken thighs"]],
    ["Marinade:", ["1/2 cup yoghurt", "1 tbsp lemon juice"]],
    ["Sauce:", ["1 cup passata"]],
    ["Serving:", ["Rice"]],
  ]);
  const parsed = parseRecipe(page(chickenData).replace("<body>hi", `<body>${card}`), "https://e.com");
  assert.deepEqual(parsed.ingredients, [
    "1 kg chicken thighs",
    "# Marinade",
    "1/2 cup yoghurt",
    "1 tbsp lemon juice",
    "# Sauce",
    "1 cup passata",
    "# Serving",
    "Rice",
  ]);
});

test("a card's own title isn't a section; empty headings go; headings are plain text", () => {
  const card =
    `<div class="tasty-recipes-ingredients"><h3>Ingredients (serves 4)</h3><h4>Notes</h4>` +
    `<h4>Chicken &amp; marinade</h4><ul><li>1 kg chicken thighs</li><li>1/2 cup yoghurt</li><li>1 tbsp lemon juice</li></ul>` +
    `<h4><strong>Sauce</strong></h4><ul><li>1 cup passata</li><li>Rice</li></ul></div>`;
  const parsed = parseRecipe(page(chickenData).replace("<body>hi", `<body>${card}`), "https://e.com");
  assert.deepEqual(parsed.ingredients.filter((line) => line.startsWith("#")), ["# Chicken & marinade", "# Sauce"]);
  assert.equal(parsed.ingredients[0], "# Chicken & marinade");
  // The title straight above a list without its own heading isn't a section.
  const titled =
    `<div class="tasty-recipes-ingredients"><h3>Ingredients (serves 4)</h3><ul><li>1 kg chicken thighs</li><li>1/2 cup yoghurt</li><li>1 tbsp lemon juice</li></ul>` +
    `<h4>Sauce</h4><ul><li>1 cup passata</li><li>Rice</li></ul></div>`;
  const plainTop = parseRecipe(page(chickenData).replace("<body>hi", `<body>${titled}`), "https://e.com");
  assert.deepEqual(plainTop.ingredients.filter((line) => line.startsWith("#")), ["# Sauce"]);
  // A later section named "Ingredients for…" is a section.
  const later =
    `<div class="tasty-recipes-ingredients"><h4>For the chicken</h4><ul><li>1 kg chicken thighs</li><li>1/2 cup yoghurt</li><li>1 tbsp lemon juice</li></ul>` +
    `<h4>Ingredients for the sauce</h4><ul><li>1 cup passata</li><li>Rice</li></ul></div>`;
  const sauce = parseRecipe(page(chickenData).replace("<body>hi", `<body>${later}`), "https://e.com");
  assert.equal(sauce.ingredients.indexOf("# Ingredients for the sauce"), 4);
});

test("Tasty Recipes style sections (a heading, then its list) work too", () => {
  const card =
    `<div class="tasty-recipes-ingredients"><h4>For the chicken</h4><ul><li>1 kg chicken thighs</li><li>1/2 cup yoghurt</li><li>1 tbsp lemon juice</li></ul>` +
    `<h4>For the sauce</h4><ul><li>1 cup passata</li><li>Rice</li></ul></div>`;
  const parsed = parseRecipe(page(chickenData).replace("<body>hi", `<body>${card}`), "https://e.com");
  assert.deepEqual(parsed.ingredients.filter((line) => line.startsWith("#")), ["# For the chicken", "# For the sauce"]);
  assert.equal(parsed.ingredients.indexOf("# For the sauce"), 4);
});

test("sections that don't line up with the recipe data are left out, not misplaced", () => {
  // The card has one ingredient fewer than the data.
  const card = wprmCard([
    ["Marinade:", ["1/2 cup yoghurt", "1 tbsp lemon juice"]],
    ["Sauce:", ["1 cup passata", "Rice"]],
  ]);
  const parsed = parseRecipe(page(chickenData).replace("<body>hi", `<body>${card}`), "https://e.com");
  assert.deepEqual(parsed.ingredients, chickenData.recipeIngredient);
  // Nor when the card has more than the data.
  const more = wprmCard([
    ["Marinade:", ["1 kg chicken thighs", "1/2 cup yoghurt", "1 tbsp lemon juice"]],
    ["Sauce:", ["1 cup passata", "Rice", "Naan"]],
  ]);
  assert.deepEqual(parseRecipe(page(chickenData).replace("<body>hi", `<body>${more}`), "https://e.com").ingredients, chickenData.recipeIngredient);
  // And a card without named sections changes nothing.
  const plain = parseRecipe(page(chickenData).replace("<body>hi", `<body>${wprmCard([["", chickenData.recipeIngredient]])}`), "https://e.com");
  assert.deepEqual(plain.ingredients, chickenData.recipeIngredient);
});
