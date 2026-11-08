// Pulls a recipe out of a web page's HTML.
//
// Most recipe sites embed a machine-readable copy of the recipe in the page
// (schema.org "Recipe" data inside <script type="application/ld+json">), so we
// read that instead of guessing from the visible page. Some older recipe
// plugins (like EasyRecipe) instead label the visible recipe itself with
// itemprop="..." attributes ("microdata"); that's read when there's no JSON-LD.
//
// Plain CommonJS (module.exports), so the same file runs inside
// PocketBase's JavaScript engine and in Node for the tests. It's written in
// older-style JS (var, no ?. or ??) from an old belief the engine needed
// it; it doesn't (see CLAUDE.md), but there's no need to rewrite it.

var BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/130.0 Safari/537.36";

var NAMED_ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ",
  frac12: "½", frac14: "¼", frac34: "¾", deg: "°", ndash: "–", mdash: "—",
  lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", hellip: "…", times: "×",
};

function decodeEntities(text) {
  // Two passes because some sites double-encode ("&amp;#39;").
  for (var pass = 0; pass < 2; pass++) {
    text = text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+\d*);/gi, function (whole, code) {
      if (code[0] === "#") {
        var isHex = code[1] === "x" || code[1] === "X";
        var n = parseInt(code.slice(isHex ? 2 : 1), isHex ? 16 : 10);
        try { return String.fromCodePoint(n); } catch (err) { return whole; }
      }
      var named = NAMED_ENTITIES[code.toLowerCase()];
      return named === undefined ? whole : named;
    });
  }
  return text;
}

// Turns any value into tidy single-line text: no HTML tags, no entities,
// no runs of whitespace.
function cleanText(value) {
  if (value === null || value === undefined) return "";
  var text = String(value);
  text = decodeEntities(text);
  text = text.replace(/<[^>]*>/g, " ");
  text = decodeEntities(text);
  // Removing tags (like a link around a word) can leave "word , more )":
  // no space before closing punctuation or after an opening bracket.
  // WP Recipe Maker joins an ingredient's note with a comma inside the
  // bracket ("1 garlic clove (, finely grated)"): the comma goes, and a
  // bracket left empty goes too. (Migration 1763337600 fixes older recipes
  // the same way.)
  return text
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?)\]])/g, "$1")
    .replace(/([(\[])\s+/g, "$1")
    .replace(/\(\s*[,;]\s*/g, "(")
    .replace(/\s*\(\s*\)/g, "")
    .trim();
}

function findJsonLdBlocks(html) {
  var blocks = [];
  var re = /<script[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi;
  var match;
  while ((match = re.exec(html)) !== null) {
    var raw = match[1].trim().replace(/^<!\[CDATA\[/, "").replace(/\]\]>$/, "");
    try {
      blocks.push(JSON.parse(raw));
    } catch (err) {
      // A broken block on the page shouldn't stop us checking the others.
    }
  }
  return blocks;
}

function isRecipeType(type) {
  var types = Array.isArray(type) ? type : [type];
  for (var i = 0; i < types.length; i++) {
    if (typeof types[i] === "string" && /(^|\/)Recipe$/.test(types[i])) return true;
  }
  return false;
}

// Sites nest the recipe in different places (@graph lists, arrays,
// mainEntity...), so search the whole structure, a few levels deep.
function findRecipeNode(node, depth) {
  if (!node || typeof node !== "object" || depth > 6) return null;
  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) {
      var found = findRecipeNode(node[i], depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (isRecipeType(node["@type"])) return node;
  for (var key in node) {
    if (Object.prototype.hasOwnProperty.call(node, key)) {
      var inner = findRecipeNode(node[key], depth + 1);
      if (inner) return inner;
    }
  }
  return null;
}

function resolveUrl(url, pageUrl) {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  if (url.indexOf("//") === 0) return "https:" + url;
  var origin = (pageUrl.match(/^https?:\/\/[^\/]+/i) || [""])[0];
  if (url[0] === "/" && origin) return origin + url;
  return "";
}

function pickImage(image) {
  if (!image) return "";
  if (typeof image === "string") return image;
  if (Array.isArray(image)) return pickImage(image[0]);
  if (typeof image === "object") return image.url || image.contentUrl || "";
  return "";
}

function findMetaImage(html) {
  var match =
    html.match(/<meta[^>]*property\s*=\s*["']og:image["'][^>]*content\s*=\s*["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*content\s*=\s*["']([^"']+)["'][^>]*property\s*=\s*["']og:image["']/i);
  return match ? decodeEntities(match[1]) : "";
}

// A shop product page's photo, as a full address, or "": the picture the
// page shows when its link is shared (og:image). Used for pantry items'
// photos (pantry_photo.pb.js). Woolworths' is 120 pixels across, blurry in
// the edit form, so its 260-pixel copy (same address, "medium") is used.
function productPhotoUrl(html, pageUrl) {
  var url = resolveUrl(findMetaImage(html || ""), pageUrl);
  // A shop's stand-in for a product without a photo (Woolworths gives
  // ".../wowproductimages/small/default.png", an "Image coming soon"
  // picture) isn't a photo of it.
  var file = (url.split(/[?#]/)[0].split("/").pop() || "").replace(/\.\w+$/, "");
  if (/^(default|placeholder|no[-_]?image|no[-_]?photo|(image[-_]?)?coming[-_]?soon)$/i.test(file)) return "";
  return url.replace(/^(https:\/\/cdn\d*\.woolworths\.media\/content\/wowproductimages\/)small\//i, "$1medium/");
}

// "PT1H30M" (the standard duration format) -> 90. Returns 0 if unreadable.
function durationToMinutes(value) {
  if (typeof value !== "string") return 0;
  var m = value.trim().match(
    /^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i
  );
  if (!m) return 0;
  var minutes =
    parseFloat(m[1] || 0) * 1440 +
    parseFloat(m[2] || 0) * 60 +
    parseFloat(m[3] || 0) +
    parseFloat(m[4] || 0) / 60;
  return Math.round(minutes);
}

function pickServings(recipeYield) {
  var values = Array.isArray(recipeYield) ? recipeYield : [recipeYield];
  // Prefer a value with words ("4 servings") over a bare number ("4").
  var fallback = "";
  for (var i = 0; i < values.length; i++) {
    var text = cleanText(values[i]);
    if (!text) continue;
    if (/[a-z]/i.test(text)) return text;
    if (!fallback) fallback = text;
  }
  return fallback;
}

// One tidied ingredient or step line, or "" to leave it out. Lines with no
// letters or numbers (some plugins use "." as a spacer) are left out, and a
// short line ending in ":" with no numbers ("For the chicken:") becomes a
// "# For the chicken" heading, which the app shows as a heading.
function tidyLine(text) {
  if (!/[a-z0-9]/i.test(text)) return "";
  if (/:$/.test(text) && !/\d/.test(text) && text.length <= 60 && text[0] !== "#") {
    return "# " + text.replace(/\s*:$/, "");
  }
  return text;
}

function toLines(list) {
  var values = Array.isArray(list) ? list : list ? [list] : [];
  var lines = [];
  for (var i = 0; i < values.length; i++) {
    // A popular WordPress recipe plugin wraps notes in double brackets.
    var text = tidyLine(cleanText(values[i]).replace(/\(\(([^()]*)\)\)/g, "($1)"));
    if (text) lines.push(text);
  }
  return lines;
}

// Some sites list each ingredient's amount and name as two ingredients
// ("1 tablespoon", "olive oil": The Kitchn, found 2026-11-07 when Paprika
// showed them on separate lines). An amount alone, maybe with its unit,
// is joined to the line after it, unless that's a heading or another
// amount.
var AMOUNT_ONLY =
  /^[\d½¼¾⅓⅔⅛⅜⅝⅞]+(\s*[.,/\-–]?\s*[\d½¼¾⅓⅔⅛⅜⅝⅞]+)*(\s+(cups?|c|tablespoons?|tbsps?|tbs|teaspoons?|tsps?|pounds?|lbs?|ounces?|oz|grams?|g|kilograms?|kg|millilit(er|re)s?|ml|lit(er|re)s?|l|quarts?|pints?|pinch(es)?|dash(es)?|cloves?|cans?|sprigs?|bunch(es)?|handfuls?|sticks?|slices?|pieces?|large|medium|small|whole))?\.?$/i;

function joinAmounts(lines) {
  var joined = [];
  for (var i = 0; i < lines.length; i++) {
    var next = lines[i + 1];
    if (AMOUNT_ONLY.test(lines[i]) && next && next[0] !== "#" && !AMOUNT_ONLY.test(next)) {
      joined.push(lines[i] + " " + next);
      i += 1;
    } else joined.push(lines[i]);
  }
  return joined;
}

// Some sites run numbered steps together in one piece of text: "1. Heat the
// oil.2. Add the onion." Splits it at each number, but only when the numbers
// go 1, 2, 3… in order, each right after the end of a sentence and before a
// capital letter (so "1.5 lbs" or "Bake for 2. minutes" stay put).
function splitNumberedSteps(text) {
  var re = /(\d{1,2})[.)]\s*(?=[A-Z])/g;
  var cuts = [];
  var expected = 1;
  var m;
  while ((m = re.exec(text)) !== null) {
    if (Number(m[1]) !== expected) continue;
    var before = text.slice(0, m.index).replace(/\s+$/, "");
    if (before && !/[.!?)]$/.test(before)) continue;
    cuts.push({ at: m.index, after: re.lastIndex });
    expected += 1;
  }
  if (cuts.length < 2 || cuts[0].at !== 0) return [text];
  var pieces = [];
  for (var i = 0; i < cuts.length; i++) {
    pieces.push(text.slice(cuts[i].after, i + 1 < cuts.length ? cuts[i + 1].at : text.length));
  }
  return pieces;
}

// One step's text, without a "1." or "2)" in front: the app numbers steps.
function addStep(steps, text) {
  var step = tidyLine(text.replace(/^\d{1,2}[.)]\s+(?=\S)/, ""));
  if (step) steps.push(step);
}

// Instructions come as one block of text, a list of strings, a list of
// HowToStep objects, or HowToSection groups of steps. Section names become
// "# Heading" lines, which the app shows as headings. A HowToStep's own
// photo ("image") is noted in `images` as { step: its line, url }, for
// people who want step photos (import.pb.js).
function collectSteps(node, steps, images) {
  if (!node) return;
  if (typeof node === "string") {
    var parts = decodeEntities(node).split(/\r?\n|<br\s*\/?>|<\/p>|<\/li>/i);
    for (var i = 0; i < parts.length; i++) {
      var pieces = splitNumberedSteps(cleanText(parts[i]));
      for (var p = 0; p < pieces.length; p++) addStep(steps, pieces[p].trim());
    }
    return;
  }
  if (Array.isArray(node)) {
    for (var j = 0; j < node.length; j++) collectSteps(node[j], steps, images);
    return;
  }
  if (typeof node === "object") {
    var children = node.itemListElement || node.steps;
    if (children) {
      var heading = cleanText(node.name);
      if (heading && isType(node, "HowToSection")) steps.push("# " + heading);
      collectSteps(children, steps, images);
      return;
    }
    var before = steps.length;
    addStep(steps, cleanText(node.text || node.name || node.description));
    var photo = pickImage(node.image);
    if (images && photo && steps.length > before) images.push({ step: steps[steps.length - 1], url: photo });
  }
}

function isType(node, name) {
  var types = Array.isArray(node["@type"]) ? node["@type"] : [node["@type"]];
  return types.indexOf(name) !== -1;
}

function collectTags(recipe) {
  var tags = [];
  var seen = {};
  var sources = [].concat(recipe.recipeCategory || [], recipe.recipeCuisine || []);
  for (var i = 0; i < sources.length; i++) {
    var pieces = String(sources[i]).split(",");
    for (var j = 0; j < pieces.length; j++) {
      var tag = cleanText(pieces[j]).toLowerCase();
      if (tag && !seen[tag]) {
        seen[tag] = true;
        tags.push(tag);
      }
    }
  }
  return tags;
}

// ---- Recipe data written into a script ----
//
// Some sites (seen: PureWow) don't put the recipe data in the page; a script
// adds it once the page runs in a browser, e.g.
//   recipeSchema.innerHTML = JSON.stringify([{"@type":"Recipe", ...}]);
// The data is still in the script's text, so find it there.

// Where the JSON value starting at `start` ("{" or "[") ends, or -1.
function jsonValueEnd(text, start) {
  var depth = 0;
  var inString = false;
  for (var i = start; i < text.length; i++) {
    var c = text[i];
    if (inString) {
      if (c === "\\") i += 1;
      else if (c === '"') inString = false;
    } else if (c === '"') {
      inString = true;
    } else if (c === "{" || c === "[") {
      depth += 1;
    } else if (c === "}" || c === "]") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

function findScriptRecipe(html) {
  var marker = /"@type"\s*:\s*(\[[^\]]*)?"(https?:\/\/schema\.org\/)?Recipe"/g;
  var m;
  var tries = 0;
  while ((m = marker.exec(html)) !== null && tries < 20) {
    tries += 1;
    // Try the brackets before the marker, nearest first, until one holds a
    // complete recipe (the outer ones may be wrapped in non-JSON code).
    for (var start = m.index, attempts = 0; start > 0 && attempts < 12; attempts++) {
      start = Math.max(html.lastIndexOf("{", start - 1), html.lastIndexOf("[", start - 1));
      if (start < 0) break;
      var end = jsonValueEnd(html, start);
      if (end < m.index) continue;
      try {
        var recipe = findRecipeNode(JSON.parse(html.slice(start, end)), 0);
        if (recipe) return recipe;
      } catch (err) {
        // Not JSON from here; try the next bracket out.
      }
    }
  }
  return null;
}

// ---- Microdata ----

// Tags with no closing tag.
var VOID_TAGS = { img: 1, meta: 1, link: 1, br: 1, hr: 1, input: 1, source: 1 };

// The element whose opening tag starts at `start`: its tag name, opening
// tag, inner HTML, and where it ends (counting nested tags of the same name).
function elementAt(html, start) {
  var open = html.slice(start).match(/^<([a-z][a-z0-9]*)\b[^>]*>/i);
  if (!open) return null;
  var tag = open[1].toLowerCase();
  var innerStart = start + open[0].length;
  if (VOID_TAGS[tag] || /\/>$/.test(open[0])) return { tag: tag, openTag: open[0], inner: "", end: innerStart };
  var re = new RegExp("<(/?)" + tag + "\\b[^>]*>", "gi");
  re.lastIndex = innerStart;
  var depth = 1;
  var m;
  while ((m = re.exec(html)) !== null) {
    if (m[1]) {
      depth -= 1;
      if (depth === 0) return { tag: tag, openTag: open[0], inner: html.slice(innerStart, m.index), end: re.lastIndex };
    } else if (!/\/>$/.test(m[0])) {
      depth += 1;
    }
  }
  return { tag: tag, openTag: open[0], inner: html.slice(innerStart), end: html.length };
}

// An attribute's value from an opening tag, or "".
function attribute(openTag, name) {
  var m = openTag.match(new RegExp("\\s" + name + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s>]+))", "i"));
  if (!m) return "";
  return decodeEntities(m[1] !== undefined ? m[1] : m[2] !== undefined ? m[2] : m[3]);
}

// What a labelled element says: its content="" if it has one, an image's
// address, a time's datetime="", otherwise its inner HTML (cleaned later).
function microdataValue(element) {
  var content = attribute(element.openTag, "content");
  if (content) return content;
  if (element.tag === "img") {
    // Lazy-loading pages put a blank placeholder in src and the real
    // address in data-src.
    var src = attribute(element.openTag, "src");
    if (src && !/^data:/i.test(src)) return src;
    return attribute(element.openTag, "data-src") || attribute(element.openTag, "data-lazy-src") || src;
  }
  if (element.tag === "time") return attribute(element.openTag, "datetime") || element.inner;
  if (element.tag === "link" || element.tag === "a") return attribute(element.openTag, "href") || element.inner;
  return element.inner;
}

// A recipe labelled with microdata, in the same shape as a JSON-LD recipe,
// or null. Labels inside nested items (like the author or the rating) belong
// to those items, so they're skipped. Older pages use data-vocabulary.org's
// names (ingredient, instructions, yield, summary, photo); those map across.
function findMicrodataRecipe(html) {
  var start = html.search(
    /<[a-z][a-z0-9]*\b[^>]*\bitemtype\s*=\s*["']?https?:\/\/(?:www\.)?(?:schema\.org|data-vocabulary\.org)\/Recipe["'\s>\/]/i
  );
  if (start < 0) return null;
  var root = elementAt(html, start);
  if (!root) return null;
  var scope = root.inner;

  var nested = [];
  var scopeRe = /<[a-z][a-z0-9]*\b[^>]*\bitemscope\b[^>]*>/gi;
  var sm;
  while ((sm = scopeRe.exec(scope)) !== null) {
    var item = elementAt(scope, sm.index);
    if (item) nested.push([sm.index, item.end]);
  }
  function insideNestedItem(at) {
    for (var i = 0; i < nested.length; i++) {
      if (at > nested[i][0] && at < nested[i][1]) return true;
    }
    return false;
  }

  var props = {};
  var propRe = /<[a-z][a-z0-9]*\b[^>]*\bitemprop\s*=\s*["']?([^"'>]+)/gi;
  var pm;
  while ((pm = propRe.exec(scope)) !== null) {
    if (insideNestedItem(pm.index)) continue;
    var element = elementAt(scope, pm.index);
    if (!element) continue;
    var value = microdataValue(element);
    var names = pm[1].trim().split(/\s+/);
    for (var n = 0; n < names.length; n++) {
      (props[names[n]] = props[names[n]] || []).push(value);
    }
  }
  function first(name) {
    return props[name] ? props[name][0] : undefined;
  }

  return {
    "@type": "Recipe",
    fromMicrodata: true,
    name: first("name"),
    description: first("description") || first("summary"),
    image: first("image") || first("photo"),
    recipeYield: props.recipeYield || props.yield,
    prepTime: first("prepTime"),
    cookTime: first("cookTime"),
    totalTime: first("totalTime"),
    recipeIngredient: props.recipeIngredient || props.ingredients || props.ingredient,
    recipeInstructions: props.recipeInstructions || props.instructions,
    recipeCategory: props.recipeCategory,
    recipeCuisine: props.recipeCuisine,
  };
}

// ---- A recipe written as ordinary text ----
//
// Last resort, for blogs that write the recipe into the post with no data at
// all (seen: ladyandpups.com): an "Ingredients" line, the ingredients as
// short lines, then the method as paragraphs. A best guess, so it's careful:
// it reads only the post itself, stops at things like "Related posts", and
// needs at least two ingredients and a step.

// The app's built-in browser only sends a post with no recipe data when it
// sees one of these headings (READ_PAGE_JS in web/android/.../BrowserActivity.java):
// change both together.
// "you'll" with a straight or curly apostrophe (WordPress turns ' into ’).
var INGREDIENTS_HEADING = /^(ingredients?|what you(['’]ll| will)? need|you(['’]ll| will)? need)\b[^.]{0,40}$/i;
var STEPS_HEADING = /^(instructions?|directions?|method|preparation|steps|how to make( it)?)\b[^.]{0,30}$/i;
var END_OF_RECIPE = /^(related posts?|you (may|might) also like|more recipes|subscribe|share (this|on)|sign up|leave a (reply|comment)|\d+ (comments?|responses?)|comments?|posted in|filed under|tags?:)/i;

// The page's text as lines: one per paragraph, list item, heading or line break.
function textLines(html) {
  var text = html
    .replace(/<(script|style|noscript|figcaption|button|form)\b[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|li|h[1-6]|div|tr|dd|dt|blockquote)>/gi, "\n");
  return text
    .split("\n")
    .map(function (line) {
      return cleanText(line);
    })
    .filter(Boolean);
}

// The post's own text: the usual WordPress-style containers, else <article>.
function postHtml(html) {
  var start = html.search(/<[a-z][a-z0-9]*\b[^>]*\bclass\s*=\s*["'][^"']*\b(entry-content|post-content|article-content|post-body)\b/i);
  if (start < 0) start = html.search(/<article\b/i);
  if (start < 0) return "";
  var element = elementAt(html, start);
  return element ? element.inner : "";
}

// An ingredient line is short and isn't a sentence of instructions.
function looksLikeIngredient(line) {
  if (line.length > 150) return false;
  var words = line.split(/\s+/).length;
  return !(/[.!]$/.test(line) && words >= 6 && !/^[\d½¼¾⅓⅔⅛]/.test(line));
}

function pageTitle(html) {
  var og =
    html.match(/<meta[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']*)["']/i) ||
    html.match(/<meta[^>]*content\s*=\s*["']([^"']*)["'][^>]*property\s*=\s*["']og:title["']/i);
  var title = og ? cleanText(og[1]) : cleanText((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || ["", ""])[1]);
  var site = html.match(/<meta[^>]*property\s*=\s*["']og:site_name["'][^>]*content\s*=\s*["']([^"']*)["']/i);
  if (site && site[1]) title = title.split(cleanText(site[1])).join("");
  return title.replace(/\s*[-–|·:]\s*$/, "").replace(/^\s*[-–|·:]\s*/, "").trim();
}

function findPlainTextRecipe(html) {
  var lines = textLines(postHtml(html));
  var at = -1;
  for (var i = 0; i < lines.length; i++) {
    if (INGREDIENTS_HEADING.test(lines[i])) {
      at = i;
      break;
    }
  }
  if (at < 0) return null;

  var ingredients = [];
  var steps = [];
  var j = at + 1;
  for (; j < lines.length; j++) {
    if (STEPS_HEADING.test(lines[j])) {
      j += 1;
      break;
    }
    if (END_OF_RECIPE.test(lines[j]) || !looksLikeIngredient(lines[j])) break;
    ingredients.push(lines[j]);
  }
  for (; j < lines.length; j++) {
    if (END_OF_RECIPE.test(lines[j])) break;
    if (lines[j].split(/\s+/).length >= 3) steps.push(lines[j]);
  }
  if (ingredients.length < 2 || steps.length < 1) return null;

  return {
    "@type": "Recipe",
    fromPage: true,
    name: pageTitle(html),
    recipeIngredient: ingredients,
    recipeInstructions: steps,
  };
}

// The recipe writer's own notes (swaps, storage, tips), which recipe data
// doesn't include: the notes box of the usual recipe plugins (WP Recipe
// Maker, Tasty Recipes, Mediavine Create), as lines without its "Notes"
// heading. [] if the page has none.
var NOTES_BOXES = ["wprm-recipe-notes", "tasty-recipes-notes-body", "tasty-recipes-notes", "mv-create-notes-content", "mv-create-notes"];

function findAuthorNotes(html) {
  for (var i = 0; i < NOTES_BOXES.length; i++) {
    // The whole class name, not part of a longer one ("…-notes-container").
    var start = html.search(new RegExp("<[a-z][a-z0-9]*\\b[^>]*\\bclass\\s*=\\s*[\"'](?:[^\"']*\\s)?" + NOTES_BOXES[i] + "(?=[\\s\"'])", "i"));
    if (start < 0) continue;
    var element = elementAt(html, start);
    // WP Recipe Maker writes each note as a block-style <span>.
    var inner = element ? element.inner.replace(/<span\b[^>]*display\s*:\s*block[^>]*>/gi, "\n") : "";
    var lines = textLines(inner);
    if (lines.length && /^(recipe )?notes?:?$/i.test(lines[0])) lines.shift();
    if (lines.length) return lines;
  }
  return [];
}

// Ingredient sections ("Marinade:", "Sauce:", "Serving:"): recipe data
// lists ingredients as one flat list, so the section headings only exist in
// the page's recipe card (WP Recipe Maker, Tasty Recipes, Mediavine Create;
// RecipeTin Eats' came in flat without this). Reads the card's
// headings and how many ingredients each one covers, then puts "# Heading"
// lines into the recipe data's list at those places. Only when the card
// lists exactly as many ingredients as the data, so a heading can't land in
// the wrong place; otherwise the list stays as it was.
var INGREDIENT_BOXES = ["wprm-recipe-ingredients-container", "tasty-recipes-ingredients", "mv-create-ingredients"];

function ingredientSections(html) {
  for (var i = 0; i < INGREDIENT_BOXES.length; i++) {
    var start = html.search(new RegExp("<[a-z][a-z0-9]*\\b[^>]*\\bclass\\s*=\\s*[\"'](?:[^\"']*\\s)?" + INGREDIENT_BOXES[i] + "(?=[\\s\"'])", "i"));
    if (start < 0) continue;
    var element = elementAt(html, start);
    if (!element) continue;
    // In order: each heading, then how many list items follow it.
    var sections = [];
    var current = null;
    var re = /<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>|<li\b/gi;
    var m;
    while ((m = re.exec(element.inner)) !== null) {
      if (m[1] !== undefined) {
        var heading = cleanText(m[1]).replace(/\s*:\s*$/, "");
        // The card's own "Ingredients" title ("Ingredients (serves 4)"),
        // before any section, isn't one; later, "Ingredients for the
        // sauce" is.
        var title = !sections.length && /^ingredients\b/i.test(heading);
        if (heading && !title) sections.push((current = { heading: heading, count: 0 }));
        continue;
      }
      if (!current) sections.push((current = { heading: "", count: 0 }));
      current.count += 1;
    }
    sections = sections.filter(function (section) {
      return section.count > 0;
    });
    if (sections.some(function (section) { return section.heading; })) return sections;
  }
  return [];
}

// The recipe data's ingredient lines with the card's section headings put in
// (ingredientSections), or the lines as they were when they don't line up.
function withSections(lines, sections) {
  var total = 0;
  for (var i = 0; i < sections.length; i++) total += sections[i].count;
  if (!sections.length || total !== lines.length) return lines;
  var out = [];
  var at = 0;
  for (var j = 0; j < sections.length; j++) {
    if (sections[j].heading) out.push("# " + sections[j].heading);
    for (var k = 0; k < sections[j].count; k++) out.push(lines[at++]);
  }
  return out;
}

// The site's own rating from a recipe's aggregateRating, out of 5 with one
// decimal, and how many people gave it; null when there's none or it makes
// no sense (no ratings yet, a value off the scale). Sites rating out of 10
// or 100 (bestRating) are scaled to 5.
function siteRating(aggregate) {
  if (Array.isArray(aggregate)) aggregate = aggregate[0];
  if (!aggregate || typeof aggregate !== "object") return null;
  var number = function (v) {
    var n = parseFloat(String(v === undefined || v === null ? "" : v).replace(",", "."));
    return isFinite(n) ? n : NaN;
  };
  // A count is a whole number: "2,341", "2.341" and "2 341" are all 2341
  // (a separator followed by three digits groups thousands), while "12.0"
  // is 12. One past what the database can keep exactly (2^53) is nonsense,
  // and would make the import fail.
  var whole = function (v) {
    if (Array.isArray(v)) v = v[0];
    var n = typeof v === "number" ? Math.round(v) : NaN;
    if (typeof v === "string") {
      if (/^\s*\d{1,3}([\s.,']\d{3})+\s*$/.test(v)) n = parseInt(v.replace(/\D/g, ""), 10);
      else if (/^\s*\d+(\.\d+)?\s*$/.test(v)) n = Math.round(parseFloat(v));
    }
    return n >= 0 && n <= 9007199254740991 ? n : NaN;
  };
  var value = number(aggregate.ratingValue);
  var best = number(aggregate.bestRating);
  if (!(best > 0)) best = 5;
  var count = whole(aggregate.ratingCount);
  if (!(count >= 0)) count = whole(aggregate.reviewCount);
  if (!(value > 0) || value > best || !(count >= 1)) return null;
  return { value: Math.round((value / best) * 50) / 10, count: count };
}

// The page's nutrition facts (schema.org NutritionInformation, per
// serving) as lines like "Calories: 420 kcal", in the order nutrition
// labels use. A bare number gets its usual unit; the site's own wording
// ("12 grams") is otherwise kept. [] when there are none.
var NUTRIENTS = [
  ["servingSize", "Serving", ""],
  ["calories", "Calories", "kcal"],
  ["fatContent", "Fat", "g"],
  ["saturatedFatContent", "Saturated fat", "g"],
  ["transFatContent", "Trans fat", "g"],
  ["unsaturatedFatContent", "Unsaturated fat", "g"],
  ["cholesterolContent", "Cholesterol", "mg"],
  ["sodiumContent", "Sodium", "mg"],
  ["carbohydrateContent", "Carbohydrates", "g"],
  ["fiberContent", "Fiber", "g"],
  ["sugarContent", "Sugar", "g"],
  ["proteinContent", "Protein", "g"],
];

function nutritionLines(nutrition) {
  if (Array.isArray(nutrition)) nutrition = nutrition[0];
  if (!nutrition || typeof nutrition !== "object") return [];
  var lines = [];
  for (var i = 0; i < NUTRIENTS.length; i++) {
    var value = nutrition[NUTRIENTS[i][0]];
    if (Array.isArray(value)) value = value[0];
    var key = NUTRIENTS[i][0];
    var unit = NUTRIENTS[i][2];
    // Text or a number; an object (some sites' QuantitativeValue) would
    // come out as "[object Object]".
    if (typeof value !== "string" && typeof value !== "number") continue;
    // Without the label when the site repeats it ("Calories: 420").
    var text = cleanText(value).replace(new RegExp("^" + NUTRIENTS[i][1] + "\\s*:?\\s*", "i"), "");
    if (!text) continue;
    // A nutrient needs a number ("g" alone says nothing); a serving needn't
    // ("one bowl"). 0 calories means the site didn't know (0 g fat is real).
    if (unit && !/\d/.test(text)) continue;
    if (key === "calories" && parseFloat(text) === 0) continue;
    if (unit && /^[\d.,]+$/.test(text)) text += " " + unit;
    // "420 calories", "420 Cal", "420kcal", "420 KCAL" all say "420 kcal"
    // (the unit must follow the number, so "kcal" isn't read as k + cal).
    if (key === "calories") text = text.replace(/(\d)\s*(kilocalories|k?cal(orie)?s?)\.?$/i, "$1 kcal");
    lines.push(NUTRIENTS[i][1] + ": " + text.slice(0, 100));
  }
  return lines;
}

// Returns the recipe as plain data, or null if the page has no recipe data.
function parseRecipe(html, pageUrl) {
  var blocks = findJsonLdBlocks(html);
  var recipe =
    findRecipeNode(blocks, 0) || findScriptRecipe(html) || findMicrodataRecipe(html) || findPlainTextRecipe(html);
  if (!recipe) return null;

  var steps = [];
  var images = [];
  collectSteps(recipe.recipeInstructions, steps, images);

  // A microdata recipe's own photo is usually a small thumbnail beside the
  // recipe card, so the page's preview image (full size) comes first there.
  var image = recipe.fromMicrodata || recipe.fromPage
    ? findMetaImage(html) || pickImage(recipe.image)
    : pickImage(recipe.image) || findMetaImage(html);
  var imageUrl = resolveUrl(image, pageUrl);

  // Step photos: full addresses, each once, not the cover again, and no
  // more than a recipe keeps (the recipes_photos migration's 20).
  var stepImages = [];
  var seen = {};
  for (var i = 0; i < images.length && stepImages.length < LIMITS.stepPhotos; i++) {
    var url = resolveUrl(images[i].url, pageUrl);
    if (!url || url === imageUrl || seen[url]) continue;
    seen[url] = true;
    stepImages.push({ step: images[i].step, url: url });
  }

  return {
    title: cleanText(recipe.name || recipe.headline),
    description: cleanText(recipe.description),
    sourceUrl: pageUrl,
    imageUrl: imageUrl,
    // [{ step: the step's line, url }]: photos the page gives for its steps.
    stepImages: stepImages,
    servings: pickServings(recipe.recipeYield),
    prepMinutes: durationToMinutes(recipe.prepTime),
    cookMinutes: durationToMinutes(recipe.cookTime),
    totalMinutes: durationToMinutes(recipe.totalTime),
    ingredients: joinAmounts(withSections(toLines(recipe.recipeIngredient || recipe.ingredients), ingredientSections(html))),
    steps: steps,
    tags: collectTags(recipe),
    authorNotes: findAuthorNotes(html).join("\n"),
    // From the page's recipe data (JSON-LD); microdata and plain-text
    // recipes don't carry one here.
    siteRating: siteRating(recipe.aggregateRating),
    nutrition: nutritionLines(recipe.nutrition),
  };
}

// A recipe link reduced to what says which page it is, so the same page
// counts as the same whether it's http or https, with or without "www.", a
// trailing slash, a #part or tracking extras (utm_…, fbclid, gclid…), and
// whatever the capitals in the site's name. "" for something that isn't a
// web link. Used to warn before saving a recipe that's already here
// (import.pb.js).
function linkKey(url) {
  var m = String(url || "").trim().match(/^https?:\/\/([^/?#]+)([^?#]*)(\?[^#]*)?/i);
  if (!m) return "";
  var host = m[1].toLowerCase().replace(/^www\./, "").replace(/:(80|443)$/, "");
  var path = m[2].replace(/\/+$/, "");
  var query = (m[3] || "")
    .slice(1)
    .split("&")
    .filter(function (pair) {
      return pair && !/^(utm_[^=]*|fbclid|gclid|mc_cid|mc_eid|ref|share|igshid)(=|$)/i.test(pair);
    })
    .sort()
    .join("&");
  return host + path + (query ? "?" + query : "");
}

// A downloaded photo's file extension, from the signature every image format
// starts with. "" if it isn't one PocketBase takes. Not from the site's
// Content-Type: sites label vaguely (PureWow's "binary/octet-stream") or
// wrongly (a "jpeg" that's really an error page), and PocketBase checks
// what the file really is, so a wrong label would fail the whole import.
// contentType is only kept so callers needn't change.
function imageExtension(contentType, bytes) {
  var b = function (i) {
    return bytes && bytes.length > i ? bytes[i] & 0xff : -1;
  };
  var ascii = function (from, text) {
    for (var i = 0; i < text.length; i++) if (b(from + i) !== text.charCodeAt(i)) return false;
    return true;
  };
  if (b(0) === 0xff && b(1) === 0xd8 && b(2) === 0xff) return "jpg";
  if (b(0) === 0x89 && ascii(1, "PNG")) return "png";
  if (ascii(0, "GIF8")) return "gif";
  if (ascii(0, "RIFF") && ascii(8, "WEBP")) return "webp";
  if (ascii(4, "ftypavif") || ascii(4, "ftypavis")) return "avif";
  return "";
}

// What the recipes collection keeps (server/pb_migrations: recipes,
// recipes_author_notes): text lengths in characters, lists in bytes of JSON.
// Anything longer makes the save fail, which would lose the whole import.
var LIMITS = {
  title: 300,
  description: 5000,
  servings: 100,
  authorNotes: 20000,
  listBytes: 200000,
  tagBytes: 20000,
  // Photos, in bytes.
  image: 10 * 1024 * 1024,
  // Photos besides the cover (the recipes_photos migration's maxSelect).
  stepPhotos: 20,
};

// Characters as PocketBase counts them (an emoji is one, though JavaScript
// strings count it as two).
function characters(text) {
  var count = 0;
  for (var i = 0; i < text.length; i++) {
    var c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) i++;
    count++;
  }
  return count;
}

// The first `count` characters, never splitting an emoji.
function firstCharacters(text, count) {
  var end = 0;
  for (var n = 0; n < count && end < text.length; n++) {
    var c = text.charCodeAt(end);
    end += c >= 0xd800 && c <= 0xdbff && end + 1 < text.length ? 2 : 1;
  }
  return text.slice(0, end);
}

// Text cut to `max` characters, ending in "…" when something was cut.
function fitText(text, max) {
  text = String(text || "");
  if (characters(text) <= max) return text;
  return firstCharacters(text, max - 1).replace(/\s+$/, "") + "…";
}

function utf8Bytes(text) {
  var bytes = 0;
  for (var i = 0; i < text.length; i++) {
    var c = text.charCodeAt(i);
    if (c < 0x80) bytes += 1;
    else if (c < 0x800) bytes += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      bytes += 4;
      i++;
    } else bytes += 3;
  }
  return bytes;
}

// As many lines from the start as fit in `maxBytes` of JSON.
function fitLines(lines, maxBytes) {
  lines = lines || [];
  if (utf8Bytes(JSON.stringify(lines)) <= maxBytes) return lines;
  var kept = [];
  var size = 2;
  for (var i = 0; i < lines.length; i++) {
    var add = utf8Bytes(JSON.stringify(lines[i])) + 1;
    if (size + add > maxBytes) break;
    kept.push(lines[i]);
    size += add;
  }
  return kept;
}

// A parsed recipe cut to fit what the database keeps (see LIMITS), so a
// site with a 6,000-character introduction still imports.
function fitRecipe(recipe) {
  var fitted = {};
  for (var key in recipe) fitted[key] = recipe[key];
  fitted.title = fitText(recipe.title, LIMITS.title);
  fitted.description = fitText(recipe.description, LIMITS.description);
  fitted.servings = fitText(recipe.servings, LIMITS.servings);
  fitted.authorNotes = fitText(recipe.authorNotes, LIMITS.authorNotes);
  fitted.ingredients = fitLines(recipe.ingredients, LIMITS.listBytes);
  fitted.steps = fitLines(recipe.steps, LIMITS.listBytes);
  fitted.tags = fitLines(recipe.tags, LIMITS.tagBytes);
  // Its field keeps the same 20,000 bytes as tags (recipes_nutrition).
  if (recipe.nutrition) fitted.nutrition = fitLines(recipe.nutrition, LIMITS.tagBytes);
  return fitted;
}

// Addresses on a list page that lead to more lists or the site's own pages,
// not to a recipe: categories, tags, authors, further pages, searches.
var NOT_RECIPE_PATH =
  /\/(category|categories|tag|tags|topic|topics|author|authors|page|collection|collections|search|about|contact|shop|privacy|cookbook)(\/|$)|[?&](s|page)=/i;

// "www.recipetineats.com" and "recipetineats.com" are the same site.
function siteOf(url) {
  var m = String(url || "").match(/^https?:\/\/(?:www\.)?([^\/?#:]+)/i);
  return m ? m[1].toLowerCase() : "";
}

// A card's photo: the first picture with a real address (lazy-loading pages
// put a blank placeholder in src and the photo in data-src or srcset).
function cardImage(html) {
  var re = /<(?:img|source)\b[^>]*>/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var srcset = attribute(m[0], "data-srcset") || attribute(m[0], "srcset");
    var options = [
      attribute(m[0], "src"),
      attribute(m[0], "data-src"),
      attribute(m[0], "data-lazy-src"),
      srcset.trim().split(/\s+/)[0],
    ];
    for (var i = 0; i < options.length; i++) {
      if (options[i] && !/^data:/i.test(options[i])) return options[i];
    }
  }
  return "";
}

// "one-pan-butter-chicken" as "One pan butter chicken", for a list that
// gives only addresses.
function slugTitle(url) {
  var slug = String(url).replace(/[?#].*$/, "").replace(/\/+$/, "").split("/").pop() || "";
  try {
    slug = decodeURIComponent(slug);
  } catch (err) {
    // A stray "%" ("100%-rye-bread"): the address as it's written still reads fine.
  }
  var words = slug.replace(/\.html?$/i, "").replace(/[-_]+/g, " ").trim();
  return words ? words[0].toUpperCase() + words.slice(1) : "";
}

// The page's "next page" link (rel="next", or a pagination "next" button),
// on the same site, or "".
function nextPageLink(html, pageUrl) {
  var re = /<(?:link|a)\b[^>]*>/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var rel = attribute(m[0], "rel");
    var cls = attribute(m[0], "class");
    var isNext = /(^|\s)next(\s|$)/i.test(rel) || (/\bnext\b/i.test(cls) && /page|pagination/i.test(cls));
    if (!isNext) continue;
    var url = resolveUrl(attribute(m[0], "href"), pageUrl);
    if (url && siteOf(url) === siteOf(pageUrl) && linkKey(url) !== linkKey(pageUrl)) return url;
  }
  return "";
}

// Recipe lists in the page's JSON-LD (an ItemList, as some sites give for a
// category page), as { url, title, image }.
function itemListEntries(node, depth, out) {
  if (!node || typeof node !== "object" || depth > 6) return;
  if (Array.isArray(node)) {
    for (var i = 0; i < node.length; i++) itemListEntries(node[i], depth + 1, out);
    return;
  }
  if (isType(node, "ItemList") && Array.isArray(node.itemListElement)) {
    node.itemListElement.forEach(function (entry) {
      if (!entry || typeof entry !== "object") return;
      var item = entry.item && typeof entry.item === "object" ? entry.item : {};
      var url = entry.url || (typeof entry.item === "string" ? entry.item : item.url || item["@id"]);
      if (typeof url === "string") out.push({ url: url, title: entry.name || item.name || "", image: pickImage(entry.image || item.image) });
    });
    return;
  }
  for (var key in node) {
    if (Object.prototype.hasOwnProperty.call(node, key)) itemListEntries(node[key], depth + 1, out);
  }
}

// A page that lists recipes rather than being one (a site's category, like
// RecipeTin Eats' "Quick and easy"): { title, recipes: [{ url, title, image }],
// next: the next page's link or "" }, or null when it lists fewer than two.
// Cards are the page's <article>s (WordPress and most recipe sites), else
// its JSON-LD ItemList. Only links on the page's own site count.
function recipeLinks(html, pageUrl) {
  var site = siteOf(pageUrl);
  var pageKey = linkKey(pageUrl);
  var pathOf = function (url) {
    return url.replace(/^https?:\/\/[^\/]+/i, "").replace(/[?#].*$/, "").replace(/\/+$/, "");
  };
  var pagePath = pathOf(pageUrl);
  // A link that could be a recipe: on this site, not one of its lists, and
  // not this page again (a comment's "Reply" is the page plus ?replytocom=).
  var mayBeRecipe = function (url) {
    return !!url && siteOf(url) === site && !NOT_RECIPE_PATH.test(url.replace(/^https?:\/\/[^\/]+/i, "")) && pathOf(url) !== pagePath;
  };
  var recipes = [];
  var seen = {};
  function add(href, title, image) {
    var url = resolveUrl(href, pageUrl);
    if (!mayBeRecipe(url)) return;
    var key = linkKey(url);
    var name = cleanText(title).replace(/^view\s+/i, "") || slugTitle(url);
    if (!key || key === pageKey || seen[key] || !name || recipes.length >= 100) return;
    seen[key] = true;
    recipes.push({ url: url, title: fitText(name, LIMITS.title), image: resolveUrl(image, pageUrl) });
  }

  var re = /<article\b/gi;
  var m;
  while ((m = re.exec(html)) !== null) {
    var card = elementAt(html, m.index);
    // An <article> wrapping the cards isn't one of them, and WordPress
    // wraps each comment in one too.
    if (!card || /<article\b/i.test(card.inner)) continue;
    if (/comment/i.test(attribute(card.openTag, "class") + " " + attribute(card.openTag, "id"))) continue;
    var links = card.inner.match(/<a\b[^>]*>[\s\S]*?<\/a>/gi) || [];
    var heading = card.inner.match(/<h([1-5])\b[^>]*>([\s\S]*?)<\/h\1>/i);
    for (var i = 0; i < links.length; i++) {
      var url = resolveUrl(attribute(links[i].match(/^<a\b[^>]*>/i)[0], "href"), pageUrl);
      if (!mayBeRecipe(url)) continue;
      // A link's text of one word is a badge on the photo ("Recipe"), not
      // the name; the address then reads better.
      var linkText = cleanText(links[i]);
      var title =
        (heading && cleanText(heading[2])) ||
        attribute(card.openTag, "data-item-name") ||
        attribute(card.openTag, "aria-label") ||
        (/\s/.test(linkText) ? linkText : "");
      add(url, title, cardImage(card.inner));
      break;
    }
  }

  if (recipes.length < 2) {
    var entries = [];
    itemListEntries(findJsonLdBlocks(html), 0, entries);
    entries.forEach(function (entry) {
      add(entry.url, entry.title, entry.image);
    });
  }
  recipes = inMainFolder(recipes);
  if (recipes.length < 2) return null;
  // "Quick and Easy Archives - RecipeTin Eats" is "Quick and Easy".
  var title = pageTitle(html)
    .replace(/\s+[-–|]\s+[^-–|]{1,30}$/, "")
    .replace(/\s+Archives$/i, "");
  return { title: title, recipes: recipes, next: nextPageLink(html, pageUrl) };
}

// When most links sit in one folder (BBC Good Food's "/recipes/…"), the
// rest are the site's other cards (a subscription offer, a podcast).
// Sites with recipes at the top level ("/butter-chicken/") have no such
// folder, so nothing is dropped there, and nor are dated addresses
// ("/2024/05/soup/"): a year isn't a folder of the site's other cards.
function inMainFolder(recipes) {
  var folderOf = function (recipe) {
    var parts = recipe.url.replace(/^https?:\/\/[^\/]+/i, "").replace(/[?#].*$/, "").split("/").filter(Boolean);
    return parts.length > 1 && !/^\d+$/.test(parts[0]) ? parts[0] : "";
  };
  var counts = {};
  var top = "";
  recipes.forEach(function (recipe) {
    var folder = folderOf(recipe);
    if (!folder) return;
    counts[folder] = (counts[folder] || 0) + 1;
    if (!top || counts[folder] > counts[top]) top = folder;
  });
  if (!top || counts[top] < recipes.length * 0.6) return recipes;
  return recipes.filter(function (recipe) {
    return folderOf(recipe) === top;
  });
}

module.exports = {
  BROWSER_USER_AGENT: BROWSER_USER_AGENT,
  recipeLinks: recipeLinks,
  LIMITS: LIMITS,
  fitRecipe: fitRecipe,
  linkKey: linkKey,
  imageExtension: imageExtension,
  productPhotoUrl: productPhotoUrl,
  parseRecipe: parseRecipe,
  durationToMinutes: durationToMinutes,
  cleanText: cleanText,
};
