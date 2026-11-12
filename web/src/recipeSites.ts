// Recipe sites on the Browse page. `search` is the site's own search page,
// with {q} where the search words go.
//
// Checked 2026-10-30: the RecipeTin Eats, BBC Good Food, BBC Food, Tasty and
// Delish search links answered normally. The others refused automated checks
// (their bot blockers), so their links follow each site's usual pattern but
// were not confirmed.
//
// `blocksImport`: Bento's server was refused when importing from this site in
// testing, so pasting its links on the PC fails. The Android app's built-in
// browser reads the page itself, so saving from there works, and the app
// doesn't show the note.
//
// `noCategories`: Bento's server couldn't read this site's categories, or
// the recipes in them, when checked (2026-11-11: it refused, its menu's
// links don't look like categories, or, for BBC Food, its category pages
// list recipes without the cards recipeLinks reads), so Browse leaves its
// Categories button out. The rest gave categories with recipes in them.
// The blocking sites have no button either.

export interface RecipeSite {
  name: string;
  home: string;
  search: string;
  about: string;
  blocksImport?: boolean;
  noCategories?: boolean;
}

// Whether Browse offers this site's categories (pages/SiteCategories.tsx).
export const hasCategories = (site: RecipeSite) => !site.blocksImport && !site.noCategories;

export const RECIPE_SITES: RecipeSite[] = [
  {
    name: "RecipeTin Eats",
    home: "https://www.recipetineats.com/",
    search: "https://www.recipetineats.com/?s={q}",
    about: "Reliable everyday recipes from a Sydney cook",
  },
  {
    name: "taste.com.au",
    home: "https://www.taste.com.au/",
    search: "https://www.taste.com.au/search-recipes/?q={q}",
    about: "Australia's biggest recipe site",
    noCategories: true,
  },
  {
    name: "BBC Good Food",
    home: "https://www.bbcgoodfood.com/",
    search: "https://www.bbcgoodfood.com/search?q={q}",
    about: "Tested British recipes, great for the basics",
  },
  {
    name: "BBC Food",
    home: "https://www.bbc.co.uk/food",
    search: "https://www.bbc.co.uk/food/search?q={q}",
    about: "Recipes from BBC cooking shows and chefs",
    noCategories: true,
  },
  {
    name: "Just One Cookbook",
    home: "https://www.justonecookbook.com/",
    search: "https://www.justonecookbook.com/?s={q}",
    about: "Japanese home cooking, step by step",
  },
  {
    name: "Tasty",
    home: "https://tasty.co/",
    search: "https://tasty.co/search?q={q}",
    about: "Quick, fun recipes with short videos",
    noCategories: true,
  },
  {
    name: "AllRecipes",
    home: "https://www.allrecipes.com/",
    search: "https://www.allrecipes.com/search?q={q}",
    about: "Huge collection with reviews from home cooks",
    blocksImport: true,
  },
  {
    name: "Budget Bytes",
    home: "https://www.budgetbytes.com/",
    search: "https://www.budgetbytes.com/?s={q}",
    about: "Cheap meals, with costs per serving",
    blocksImport: true,
  },
  {
    name: "Serious Eats",
    home: "https://www.seriouseats.com/",
    search: "https://www.seriouseats.com/search?q={q}",
    about: "Deep dives into why recipes work",
    blocksImport: true,
  },
  {
    name: "Simply Recipes",
    home: "https://www.simplyrecipes.com/",
    search: "https://www.simplyrecipes.com/search?q={q}",
    about: "Simple, family-friendly cooking",
    noCategories: true,
  },
];

export function searchUrl(site: RecipeSite, words: string): string {
  return site.search.replace("{q}", encodeURIComponent(words.trim()));
}

// "smittenkitchen.com" from "https://www.smittenkitchen.com/recipes". An
// address that can't be read gives `unreadable`: the address itself unless
// said otherwise.
export function siteHost(url: string, unreadable = url): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return unreadable;
  }
}

// "smittenkitchen.com" -> "https://smittenkitchen.com", or null if it isn't
// a web address.
export function normaliseSiteUrl(input: string): string | null {
  const text = input.trim();
  if (!text) return null;
  try {
    const url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(text) ? text : `https://${text}`);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.href;
  } catch {
    return null;
  }
}

// Whether two addresses are the same site: "https://www.smittenkitchen.com/"
// and "http://smittenkitchen.com" are; another page on it isn't.
export function sameSite(a: string, b: string): boolean {
  const key = (url: string) => {
    try {
      return siteHost(url).toLowerCase() + new URL(url).pathname.replace(/\/+$/, "");
    } catch {
      return url;
    }
  };
  return key(a) === key(b);
}

// Searching one of our own sites goes through Google, limited to that site,
// since every site's own search page works differently.
export function savedSiteSearchUrl(url: string, words: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`site:${siteHost(url)} ${words.trim()}`)}`;
}

// The page listing a site's categories (pages/SiteCategories.tsx), or with
// `inside`, what's in one of them. Each level is its own page, so Back goes
// up a level.
export function categoriesPath({ name, url, inside = false }: { name: string; url: string; inside?: boolean }): string {
  const query = new URLSearchParams({ name, url });
  if (inside) query.set("inside", "1");
  return `/browse/categories?${query}`;
}

// The first web address in shared text ("Share to Bento"). Apps share either
// just the link or something like "Easy lasagne https://example.com/lasagne".
export function sharedLink(text: string): string | null {
  return text.match(/https?:\/\/[^\s<>"']+/i)?.[0].replace(/[).,!?]+$/, "") ?? null;
}
