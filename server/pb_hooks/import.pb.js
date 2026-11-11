/// <reference path="../pb_data/types.d.ts" />

// POST /api/cookbook/import  { "url": "https://...", "html": "<optional>" }
// Reads the recipe from the page, saves it (with its photo) and returns the
// new recipe's id. A page listing recipes instead sends back the list (see
// "list" below), to pick some and import each.
//
// Normally the server downloads the page itself, because browsers aren't
// allowed to read other websites' pages. The Android app's built-in browser
// can, so it sends the page it already loaded as "html", and so does Add
// recipe's "Import a saved page" (a page saved with Ctrl+S). That also works
// for sites that block the server.

routerAdd("POST", "/api/cookbook/import", (e) => {
  // Handlers can't see variables from outside themselves, so load helpers here.
  const parser = require(`${__hooks}/recipe_parse.js`);
  const safeUrl = require(`${__hooks}/safe_url.js`);
  const webPage = require(`${__hooks}/web_page.js`);

  const body = e.requestInfo().body;
  const url = String(body.url || "").trim();
  if (!/^https?:\/\/\S+$/i.test(url)) {
    throw new BadRequestError("Paste the full link, starting with http:// or https://");
  }

  // "preview": read the page and send back what's in it, saving nothing:
  // a recipe's "Re-import from the website", which merges
  // it into the recipe in the app.
  const preview = body.preview === true;

  // A recipe from this page already here: say so (409, with its id and
  // name, for "Open it" and "Add another copy"), unless asked for another
  // copy ("again"). Older apps just show the message.
  if (body.again !== true && !preview) {
    const same = webPage.sameRecipe(e.app, url);
    // Sent as it is (not an ApiError, whose extra data PocketBase blanks
    // out): PocketBase's own error shape, so older apps show the message.
    if (same) {
      const title = same.getString("title");
      return e.json(409, { status: 409, message: `You already have “${title}” from that link.`, data: {}, id: same.id, title: title });
    }
  }

  const html = webPage.readPage(url, body.html, "you can still add the recipe by hand.");

  const parsed = parser.parseRecipe(html, url);
  // A page listing recipes (a site's category) rather than being one: its
  // recipes, each marked if it's already here, for the app to pick from
  // ("list"). Some sites label the list itself a recipe with no
  // ingredients or steps (BBC Good Food's collections). Sent in
  // PocketBase's error shape, so older apps show the message instead.
  if (!parsed || (!parsed.ingredients.length && !parsed.steps.length)) {
    const list = parser.recipeLinks(html, url);
    if (list) {
      return e.json(400, {
        status: 400,
        message: "That's a page of recipes, not one recipe. Open the one you want, then import its link.",
        data: {},
        list: webPage.markHere(e.app, list),
      });
    }
  }
  if (!parsed) {
    throw new BadRequestError("Couldn't find a recipe on that page. You can still add it by hand.");
  }
  // Cut to what the database keeps (a 6,000-character introduction would
  // otherwise make the save, and the whole import, fail).
  const recipe = parser.fitRecipe(parsed);
  if (preview) return e.json(200, { recipe: recipe });

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
  record.set("nutrition", recipe.nutrition);
  // The website's own rating, when its page gives one (recipe_parse.js).
  if (recipe.siteRating) {
    record.set("site_rating", recipe.siteRating.value);
    record.set("site_rating_count", recipe.siteRating.count);
  }
  if (e.auth && e.auth.collection().name === "users") {
    record.set("added_by", e.auth.id);
  }

  // Save a copy of the photo so it works offline and survives the site
  // changing. A missing photo is fine, so failures here are only logged.
  // The page chooses this address, so it gets the same check.
  let withPhoto = false;
  if (recipe.imageUrl && !safeUrl.isPublicUrl(recipe.imageUrl)) {
    e.app.logger().warn("Skipped a recipe photo on a private address", "url", recipe.imageUrl);
  } else if (recipe.imageUrl) {
    try {
      const image = $http.send({
        url: recipe.imageUrl,
        method: "GET",
        headers: { "user-agent": parser.BROWSER_USER_AGENT },
        timeout: 20,
      });
      const type = String((image.headers["Content-Type"] || [""])[0]);
      const extension = parser.imageExtension(type, image.body);
      if (image.body.length > parser.LIMITS.image) {
        e.app.logger().warn("Skipped a recipe photo over 10 MB", "url", recipe.imageUrl, "bytes", image.body.length);
      } else if (image.statusCode === 200 && extension) {
        record.set("image", $filesystem.fileFromBytes(image.body, `photo.${extension}`));
        withPhoto = true;
      }
    } catch (err) {
      e.app.logger().warn("Recipe photo download failed", "url", recipe.imageUrl, "error", String(err));
    }
  }

  // The page's step photos too, for people who turned on "Bring step photos
  // from websites" (users.website_step_photos), each shown in its step
  // (photo_steps: { file name: the step's line, lower case }, as
  // web/src/recipePhotos.ts keeps them). Same checks as the cover; one that
  // fails is left out, and a slow site can't hold the import up for long.
  let withStepPhotos = false;
  const wantsStepPhotos = e.auth && e.auth.collection().name === "users" && e.auth.getBool("website_step_photos");
  if (wantsStepPhotos && recipe.stepImages && recipe.stepImages.length) {
    const files = [];
    const photoSteps = {};
    const started = Date.now();
    for (let i = 0; i < recipe.stepImages.length && Date.now() - started < 60000; i++) {
      const item = recipe.stepImages[i];
      if (!safeUrl.isPublicUrl(item.url)) continue;
      try {
        const photo = $http.send({
          url: item.url,
          method: "GET",
          headers: { "user-agent": parser.BROWSER_USER_AGENT },
          timeout: 15,
        });
        const extension = parser.imageExtension(String((photo.headers["Content-Type"] || [""])[0]), photo.body);
        if (photo.statusCode !== 200 || !extension || photo.body.length > parser.LIMITS.image) continue;
        const file = $filesystem.fileFromBytes(photo.body, `step${i + 1}.${extension}`);
        files.push(file);
        photoSteps[file.name] = String(item.step).trim().toLowerCase();
      } catch (err) {
        e.app.logger().warn("Step photo download failed", "url", item.url, "error", String(err));
      }
    }
    if (files.length) {
      record.set("photos", files);
      record.set("photo_steps", photoSteps);
      withStepPhotos = true;
    }
  }

  try {
    e.app.save(record);
  } catch (err) {
    // Still refused with photos: they're the optional part, so save the
    // recipe without them (step photos first, then the cover) rather than
    // lose the import.
    if (!withPhoto && !withStepPhotos) throw err;
    e.app.logger().warn("Saving the recipe failed with its photos; saving it without", "url", url, "error", String(err));
    if (withStepPhotos) {
      record.set("photos", []);
      record.set("photo_steps", null);
    }
    try {
      e.app.save(record);
    } catch (again) {
      if (!withPhoto) throw again;
      record.set("image", null);
      e.app.save(record);
    }
  }
  return e.json(200, { id: record.id });
}, $apis.requireAuth());
