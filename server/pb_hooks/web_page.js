// Reading a website's page for the import and categories routes: never from
// this computer or the home network (safe_url.js), and refusals in words
// people can act on. Not a hook (no .pb.js): required inside the handlers.

// The page's HTML, from the page the app's browser already loaded (`html`,
// which also works for sites that block the server) or downloaded here.
// `whenRefused` ends the message for a site that refuses, saying what to do
// instead.
function readPage(url, html, whenRefused) {
  const parser = require(`${__hooks}/recipe_parse.js`);
  const safeUrl = require(`${__hooks}/safe_url.js`);
  if (typeof html === "string" && html) {
    if (html.length > 5 * 1024 * 1024) throw new BadRequestError("That page is too big to save.");
    return html;
  }
  if (!safeUrl.isPublicUrl(url)) {
    throw new BadRequestError("Bentotachi only imports from public websites, not addresses on your own network.");
  }
  let page;
  try {
    page = $http.send({
      url: url,
      method: "GET",
      headers: { "user-agent": parser.BROWSER_USER_AGENT, accept: "text/html,*/*" },
      timeout: 20,
    });
  } catch (err) {
    throw new BadRequestError("Couldn't reach that website. Check the link and the internet connection.");
  }
  if (page.statusCode >= 400) {
    throw new BadRequestError(
      `That website refused the request (error ${page.statusCode}). Some sites block apps like this one; ${whenRefused}`
    );
  }
  return toString(page.body);
}

// The recipe saved from this link, or null.
function sameRecipe(app, link) {
  const parser = require(`${__hooks}/recipe_parse.js`);
  const key = parser.linkKey(link);
  if (!key) return null;
  // Narrowed by the site and the last part of the address ("chasseur",
  // "p=123"), so a site with hundreds of recipes still finds an old one;
  // linkKey then decides.
  const host = key.split(/[/?]/)[0];
  const tail = key.slice(host.length).split(/[/?&]/).filter(Boolean).pop() || "";
  const filter = tail ? "source_url ~ {:host} && source_url ~ {:tail}" : "source_url ~ {:host}";
  // A "%" in the value would make PocketBase's "~" match from the start
  // instead of anywhere (accented addresses arrive as %C3%A8…), so it's
  // escaped.
  const candidates = app.findRecordsByFilter("recipes", filter, "-created", 500, 0, {
    host: host,
    tail: tail.replace(/%/g, "\\%"),
  });
  return candidates.find((record) => parser.linkKey(record.getString("source_url")) === key) || null;
}

// A page's list of recipes (recipe_parse.js recipeLinks), each marked if a
// recipe from it is already here, so it can't be ticked twice.
function markHere(app, list) {
  list.recipes.forEach((recipe) => {
    recipe.have = !!sameRecipe(app, recipe.url);
  });
  return list;
}

module.exports = { readPage, sameRecipe, markHere };
