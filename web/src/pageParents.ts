// Which pages are a step in from a tab, and where each one's top-bar back
// arrow (BackButton.tsx) goes when there's nothing in the app to go back to
// (opened from a link, or the app started there). Tested in
// test/pageParents.test.ts.

// The tabs' own pages (TabBar.tsx): no back arrow there.
const TAB_PAGES = new Set(["/", "/browse", "/plan", "/shopping", "/pantry"]);

export function isTabPage(pathname: string): boolean {
  return TAB_PAGES.has(pathname);
}

// A recipe's editor goes up to the recipe, the site categories to Browse,
// the shelves to the Recipes page's Edit mode; the rest to the Recipes page.
export function parentOf(pathname: string): string {
  const editing = pathname.match(/^\/recipes\/([^/]+)\/edit$/);
  if (editing) return `/recipes/${editing[1]}`;
  if (pathname.startsWith("/browse/")) return "/browse";
  if (pathname === "/shelves") return "/?edit=1";
  return "/";
}
