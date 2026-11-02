// Run from the project folder with: node --test "server/test/*.test.js"
// Finding a product's photo on a shop's page, for pantry items' photos
// (pantry_photo.pb.js). The pages' meta tags are cut down from real Coles
// and Woolworths product pages (checked 2026-11-02).
const test = require("node:test");
const assert = require("node:assert/strict");
const { productPhotoUrl } = require("../pb_hooks/recipe_parse.js");

test("finds the photo on a Coles product page", () => {
  const html = `<head><meta property="og:image" content="https://cdn.productimages.coles.com.au/productimages/5/5328995.jpg"/></head>`;
  assert.equal(
    productPhotoUrl(html, "https://www.coles.com.au/product/heinz-ketchup-tomato-sauce-500ml-5328995"),
    "https://cdn.productimages.coles.com.au/productimages/5/5328995.jpg"
  );
});

test("takes Woolworths' 260-pixel photo instead of its 120-pixel one, with the attributes the other way round", () => {
  const html = `<meta content="https://cdn0.woolworths.media/content/wowproductimages/small/036059.jpg" property="og:image">`;
  assert.equal(
    productPhotoUrl(html, "https://www.woolworths.com.au/shop/productdetails/36059"),
    "https://cdn0.woolworths.media/content/wowproductimages/medium/036059.jpg"
  );
});

test("makes a photo address on the same site into a full one", () => {
  assert.equal(productPhotoUrl(`<meta property="og:image" content="/img/jam.png">`, "https://shop.example.com/jam"), "https://shop.example.com/img/jam.png");
  assert.equal(productPhotoUrl(`<meta property="og:image" content="//cdn.example.com/jam.png">`, "https://shop.example.com/jam"), "https://cdn.example.com/jam.png");
});

test("undoes &amp; in the address, and leaves other shops' 'small' alone", () => {
  assert.equal(
    productPhotoUrl(`<meta property="og:image" content="https://cdn.example.com/small/p.jpg?w=200&amp;h=200">`, "https://shop.example.com/p"),
    "https://cdn.example.com/small/p.jpg?w=200&h=200"
  );
});

test("a page without one gives nothing", () => {
  assert.equal(productPhotoUrl("<html><head><title>Coles</title></head></html>", "https://www.coles.com.au/"), "");
  assert.equal(productPhotoUrl("", "https://www.coles.com.au/"), "");
});
