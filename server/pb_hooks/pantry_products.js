// The products a pantry item's household buys (docs/VISION.md, "Products we
// buy"): [{brand, size, barcodes, links}], one per brand and size. The item's
// barcodes, store_url and more_store_urls are kept from them (deriveFields),
// so scanning, photos and older apps keep working. Not a hook (no .pb.js):
// the pantry hooks require it, and the Node tests load it.

const MOST_LINKS = 5;

function norm(text) {
  return String(text || "").trim().toLowerCase();
}

function sameKind(a, b) {
  return norm(a.brand) === norm(b.brand) && norm(a.size) === norm(b.size);
}

function texts(list, keep) {
  const out = [];
  const items = Array.isArray(list) ? list : [];
  for (let i = 0; i < items.length; i++) {
    const text = typeof items[i] === "string" ? items[i].trim() : "";
    if (text && keep(text) && out.indexOf(text) === -1) out.push(text);
  }
  return out;
}

const isLink = (text) => /^https?:\/\/\S+$/i.test(text);
const isCode = (text) => /^\d{8,14}$/.test(text);

function tidy(product) {
  const p = product || {};
  return {
    brand: String(p.brand || "").trim().slice(0, 120),
    size: String(p.size || "").trim().slice(0, 60),
    barcodes: texts(p.barcodes, isCode),
    links: texts(p.links, isLink).slice(0, MOST_LINKS),
  };
}

// A stored list (an array, JSON text from Go, or nothing) as tidy products.
function parseProducts(value) {
  let list = value;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list || "[]");
    } catch (err) {
      // Not readable: no products, rebuilt from the item's fields.
      list = [];
    }
  }
  if (!Array.isArray(list)) return [];
  return list.map(tidy).filter((p) => p.brand || p.size || p.barcodes.length || p.links.length);
}

// The products with this one added or joined: same brand and size join
// (its barcode and link added); a barcode already on an unnamed product, or
// on one of the same brand with no size, moves to the one that says more
// (the brand-only one goes, if that leaves it with nothing); a barcode
// already on another named one stays there.
function withProduct(products, add) {
  const next = products.map(tidy);
  const incoming = tidy({
    brand: add.brand,
    size: add.size,
    barcodes: add.barcode ? [add.barcode] : add.barcodes,
    links: add.link ? [add.link] : add.links,
  });
  const named = !!(incoming.brand || incoming.size);
  const emptied = [];
  for (let i = 0; i < incoming.barcodes.length; i++) {
    const code = incoming.barcodes[i];
    const holder = next.find((p) => p.barcodes.indexOf(code) !== -1);
    if (!holder) continue;
    const saysLess = !holder.size && !!incoming.size && norm(holder.brand) === norm(incoming.brand);
    if (named && (!(holder.brand || holder.size) || saysLess)) {
      holder.barcodes = holder.barcodes.filter((c) => c !== code);
      if (saysLess) emptied.push(holder);
    } else incoming.barcodes = incoming.barcodes.filter((c) => c !== code);
  }
  for (let i = 0; i < incoming.links.length; i++) {
    const link = incoming.links[i];
    if (next.some((p) => p.links.indexOf(link) !== -1)) incoming.links = incoming.links.filter((l) => l !== link);
  }
  const kept = next.filter(
    (p) => (p.brand || p.size || p.barcodes.length || p.links.length) && !(emptied.indexOf(p) !== -1 && !p.barcodes.length && !p.links.length)
  );
  const same = kept.find((p) => sameKind(p, incoming));
  if (same) {
    same.barcodes = same.barcodes.concat(incoming.barcodes.filter((c) => same.barcodes.indexOf(c) === -1));
    same.links = same.links.concat(incoming.links.filter((l) => same.links.indexOf(l) === -1)).slice(0, MOST_LINKS);
    return kept;
  }
  if (!named && !incoming.barcodes.length && !incoming.links.length) return kept;
  return kept.concat([incoming]);
}

function favouriteOf(products, usual) {
  if (!usual || !(usual.brand || usual.size)) return null;
  return products.find((p) => sameKind(p, usual)) || null;
}

function listOf(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === "string" && value) {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      // Not readable: none.
      return [];
    }
  }
  return [];
}

function objectOf(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value;
  if (typeof value === "string" && value) {
    try {
      const parsed = JSON.parse(value);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch (err) {
      // Not readable: none.
      return null;
    }
  }
  return null;
}

function brandsOf(text) {
  return String(text || "")
    .split(",")
    .map((b) => b.trim())
    .filter((b) => b);
}

// What a barcode nobody described is, when it's the item's only barcode and
// the item only ever knew one brand (its brand, favourite and labels): an
// older app made it from a scan, with the brand and the barcode but nothing
// saying the barcode was that brand's. Just the brand: the size isn't known
// (the favourite may be another size), so a scan still looks it up. More
// barcodes, or two brands, could be anything: left unnamed.
function onlyKind(fields) {
  if (listOf(fields.barcodes).length !== 1) return {};
  const usual = objectOf(fields.usual_packet) || {};
  const names = brandsOf(fields.brand).concat([usual.brand], fields.label_brands || []).filter((b) => b && String(b).trim());
  const known = [];
  for (let i = 0; i < names.length; i++) if (known.indexOf(norm(names[i])) === -1) known.push(norm(names[i]));
  return known.length === 1 ? { brand: String(names[0]).trim() } : {};
}

// Everything these older fields know that the products don't yet: barcodes
// (with what barcode_details says they are), store links, the favourite
// itself and favourite brands. For items from before products, and for
// older apps that still write those fields. `whole`: the item's fields as
// they are now, which say where its links go (onto the favourite), when
// `fields` holds only what one save changed.
function foldIn(products, fields, whole) {
  const all = whole || fields;
  let next = products;
  const usual = objectOf(fields.usual_packet);
  if (usual && (usual.brand || usual.size)) next = withProduct(next, { brand: usual.brand, size: usual.size });
  const details = objectOf(fields.barcode_details) || {};
  const codes = listOf(fields.barcodes);
  const guess = onlyKind(all);
  for (let i = 0; i < codes.length; i++) {
    // A guess only for one no product holds yet.
    const held = next.some((p) => p.barcodes.indexOf(codes[i]) !== -1);
    const known = details[codes[i]] || (held ? {} : guess);
    next = withProduct(next, { brand: known.brand, size: known.size, barcode: codes[i] });
  }
  // After the barcodes: a brand that has a product by now ("Barilla 500 g")
  // isn't added again on its own ("Barilla").
  const brands = brandsOf(fields.brand);
  for (let i = 0; i < brands.length; i++) {
    if (!next.some((p) => norm(p.brand) === norm(brands[i]))) next = withProduct(next, { brand: brands[i] });
  }
  const links = [fields.store_url].concat(listOf(fields.more_store_urls));
  const allBrands = brandsOf(all.brand);
  const home =
    favouriteOf(next, objectOf(all.usual_packet)) ||
    next.find((p) => allBrands.length === 1 && norm(p.brand) === norm(allBrands[0])) ||
    next[0];
  for (let i = 0; i < links.length; i++) {
    next = withProduct(next, home ? { brand: home.brand, size: home.size, link: links[i] } : { link: links[i] });
  }
  return next;
}

// Of an older app's save, only what it changed: a brand added to the list,
// a favourite picked, a barcode added or newly described, a store link
// added. What the fields already said is in the products, or was taken out
// of them on purpose (a product removed or renamed in this app), so folding
// it in again would bring it back.
function newSince(before, after) {
  const oldBrands = brandsOf(before.brand).map(norm);
  const oldUsual = objectOf(before.usual_packet) || {};
  const newUsual = objectOf(after.usual_packet) || {};
  const usualChanged = norm(oldUsual.brand) !== norm(newUsual.brand) || norm(oldUsual.size) !== norm(newUsual.size);
  const oldCodes = listOf(before.barcodes);
  const oldDetails = objectOf(before.barcode_details) || {};
  const newDetails = objectOf(after.barcode_details) || {};
  const oldLinks = [before.store_url].concat(listOf(before.more_store_urls));
  return {
    brand: brandsOf(after.brand)
      .filter((b) => oldBrands.indexOf(norm(b)) === -1)
      .join(", "),
    usual_packet: usualChanged ? after.usual_packet : "",
    barcodes: listOf(after.barcodes).filter(
      (code) => oldCodes.indexOf(code) === -1 || JSON.stringify(newDetails[code] || null) !== JSON.stringify(oldDetails[code] || null)
    ),
    barcode_details: newDetails,
    store_url: "",
    more_store_urls: [after.store_url].concat(listOf(after.more_store_urls)).filter((l) => l && oldLinks.indexOf(l) === -1),
  };
}

// The item's older fields as kept from its products: every barcode, and
// the store links with the favourite's first (at most 5, as before).
function deriveFields(products, usual) {
  const favourite = favouriteOf(products, objectOf(usual));
  const ordered = favourite ? [favourite].concat(products.filter((p) => p !== favourite)) : products;
  const barcodes = [];
  const links = [];
  for (let i = 0; i < ordered.length; i++) {
    for (let j = 0; j < ordered[i].barcodes.length; j++) {
      if (barcodes.indexOf(ordered[i].barcodes[j]) === -1) barcodes.push(ordered[i].barcodes[j]);
    }
    for (let j = 0; j < ordered[i].links.length; j++) {
      if (links.indexOf(ordered[i].links[j]) === -1) links.push(ordered[i].links[j]);
    }
  }
  const kept = links.slice(0, MOST_LINKS);
  return { barcodes: barcodes, store_url: kept[0] || "", more_store_urls: kept.slice(1) };
}

// What an older app took off the item's barcodes or links (comparing the
// saved item with the change), taken off its products too, so it doesn't
// come back from them.
function withoutRemoved(products, before, after) {
  const goneCodes = listOf(before.barcodes).filter((c) => listOf(after.barcodes).indexOf(c) === -1);
  const beforeLinks = [before.store_url].concat(listOf(before.more_store_urls));
  const afterLinks = [after.store_url].concat(listOf(after.more_store_urls));
  const goneLinks = beforeLinks.filter((l) => l && afterLinks.indexOf(l) === -1);
  if (!goneCodes.length && !goneLinks.length) return products;
  return products
    .map((p) => ({
      brand: p.brand,
      size: p.size,
      barcodes: p.barcodes.filter((c) => goneCodes.indexOf(c) === -1),
      links: p.links.filter((l) => goneLinks.indexOf(l) === -1),
    }))
    .filter((p) => p.brand || p.size || p.barcodes.length || p.links.length);
}

// Sets an item record's products and the fields kept from them.
function applyProducts(record, products) {
  const fields = deriveFields(products, record.getString("usual_packet"));
  record.set("products", products);
  record.set("barcodes", fields.barcodes);
  record.set("store_url", fields.store_url);
  record.set("more_store_urls", fields.more_store_urls);
}

// An item saved through the API (pantry_products.pb.js). This app sends its
// products: they're the truth, and its barcodes and store links follow
// them. A save without them (an older app, or a status tap) changes the
// older fields instead: what it added joins the products and what it took
// off leaves them, and what it sent stands as sent (so a store link that
// isn't a web address is still refused, not quietly dropped). Either way, a
// use-by date means the household dates things.
function keepProducts(e, created) {
  const record = e.record;
  const body = e.requestInfo().body || {};
  let list = parseProducts(record.getString("products"));
  if (Object.prototype.hasOwnProperty.call(body, "products")) {
    applyProducts(record, list);
  } else {
    const fields = (r) => ({
      brand: r.getString("brand"),
      usual_packet: r.getString("usual_packet"),
      barcodes: r.getString("barcodes"),
      barcode_details: r.getString("barcode_details"),
      store_url: r.getString("store_url"),
      more_store_urls: r.getString("more_store_urls"),
    });
    const after = fields(record);
    if (!created) {
      // Its labels' brands count as brands it knows (onlyKind).
      const labels = e.app.findRecordsByFilter("pantry_packets", "item = {:item}", "", 0, 0, { item: record.id });
      after.label_brands = labels.map((label) => label.getString("brand"));
    }
    if (created) {
      record.set("products", foldIn(list, after));
    } else {
      const before = fields(record.original());
      list = withoutRemoved(list, before, after);
      record.set("products", foldIn(list, newSince(before, after), after));
    }
  }
  if (record.getString("expires")) record.set("dates_used", true);
}

// One in stock with a brand and size, or a barcode, not among its item's
// products yet: remembered as one (another brand bought instead, a new
// size, a barcode scanned), so it's offered next time. One with a use-by
// date means the household dates this item. `was`: its brand and size
// before a change: corrected ("5 kg" was really "1 kg"), its barcode moves
// from the product it was on to the corrected one, or the next scan would
// say 5 kg again.
function rememberProduct(app, label, was) {
  let item;
  try {
    item = app.findRecordById("pantry_items", label.getString("item"));
  } catch (err) {
    // The item itself was just removed: nothing to remember.
    return;
  }
  const before = parseProducts(item.getString("products"));
  const code = label.getString("barcode");
  const now = { brand: label.getString("brand"), size: label.getString("size") };
  const start =
    was && code && !sameKind(was, now)
      ? before.map((p) => (sameKind(p, was) ? { brand: p.brand, size: p.size, barcodes: p.barcodes.filter((c) => c !== code), links: p.links } : p))
      : before;
  const after = withProduct(start, {
    brand: label.getString("brand"),
    size: label.getString("size"),
    barcode: label.getString("barcode"),
  });
  const dated = !!label.getString("expires") && !item.getBool("dates_used");
  if (JSON.stringify(after) === JSON.stringify(before) && !dated) return;
  applyProducts(item, after);
  if (dated) item.set("dates_used", true);
  app.save(item);
}

module.exports = {
  parseProducts,
  withProduct,
  foldIn,
  newSince,
  deriveFields,
  withoutRemoved,
  applyProducts,
  sameKind,
  keepProducts,
  rememberProduct,
};
