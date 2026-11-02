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

  // Throws if the website can't be reached at all.
  const download = (address, userAgent, accept) =>
    $http.send({ url: address, method: "GET", headers: { "user-agent": userAgent, accept: accept }, timeout: 20 });
  const types = { jpg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", avif: "image/avif" };
  // The downloaded photo's type, or "" if it isn't one Bentotachi keeps. From
  // the file's own first bytes, not the site's label (see recipe_parse.js).
  const photoType = (image) => {
    const extension = parser.imageExtension("", image.body);
    return image.statusCode === 200 && extension && image.body.length <= parser.LIMITS.image ? types[extension] : "";
  };

  // A site that couldn't answer properly right now: no connection, "too
  // busy" (429), or a fault on its side (5xx). Worth asking again later.
  const notNow = (status) => status === 429 || status >= 500;
  // Who couldn't be reached, for the message; "" if everyone answered.
  let unreachable = "";

  // 1. Open Food Facts, for each barcode.
  for (const code of barcodes) {
    try {
      const answer = download(lookup.photoLookupUrl(code), lookup.USER_AGENT, "application/json");
      // 404 is its answer for a product it doesn't know.
      if (notNow(answer.statusCode)) {
        unreachable = "Open Food Facts";
        continue;
      }
      const imageUrl = answer.statusCode === 200 ? lookup.photoFromOpenFoodFacts(answer.json) : "";
      if (!imageUrl || !safeUrl.isPublicUrl(imageUrl)) continue;
      const image = download(imageUrl, lookup.USER_AGENT, "image/*");
      const type = photoType(image);
      if (type) return e.blob(200, type, image.body);
    } catch (err) {
      unreachable = "Open Food Facts";
    }
  }

  // 2. The store pages, in order. What went wrong there, if it did.
  let problem = barcodes.length ? `Open Food Facts doesn't have a photo of it. ${instead}` : "";
  for (const url of urls) {
    try {
      const page = download(url, parser.BROWSER_USER_AGENT, "text/html,*/*");
      if (notNow(page.statusCode)) {
        unreachable = unreachable || "the store";
        problem = `That website couldn't answer right now (error ${page.statusCode}). ${instead}`;
      } else if (page.statusCode >= 400) {
        problem = `That website refused the request (error ${page.statusCode}). ${instead}`;
      } else {
        const imageUrl = parser.productPhotoUrl(toString(page.body), url);
        if (!imageUrl) {
          problem = `That page doesn't offer a photo. ${instead}`;
        } else if (!safeUrl.isPublicUrl(imageUrl)) {
          problem = `That page's photo is on a private address, so Bentotachi left it. ${instead}`;
        } else {
          const image = download(imageUrl, parser.BROWSER_USER_AGENT, "image/*");
          const type = photoType(image);
          if (type) return e.blob(200, type, image.body);
          problem =
            image.body.length > parser.LIMITS.image
              ? `That page's photo is over 10 MB. ${instead}`
              : `Couldn't download that page's photo. ${instead}`;
        }
      }
    } catch (err) {
      unreachable = unreachable || "the store";
      problem = "Couldn't reach that website. Check the link and the internet connection.";
    }
  }
  // What went wrong is only worth spelling out for one page.
  if (urls.length > 1) problem = `None of its store pages had a photo Bentotachi could use. ${instead}`;

  if (unreachable) {
    throw new ApiError(503, `Couldn't reach ${unreachable} for its photo. Try again in a bit, or take or choose one instead.`);
  }
  throw new BadRequestError(problem);
}, $apis.requireAuth());
