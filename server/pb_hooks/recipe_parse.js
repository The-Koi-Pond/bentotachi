// Pulls a recipe out of a web page's HTML.
//
// Most recipe sites embed a machine-readable copy of the recipe in the page
// (schema.org "Recipe" data inside <script type="application/ld+json">), so we
// read that instead of guessing from the visible page. Some older recipe
// plugins (like EasyRecipe) instead label the visible recipe itself with
// itemprop="..." attributes ("microdata"); that's read when there's no JSON-LD.
//
// Kept as plain CommonJS without newer syntax (no ?. or ??) so the same file
// runs inside PocketBase's JavaScript engine and in Node for the tests.

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
// "# Heading" lines, which the app shows as headings.
function collectSteps(node, steps) {
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
    for (var j = 0; j < node.length; j++) collectSteps(node[j], steps);
    return;
  }
  if (typeof node === "object") {
    var children = node.itemListElement || node.steps;
    if (children) {
      var heading = cleanText(node.name);
      if (heading && isType(node, "HowToSection")) steps.push("# " + heading);
      collectSteps(children, steps);
      return;
    }
    addStep(steps, cleanText(node.text || node.name || node.description));
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

var INGREDIENTS_HEADING = /^(ingredients?|what you('ll| will)? need|you('ll| will)? need)\b[^.]{0,40}$/i;
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

// Returns the recipe as plain data, or null if the page has no recipe data.
function parseRecipe(html, pageUrl) {
  var blocks = findJsonLdBlocks(html);
  var recipe =
    findRecipeNode(blocks, 0) || findScriptRecipe(html) || findMicrodataRecipe(html) || findPlainTextRecipe(html);
  if (!recipe) return null;

  var steps = [];
  collectSteps(recipe.recipeInstructions, steps);

  // A microdata recipe's own photo is usually a small thumbnail beside the
  // recipe card, so the page's preview image (full size) comes first there.
  var image = recipe.fromMicrodata || recipe.fromPage
    ? findMetaImage(html) || pickImage(recipe.image)
    : pickImage(recipe.image) || findMetaImage(html);

  return {
    title: cleanText(recipe.name || recipe.headline),
    description: cleanText(recipe.description),
    sourceUrl: pageUrl,
    imageUrl: resolveUrl(image, pageUrl),
    servings: pickServings(recipe.recipeYield),
    prepMinutes: durationToMinutes(recipe.prepTime),
    cookMinutes: durationToMinutes(recipe.cookTime),
    totalMinutes: durationToMinutes(recipe.totalTime),
    ingredients: toLines(recipe.recipeIngredient || recipe.ingredients),
    steps: steps,
    tags: collectTags(recipe),
    authorNotes: findAuthorNotes(html).join("\n"),
  };
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
  return fitted;
}

module.exports = {
  BROWSER_USER_AGENT: BROWSER_USER_AGENT,
  LIMITS: LIMITS,
  fitRecipe: fitRecipe,
  imageExtension: imageExtension,
  parseRecipe: parseRecipe,
  durationToMinutes: durationToMinutes,
  cleanText: cleanText,
};
