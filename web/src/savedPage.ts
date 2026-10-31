// A web page saved from a browser (Ctrl+S), for importing recipes from
// sites that block the server: which link it came from, and the page
// without the parts the recipe reader never uses.

// Chrome and Edge mark saved pages with "<!-- saved from url=(0042)https://… -->".
const SAVED_FROM = /<!--\s*saved from url=\(\d+\)\s*(https?:\/\/[^\s>]+?)\s*-->/i;

function attribute(tag: string, name: string): string {
  const match = tag.match(new RegExp(`\\b${name}\\s*=\\s*(["'])(.*?)\\1`, "i"));
  return match ? match[2].replace(/&amp;/g, "&").trim() : "";
}

// The page's own link: the "saved from" mark, else the link the page gives
// for itself (canonical, then og:url). Empty when it has none.
export function savedPageLink(html: string): string {
  const saved = html.match(SAVED_FROM)?.[1];
  if (saved) return saved;
  const tags = html.match(/<(?:link|meta)\b[^>]*>/gi) ?? [];
  const canonical = tags.find((tag) => /^<link/i.test(tag) && attribute(tag, "rel").toLowerCase() === "canonical");
  const ogUrl = tags.find((tag) => /^<meta/i.test(tag) && attribute(tag, "property").toLowerCase() === "og:url");
  for (const link of [canonical && attribute(canonical, "href"), ogUrl && attribute(ogUrl, "content")]) {
    if (link && /^https?:\/\/\S+$/i.test(link)) return link;
  }
  return "";
}

// Styles, drawings and comments make saved pages big but never hold the
// recipe, so they're left out to stay under the server's size limit.
export function trimSavedPage(html: string): string {
  return html
    .replace(/<style\b[\s\S]*?<\/style>/gi, "")
    .replace(/<svg\b[\s\S]*?<\/svg>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "");
}
