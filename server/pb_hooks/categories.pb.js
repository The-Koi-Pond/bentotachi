/// <reference path="../pb_data/types.d.ts" />

// POST /api/cookbook/categories  { "url": "https://...", "inside": true, "html": "<optional>" }
// A site's categories, read from its own menu on its home page (Browse's
// "Categories"), so nobody keeps lists of them by hand. With "inside", the
// link is one of those categories: its recipes to tick ("list", as the
// import route gives it) and the categories inside it.

routerAdd("POST", "/api/cookbook/categories", (e) => {
  const parser = require(`${__hooks}/recipe_parse.js`);
  const webPage = require(`${__hooks}/web_page.js`);

  const body = e.requestInfo().body;
  const url = String(body.url || "").trim();
  if (!/^https?:\/\/\S+$/i.test(url)) {
    throw new BadRequestError("Paste the full link, starting with http:// or https://");
  }
  const inside = body.inside === true;
  const html = webPage.readPage(url, body.html, "open the site and use its own menu instead.");

  const categories = parser.siteCategories(html, url, { inPage: inside });
  let list = inside ? parser.recipeLinks(html, url) : null;
  // A page of categories with a few stray cards (BBC Good Food's "Barbecue":
  // a sauce, a magazine offer and a podcast) isn't a list of recipes.
  if (list && categories.length && list.recipes.length < 4) list = null;
  if (!categories.length && !list) {
    throw new BadRequestError(
      inside
        ? "Couldn't find any recipes there. Open it on the site instead."
        : "Couldn't find this site's categories. Open the site and use its own menu instead."
    );
  }
  return e.json(200, { categories: categories, list: list && webPage.markHere(e.app, list) });
}, $apis.requireAuth());
