/// <reference path="../pb_data/types.d.ts" />

// POST /api/cookbook/recipe-photo  { "url": "https://..." }
// A recipe photo from its web address, sent back as the image itself, for
// the app to save with the recipe. For Paprika imports: Paprika's files
// carry only a small preview of each photo (at most 280×280, found in a
// real export on 2026-11-07), but recipes Paprika saved from a website also
// carry the site's full-size photo's address (`image_url`). The server
// fetches it because browsers aren't allowed to read other websites' files.
//
// 400 means that address had no photo Bentotachi can keep (the app keeps
// the preview); 503 that the website couldn't be reached right now.

routerAdd("POST", "/api/cookbook/recipe-photo", (e) => {
  // Handlers can't see variables from outside themselves, so load helpers here.
  const parser = require(`${__hooks}/recipe_parse.js`);
  const safeUrl = require(`${__hooks}/safe_url.js`);

  const url = String(e.requestInfo().body.url || "").trim();
  if (!/^https?:\/\/\S+$/i.test(url)) {
    throw new BadRequestError("A photo's address needs to start with http:// or https://");
  }
  // Never this computer or the home network (see safe_url.js).
  if (!safeUrl.isPublicUrl(url)) {
    throw new BadRequestError("Bentotachi only fetches photos from public websites, not addresses on your own network.");
  }

  let image;
  try {
    image = $http.send({
      url: url,
      method: "GET",
      headers: { "user-agent": parser.BROWSER_USER_AGENT, accept: "image/*" },
      timeout: 15,
    });
  } catch (err) {
    throw new ApiError(503, "Couldn't reach that website for the photo.");
  }
  if (image.statusCode === 429 || image.statusCode >= 500) {
    throw new ApiError(503, `That website couldn't send the photo right now (error ${image.statusCode}).`);
  }
  // The photo's type from the file's own first bytes, not the site's label
  // (see recipe_parse.js imageExtension).
  const types = { jpg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", avif: "image/avif" };
  const extension = parser.imageExtension("", image.body);
  if (image.statusCode !== 200 || !extension) {
    throw new BadRequestError("That address doesn't have a photo Bentotachi can keep.");
  }
  if (image.body.length > parser.LIMITS.image) {
    throw new BadRequestError("That photo is over 10 MB.");
  }
  return e.blob(200, types[extension], image.body);
}, $apis.requireAuth());
