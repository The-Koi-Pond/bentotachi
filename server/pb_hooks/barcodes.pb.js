/// <reference path="../pb_data/types.d.ts" />

// GET /api/cookbook/barcode/{code}: what a scanned barcode is, for adding it
// to the pantry: { found: true, name, brand, quantity } or { found: false }.
// Asks Open Food Facts (see barcode_lookup.js). Bento remembers barcodes on
// pantry items itself, so this is only for ones the household hasn't seen.

routerAdd("GET", "/api/cookbook/barcode/{code}", (e) => {
  const lookup = require(`${__hooks}/barcode_lookup.js`);
  const code = e.request.pathValue("code");
  if (!lookup.isBarcode(code)) throw new BadRequestError("That doesn't look like a barcode (8 to 14 digits).");

  let answer;
  try {
    answer = $http.send({
      url: lookup.lookupUrl(code),
      method: "GET",
      headers: { "user-agent": lookup.USER_AGENT, accept: "application/json" },
      timeout: 15,
    });
  } catch (err) {
    throw new BadRequestError("Couldn't reach Open Food Facts to look it up. You can still type its name.");
  }
  // 404 is its answer for a product it doesn't know.
  if (answer.statusCode === 404) return e.json(200, { found: false });
  if (answer.statusCode >= 400) {
    throw new BadRequestError(`Open Food Facts couldn't look it up (error ${answer.statusCode}). You can still type its name.`);
  }
  const product = lookup.productFromOpenFoodFacts(answer.json);
  return e.json(200, product ? { found: true, ...product } : { found: false });
}, $apis.requireAuth());
