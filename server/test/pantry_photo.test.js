// Run from the project folder with: node --test "server/test/*.test.js"
const test = require("node:test");
const assert = require("node:assert/strict");
const parser = require("../pb_hooks/recipe_parse.js");
const safeUrl = require("../pb_hooks/safe_url.js");
const lookup = require("../pb_hooks/barcode_lookup.js");
const { findPhoto } = require("../pb_hooks/pantry_photo.js");

const JPEG = [0xff, 0xd8, 0xff, 0xe0, 1, 2, 3];
const CODE = "9300633603161";
const STORE = "https://shop.example.com/product/rice";
const page = (photo) => ({ statusCode: 200, body: `<html><head><meta property="og:image" content="${photo}"></head></html>` });

// Made-up websites: each address answers as given, or can't be reached.
function find({ barcodes = [], urls = [], answers }) {
  const asked = [];
  const download = (address) => {
    asked.push(address);
    const answer = answers[address];
    if (!answer || answer === "unreachable") throw new Error("no connection");
    return answer;
  };
  return { result: findPhoto({ barcodes, urls, download, toText: String, parser, safeUrl, lookup }), asked };
}

test("Open Food Facts' photo first, then the store page's", () => {
  const off = { statusCode: 200, json: { status: 1, product: { image_front_url: "https://images.openfoodfacts.org/rice.jpg" } } };
  const { result } = find({
    barcodes: [CODE],
    urls: [STORE],
    answers: { [lookup.photoLookupUrl(CODE)]: off, "https://images.openfoodfacts.org/rice.jpg": { statusCode: 200, body: JPEG } },
  });
  assert.equal(result.photo.type, "image/jpeg");

  const fromStore = find({
    barcodes: [CODE],
    urls: [STORE],
    answers: {
      [lookup.photoLookupUrl(CODE)]: { statusCode: 404, json: {} },
      [STORE]: page("https://shop.example.com/rice.jpg"),
      "https://shop.example.com/rice.jpg": { statusCode: 200, body: JPEG },
    },
  });
  assert.equal(fromStore.result.photo.type, "image/jpeg");
});

test("nothing found is 400, so the app doesn't ask again", () => {
  const { result } = find({
    barcodes: [CODE],
    urls: [STORE],
    answers: { [lookup.photoLookupUrl(CODE)]: { statusCode: 404, json: {} }, [STORE]: { statusCode: 200, body: "<html></html>" } },
  });
  assert.deepEqual([result.status, result.message], [400, "That page doesn't offer a photo. You can take or choose a photo instead."]);
});

test("a site that couldn't answer is 503, worth asking again later, even if another said no", () => {
  for (const offAnswer of ["unreachable", { statusCode: 503, json: {} }, { statusCode: 429, json: {} }]) {
    const { result } = find({
      barcodes: [CODE],
      urls: [STORE],
      answers: { [lookup.photoLookupUrl(CODE)]: offAnswer, [STORE]: { statusCode: 200, body: "<html></html>" } },
    });
    assert.equal(result.status, 503, JSON.stringify(offAnswer));
    assert.match(result.message, /Open Food Facts/);
  }
  const store = find({ urls: [STORE], answers: { [STORE]: { statusCode: 502, body: "" } } });
  assert.deepEqual([store.result.status, store.result.message.includes("the store")], [503, true]);
  // A store that refuses (403) isn't "try later".
  assert.equal(find({ urls: [STORE], answers: { [STORE]: { statusCode: 403, body: "" } } }).result.status, 400);
});

test("a page's photo on a private address is never fetched", () => {
  const { result, asked } = find({ urls: [STORE], answers: { [STORE]: page("http://192.168.1.10/rice.jpg") } });
  assert.equal(result.status, 400);
  assert.match(result.message, /private address/);
  assert.deepEqual(asked, [STORE]);
  // Nor Open Food Facts' photo, if it pointed there.
  const off = { statusCode: 200, json: { status: 1, product: { image_front_url: "http://127.0.0.1/rice.jpg" } } };
  const fromOff = find({ barcodes: [CODE], answers: { [lookup.photoLookupUrl(CODE)]: off } });
  assert.deepEqual(fromOff.asked, [lookup.photoLookupUrl(CODE)]);
  assert.equal(fromOff.result.status, 400);
});

test("a download that isn't a photo, or is too big, isn't kept", () => {
  const notPhoto = find({
    urls: [STORE],
    answers: { [STORE]: page("https://shop.example.com/rice.jpg"), "https://shop.example.com/rice.jpg": { statusCode: 200, body: "<html>error</html>" } },
  });
  assert.match(notPhoto.result.message, /Couldn't download that page's photo/);
  const big = new Array(parser.LIMITS.image + 1).fill(0);
  big[0] = 0xff;
  big[1] = 0xd8;
  big[2] = 0xff;
  const tooBig = find({
    urls: [STORE],
    answers: { [STORE]: page("https://shop.example.com/rice.jpg"), "https://shop.example.com/rice.jpg": { statusCode: 200, body: big } },
  });
  assert.match(tooBig.result.message, /over 10 MB/);
});
