// Finding a pantry item's photo for pantry_photo.pb.js, apart from the route
// so Node can test it with made-up website answers
// (server/test/pantry_photo.test.js). Plain CommonJS, and it's handed what
// it uses (no require), like the other helpers here.

const instead = "You can take or choose a photo instead.";
const TYPES = { jpg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", avif: "image/avif" };

// { photo: { type, body } }, or { status, message }: 400 when no photo was
// found (the app doesn't ask again for the same barcodes and links), 503
// when Open Food Facts or a store couldn't answer (no connection, too busy,
// a fault on its side) and nothing else had a photo, so asking again later
// is worth it.
// download(address, userAgent, accept) -> { statusCode, body, json }, and
// throws if the website can't be reached; toText(body) reads a page.
function findPhoto({ barcodes, urls, download, toText, parser, safeUrl, lookup }) {
  // The downloaded photo's type, or "" if it isn't one Bentotachi keeps. From
  // the file's own first bytes, not the site's label (see recipe_parse.js).
  const photoType = (image) => {
    const extension = parser.imageExtension("", image.body);
    return image.statusCode === 200 && extension && image.body.length <= parser.LIMITS.image ? TYPES[extension] : "";
  };
  // A site that couldn't answer properly right now: "too busy" (429), or a
  // fault on its side (5xx). Worth asking again later.
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
      if (type) return { photo: { type, body: image.body } };
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
        const imageUrl = parser.productPhotoUrl(toText(page.body), url);
        if (!imageUrl) {
          problem = `That page doesn't offer a photo. ${instead}`;
        } else if (!safeUrl.isPublicUrl(imageUrl)) {
          // The page chooses the photo's address, so it gets the same check
          // as the link: never this computer or the home network.
          problem = `That page's photo is on a private address, so Bentotachi left it. ${instead}`;
        } else {
          const image = download(imageUrl, parser.BROWSER_USER_AGENT, "image/*");
          const type = photoType(image);
          if (type) return { photo: { type, body: image.body } };
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
    return { status: 503, message: `Couldn't reach ${unreachable} for its photo. Try again in a bit, or take or choose one instead.` };
  }
  return { status: 400, message: problem };
}

module.exports = { findPhoto };
