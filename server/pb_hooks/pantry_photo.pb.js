/// <reference path="../pb_data/types.d.ts" />

// POST /api/cookbook/photo-from-page  { "url": "https://..." }
// The product photo on a shop's page (the picture the page shows when its
// link is shared), sent back as the image itself. The app uses it for a
// pantry item's photo: it shrinks it and saves it like one someone took.
// The server fetches it because browsers aren't allowed to read other
// websites' pages. Coles' and Woolworths' product pages both have one.

routerAdd("POST", "/api/cookbook/photo-from-page", (e) => {
  // Handlers can't see variables from outside themselves, so load helpers here.
  const parser = require(`${__hooks}/recipe_parse.js`);
  const safeUrl = require(`${__hooks}/safe_url.js`);
  const instead = "You can take or choose a photo instead.";

  const url = String(e.requestInfo().body.url || "").trim();
  if (!/^https?:\/\/\S+$/i.test(url)) {
    throw new BadRequestError("The store link needs to start with https:// to be a full web address");
  }
  // Never this computer or the home network (see safe_url.js); the page
  // chooses the photo's address, so that gets the same check.
  if (!safeUrl.isPublicUrl(url)) {
    throw new BadRequestError("Bentotachi only reads public websites, not addresses on your own network.");
  }

  const download = (address, accept) => {
    try {
      return $http.send({
        url: address,
        method: "GET",
        headers: { "user-agent": parser.BROWSER_USER_AGENT, accept: accept },
        timeout: 20,
      });
    } catch (err) {
      throw new BadRequestError("Couldn't reach that website. Check the link and the internet connection.");
    }
  };

  const page = download(url, "text/html,*/*");
  if (page.statusCode >= 400) {
    throw new BadRequestError(`That website refused the request (error ${page.statusCode}). ${instead}`);
  }
  const imageUrl = parser.productPhotoUrl(toString(page.body), url);
  if (!imageUrl) throw new BadRequestError(`That page doesn't offer a photo. ${instead}`);
  if (!safeUrl.isPublicUrl(imageUrl)) {
    throw new BadRequestError(`That page's photo is on a private address, so Bentotachi left it. ${instead}`);
  }

  const image = download(imageUrl, "image/*");
  // From the file's own first bytes, not the site's label (see recipe_parse.js).
  const extension = parser.imageExtension("", image.body);
  if (image.statusCode !== 200 || !extension) {
    throw new BadRequestError(`Couldn't download that page's photo. ${instead}`);
  }
  if (image.body.length > parser.LIMITS.image) {
    throw new BadRequestError(`That page's photo is over 10 MB. ${instead}`);
  }
  const types = { jpg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", avif: "image/avif" };
  return e.blob(200, types[extension], image.body);
}, $apis.requireAuth());
