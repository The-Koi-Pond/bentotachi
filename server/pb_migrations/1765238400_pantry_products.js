/// <reference path="../pb_data/types.d.ts" />

// The products each pantry item's household buys (docs/VISION.md, "Products
// we buy"): [{brand, size, barcodes, links}], with the favourite still in
// usual_packet. The item's barcodes and store links are kept from them by
// the server (pb_hooks/pantry_products.js). Filled in here from what each
// item already knows: the brand and size of each one in stock, its barcodes
// and what they are (barcode_details), its favourite and brands, and its
// store links (onto the favourite).
//
// On purpose: the product rules below are a copy of pantry_products.js's as
// they were when this was written, not borrowed from it. The Pi and phones
// that skip a release run this later, against whatever that file has
// become by then. Saves skip the server's hooks: they would remember
// products from labels as they were before this filled in their brands.
//
// dates_used: someone has given this item, or one of its labels, a use-by
// date, so after a scan the app offers "+ Use-by" (and doesn't to
// households that never date things).

migrate((app) => {
  const MOST_LINKS = 5;
  const norm = (text) => String(text || "").trim().toLowerCase();
  const sameKind = (a, b) => norm(a.brand) === norm(b.brand) && norm(a.size) === norm(b.size);
  const isLink = (text) => /^https?:\/\/\S+$/i.test(text);
  const isCode = (text) => /^\d{8,14}$/.test(text);
  const texts = (list, keep) => {
    const out = [];
    const items = Array.isArray(list) ? list : [];
    for (let i = 0; i < items.length; i++) {
      const text = typeof items[i] === "string" ? items[i].trim() : "";
      if (text && keep(text) && out.indexOf(text) === -1) out.push(text);
    }
    return out;
  };
  const tidy = (product) => {
    const p = product || {};
    return {
      brand: String(p.brand || "").trim().slice(0, 120),
      size: String(p.size || "").trim().slice(0, 60),
      barcodes: texts(p.barcodes, isCode),
      links: texts(p.links, isLink).slice(0, MOST_LINKS),
    };
  };
  const parsed = (value, fallback) => {
    if (typeof value !== "string") return value == null ? fallback : value;
    try {
      return JSON.parse(value || "null") ?? fallback;
    } catch (err) {
      // Not readable: as if none.
      return fallback;
    }
  };
  const brandsOf = (text) =>
    String(text || "")
      .split(",")
      .map((b) => b.trim())
      .filter((b) => b);
  // Same brand and size join (barcode and link added); a barcode already on
  // an unnamed product moves to the named one.
  const withProduct = (products, add) => {
    const next = products.map(tidy);
    const incoming = tidy({
      brand: add.brand,
      size: add.size,
      barcodes: add.barcode ? [add.barcode] : [],
      links: add.link ? [add.link] : [],
    });
    const named = !!(incoming.brand || incoming.size);
    for (let i = 0; i < incoming.barcodes.length; i++) {
      const code = incoming.barcodes[i];
      const holder = next.find((p) => p.barcodes.indexOf(code) !== -1);
      if (!holder) continue;
      if (named && !(holder.brand || holder.size)) holder.barcodes = holder.barcodes.filter((c) => c !== code);
      else incoming.barcodes = incoming.barcodes.filter((c) => c !== code);
    }
    if (incoming.links.length && next.some((p) => p.links.indexOf(incoming.links[0]) !== -1)) incoming.links = [];
    const kept = next.filter((p) => p.brand || p.size || p.barcodes.length || p.links.length);
    const same = kept.find((p) => sameKind(p, incoming));
    if (same) {
      same.barcodes = same.barcodes.concat(incoming.barcodes.filter((c) => same.barcodes.indexOf(c) === -1));
      same.links = same.links.concat(incoming.links.filter((l) => same.links.indexOf(l) === -1)).slice(0, MOST_LINKS);
      return kept;
    }
    if (!named && !incoming.barcodes.length && !incoming.links.length) return kept;
    return kept.concat([incoming]);
  };

  const items = app.findCollectionByNameOrId("pantry_items");
  items.fields.add(new JSONField({ name: "products", maxSize: 50000 }));
  items.fields.add(new BoolField({ name: "dates_used" }));
  app.save(items);

  const quiet = app.unsafeWithoutHooks();
  const all = app.findRecordsByFilter("pantry_items", "", "", 0, 0);
  for (let i = 0; i < all.length; i++) {
    const item = all[i];
    // Until now a size with no brand ("200 g") meant the item's favourite
    // brand (the app left it off): with one favourite brand, it's spelled
    // out, so "Italiano 200 g" is one product, not two halves.
    const brands = brandsOf(item.getString("brand"));
    const only = brands.length === 1 ? brands[0] : "";
    let usual = parsed(item.getString("usual_packet"), null);
    if (!usual || typeof usual !== "object") usual = null;
    if (only && usual && !usual.brand && usual.size) {
      usual = { brand: only, size: usual.size };
      item.set("usual_packet", usual);
    }

    let list = [];
    let dated = !!item.getString("expires");
    const stock = app.findRecordsByFilter("pantry_packets", "item = {:item}", "created", 0, 0, { item: item.id });
    for (let j = 0; j < stock.length; j++) {
      if (only && !stock[j].getString("brand") && stock[j].getString("size")) {
        stock[j].set("brand", only);
        quiet.save(stock[j]);
      }
      list = withProduct(list, { brand: stock[j].getString("brand"), size: stock[j].getString("size"), barcode: stock[j].getString("barcode") });
      if (stock[j].getString("expires")) dated = true;
    }
    if (usual && (usual.brand || usual.size)) list = withProduct(list, { brand: usual.brand, size: usual.size });
    // A barcode nobody described, when it's the item's only barcode and the
    // item only ever knew one brand (its brands, favourite and labels): an
    // older app made it from a scan, with the brand and the barcode but
    // nothing saying the barcode was that brand's. Just the brand: the size
    // isn't known (the favourite may be another size), so a scan still
    // looks it up. More barcodes, or two brands, could be anything: left
    // unnamed.
    const details = parsed(item.getString("barcode_details"), {});
    const codes = parsed(item.getString("barcodes"), []);
    const named = brands.concat([usual && usual.brand], stock.map((label) => label.getString("brand"))).filter((b) => b && String(b).trim());
    const known = [];
    for (let j = 0; j < named.length; j++) if (known.indexOf(norm(named[j])) === -1) known.push(norm(named[j]));
    const guess = Array.isArray(codes) && codes.length === 1 && known.length === 1 ? { brand: String(named[0]).trim() } : {};
    for (let j = 0; j < (Array.isArray(codes) ? codes.length : 0); j++) {
      // A guess only for one no product (from a label) holds yet.
      const held = list.some((p) => p.barcodes.indexOf(codes[j]) !== -1);
      const described = (details && details[codes[j]]) || (held ? {} : guess);
      list = withProduct(list, { brand: described.brand, size: described.size, barcode: codes[j] });
    }
    // Last: a brand with a product by now ("Barilla 500 g") isn't added
    // again on its own ("Barilla").
    for (let j = 0; j < brands.length; j++) {
      if (!list.some((p) => norm(p.brand) === norm(brands[j]))) list = withProduct(list, { brand: brands[j] });
    }
    const more = parsed(item.getString("more_store_urls"), []);
    const links = [item.getString("store_url")].concat(Array.isArray(more) ? more : []);
    const home =
      (usual && (usual.brand || usual.size) && list.find((p) => sameKind(p, usual))) ||
      list.find((p) => only && norm(p.brand) === norm(only)) ||
      list[0];
    for (let j = 0; j < links.length; j++) {
      list = withProduct(list, home ? { brand: home.brand, size: home.size, link: links[j] } : { link: links[j] });
    }

    item.set("products", list);
    item.set("dates_used", dated);
    quiet.save(item);
  }
}, (app) => {
  const items = app.findCollectionByNameOrId("pantry_items");
  items.fields.removeByName("products");
  items.fields.removeByName("dates_used");
  app.save(items);
});
