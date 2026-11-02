// Pantry items' photos, against a throwaway PocketBase on :8091 (set it up
// as pantry-rules.check.mjs says). Checks the photo field and its small
// copy, and that the route finding photos online refuses what it should. It
// doesn't fetch a real store page or ask Open Food Facts: these checks run
// on every deploy, and a website being slow or changed mustn't stop one.
//   node test/pantry-photo.check.mjs
// Every line should say PASS.
import { deflateSync, crc32 } from "node:zlib";

const B = `http://127.0.0.1:${process.env.BENTO_TEST_PORT || 8091}/api`;
async function call(token, method, path, body) {
  const res = await fetch(B + path, { method, headers: { "content-type": "application/json", ...(token && { authorization: token }) }, body: body && JSON.stringify(body) });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}
const check = (label, ok, extra = "") => console.log(`${ok ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);

// A plain orange PNG, width x height.
function png(width, height) {
  const chunk = (type, data) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8; // 8 bits per colour
  header[9] = 2; // red, green, blue
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, Buffer.from([0xb4, 0x53, 0x2a]))]);
  const pixels = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(pixels)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const admin = (await call("", "POST", "/collections/_superusers/auth-with-password", { identity: "test@example.com", password: "testpassword123" })).data.token;
const username = `photographer${Date.now()}`;
await call(admin, "POST", "/collections/users/records", { username, password: "testpass123", passwordConfirm: "testpass123", name: "Photographer" });
const { token } = (await call("", "POST", "/collections/users/auth-with-password", { identity: username, password: "testpass123" })).data;

// The photo field: a 400x300 photo gets a small copy that fits inside
// 160x160 without cutting anything off (160x120).
const item = (await call(token, "POST", "/collections/pantry_items/records", { name: `Photo check jam ${Date.now()}`, status: "have" })).data;
const form = new FormData();
form.append("photo", new Blob([png(400, 300)], { type: "image/png" }), "photo.png");
form.append("photo_link_tried", "https://www.example.com/jam");
const uploaded = await (await fetch(`${B}/collections/pantry_items/records/${item.id}`, { method: "PATCH", headers: { authorization: token }, body: form })).json();
check("a pantry item takes a photo", !!uploaded.photo, `(${uploaded.message ?? uploaded.photo})`);
check("and remembers the link tried", uploaded.photo_link_tried === "https://www.example.com/jam");
if (uploaded.photo) {
  const thumb = await fetch(`${B}/files/pantry_items/${item.id}/${uploaded.photo}?thumb=160x160f`);
  const bytes = Buffer.from(await thumb.arrayBuffer());
  const size = bytes.length > 24 ? `${bytes.readUInt32BE(16)}x${bytes.readUInt32BE(20)}` : "?";
  check("its small copy keeps the whole photo, inside 160x160", thumb.status === 200 && size === "160x120", `(${thumb.status} ${size})`);
}
const removed = (await call(token, "PATCH", `/collections/pantry_items/records/${item.id}`, { photo: null })).data;
check("the photo can be removed", removed.photo === "");

// Something that isn't a photo is refused.
const notPhoto = new FormData();
notPhoto.append("photo", new Blob(["not a photo"], { type: "text/plain" }), "photo.txt");
const refused = await fetch(`${B}/collections/pantry_items/records/${item.id}`, { method: "PATCH", headers: { authorization: token }, body: notPhoto });
check("a file that isn't a photo is refused", refused.status === 400, `(${refused.status})`);

// The route that finds a photo online (Open Food Facts, then the store links).
const route = "/cookbook/pantry-photo";
const guest = await call("", "POST", route, { urls: ["https://www.coles.com.au/product/x-1"] });
check("finding a photo online needs a login", guest.status === 401, `(${guest.status})`);
const nothing = await call(token, "POST", route, { barcodes: ["not a barcode", "123"], urls: [" "] });
check("it needs a real barcode or a link", nothing.status === 400 && /barcode or a store link/.test(nothing.data?.message ?? ""), `(${nothing.status} ${nothing.data?.message ?? ""})`);
// Every link is checked before any is read, so a public first link doesn't
// get a private second one through.
const home = await call(token, "POST", route, { urls: ["https://www.coles.com.au/product/x-1", "http://192.168.1.20/admin"] });
check("it won't read the home network", home.status === 400 && /own network/.test(home.data?.message ?? ""), `(${home.status} ${home.data?.message ?? ""})`);
const local = await call(token, "POST", route, { urls: ["http://localhost:8090/"] });
check("or this computer", local.status === 400, `(${local.status})`);
const typo = await call(token, "POST", route, { urls: ["coles jam"] });
check("a link that isn't a web address is refused", typo.status === 400 && /https/.test(typo.data?.message ?? ""), `(${typo.status} ${typo.data?.message ?? ""})`);
// A store that can't be reached is worth trying again later (503), not "no
// photo" (400, never asked again). ".invalid" names never exist, so this
// fails the same with or without an internet connection.
const away = await call(token, "POST", route, { urls: ["https://shop.bentotachi-check.invalid/product/1"] });
check("a store that can't be reached means try again later", away.status === 503, `(${away.status} ${away.data?.message ?? ""})`);

// Several store links: the first in store_url, the rest in more_store_urls.
const links = (await call(token, "POST", "/collections/pantry_items/records", {
  name: `Two-store sauce ${Date.now()}`,
  status: "have",
  store_url: "https://www.coles.com.au/product/x-1",
  more_store_urls: ["https://www.woolworths.com.au/shop/productdetails/1"],
})).data;
check("an item keeps more store links", links.store_url?.includes("coles") && links.more_store_urls?.[0]?.includes("woolworths"), `(${JSON.stringify(links.more_store_urls ?? links.message)})`);
// What an app from before more links (1.12.1) sends when saving an edit.
const older = (await call(token, "PATCH", `/collections/pantry_items/records/${links.id}`, { name: links.name, store_url: "https://www.coles.com.au/product/x-2" })).data;
check("an older app's edit leaves the other links alone", older.more_store_urls?.length === 1, `(${JSON.stringify(older.more_store_urls)})`);
await call(token, "DELETE", `/collections/pantry_items/records/${links.id}`);

await call(token, "DELETE", `/collections/pantry_items/records/${item.id}`);
