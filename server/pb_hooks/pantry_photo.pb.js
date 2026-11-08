/// <reference path="../pb_data/types.d.ts" />

// POST /api/cookbook/pantry-photo  { "barcodes": ["..."], "urls": ["https://..."] }
// A product's photo for a pantry item, sent back as the image itself: the
// front photo Open Food Facts has for one of its barcodes (see
// barcode_lookup.js), else the product photo on one of its store pages, in
// order (the picture the page shows when its link is shared; Coles' and
// Woolworths' both have one). Either list can be left out. The app shrinks
// it and saves it like one someone took. The server fetches it because
// browsers aren't allowed to read other websites' pages.
//
// 400 means no photo was found (the app doesn't ask again for the same
// barcodes and links); 503 that Open Food Facts or a store couldn't be
// reached (no connection, too busy, or a fault on its side) and nothing else
// had a photo, so it's worth asking again later.

routerAdd("POST", "/api/cookbook/pantry-photo", (e) => {
  // Handlers can't see variables from outside themselves, so load helpers here.
  const parser = require(`${__hooks}/recipe_parse.js`);
  const safeUrl = require(`${__hooks}/safe_url.js`);
  const lookup = require(`${__hooks}/barcode_lookup.js`);
  const instead = "You can take or choose a photo instead.";

  const body = e.requestInfo().body;
  // A few of each at most: each one is a question to another website.
  const list = (value) => (Array.isArray(value) ? value : []).map((text) => String(text).trim()).filter(Boolean).slice(0, 5);
  const urls = list(body.urls);
  const barcodes = list(body.barcodes).filter(lookup.isBarcode);
  for (const url of urls) {
    if (!/^https?:\/\/\S+$/i.test(url)) {
      throw new BadRequestError("A store link needs to start with https:// to be a full web address");
    }
    // Never this computer or the home network (see safe_url.js); the page
    // chooses the photo's address, so that gets the same check.
    if (!safeUrl.isPublicUrl(url)) {
      throw new BadRequestError("Bentotachi only reads public websites, not addresses on your own network.");
    }
  }
  if (!urls.length && !barcodes.length) {
    throw new BadRequestError(`It needs a barcode or a store link to find a photo. ${instead}`);
  }

  // The search itself is pantry_photo.js (tested in Node).
  const found = require(`${__hooks}/pantry_photo.js`).findPhoto({
    barcodes,
    urls,
    // Throws if the website can't be reached at all.
    download: (address, userAgent, accept) =>
      $http.send({ url: address, method: "GET", headers: { "user-agent": userAgent, accept: accept }, timeout: 20 }),
    toText: (body) => toString(body),
    parser,
    safeUrl,
    lookup,
  });
  if (found.photo) return e.blob(200, found.photo.type, found.photo.body);
  if (found.status === 503) throw new ApiError(503, found.message);
  throw new BadRequestError(found.message);
}, $apis.requireAuth());
