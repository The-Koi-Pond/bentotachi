/// <reference path="../pb_data/types.d.ts" />

// POST /api/cookbook/import  { "url": "https://...", "html": "<optional>" }
// Reads the recipe from the page, saves it (with its photo) and returns the
// new recipe's id.
//
// Normally the server downloads the page itself, because browsers aren't
// allowed to read other websites' pages. The Android app's built-in browser
// can, so it sends the page it already loaded as "html", and so does Add
// recipe's "Import a saved page" (a page saved with Ctrl+S). That also works
// for sites that block the server.

routerAdd("POST", "/api/cookbook/import", (e) => {
  // Handlers can't see variables from outside themselves, so load helpers here.
  const parser = require(`${__hooks}/recipe_parse.js`);

  const body = e.requestInfo().body;
  const url = String(body.url || "").trim();
  if (!/^https?:\/\/\S+$/i.test(url)) {
    throw new BadRequestError("Paste the full link, starting with http:// or https://");
  }

  let html = typeof body.html === "string" ? body.html : "";
  if (html.length > 5 * 1024 * 1024) {
    throw new BadRequestError("That page is too big to save.");
  }

  if (!html) {
    let page;
    try {
      page = $http.send({
        url: url,
        method: "GET",
        headers: { "user-agent": parser.BROWSER_USER_AGENT, accept: "text/html,*/*" },
        timeout: 20,
      });
    } catch (err) {
      throw new BadRequestError("Couldn't reach that website. Check the link and the internet connection.");
    }
    if (page.statusCode >= 400) {
      throw new BadRequestError(
        `That website refused the request (error ${page.statusCode}). Some sites block apps like this one; you can still add the recipe by hand.`
      );
    }
    html = toString(page.body);
  }

  const recipe = parser.parseRecipe(html, url);
  if (!recipe) {
    throw new BadRequestError("Couldn't find a recipe on that page. You can still add it by hand.");
  }

  const record = new Record(e.app.findCollectionByNameOrId("recipes"));
  record.set("title", recipe.title || "Untitled recipe");
  record.set("description", recipe.description);
  record.set("source_url", url);
  record.set("servings", recipe.servings);
  record.set("prep_minutes", recipe.prepMinutes);
  record.set("cook_minutes", recipe.cookMinutes);
  record.set("total_minutes", recipe.totalMinutes);
  record.set("ingredients", recipe.ingredients);
  record.set("steps", recipe.steps);
  record.set("tags", recipe.tags);
  record.set("author_notes", recipe.authorNotes);
  if (e.auth && e.auth.collection().name === "users") {
    record.set("added_by", e.auth.id);
  }

  // Save a copy of the photo so it works offline and survives the site
  // changing. A missing photo is fine, so failures here are only logged.
  if (recipe.imageUrl) {
    try {
      const image = $http.send({
        url: recipe.imageUrl,
        method: "GET",
        headers: { "user-agent": parser.BROWSER_USER_AGENT },
        timeout: 20,
      });
      const type = String((image.headers["Content-Type"] || [""])[0]);
      const extension = parser.imageExtension(type, image.body);
      if (image.statusCode === 200 && extension) {
        record.set("image", $filesystem.fileFromBytes(image.body, `photo.${extension}`));
      }
    } catch (err) {
      e.app.logger().warn("Recipe photo download failed", "url", recipe.imageUrl, "error", String(err));
    }
  }

  e.app.save(record);
  return e.json(200, { id: record.id });
}, $apis.requireAuth());
