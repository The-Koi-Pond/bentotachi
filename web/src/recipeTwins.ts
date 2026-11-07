// Recipes that share a name ("Pancakes" twice: two people's, or one from a
// site and one typed in, or a Paprika import), and a short line to tell
// each apart on its card: the site it came from, or the day it was added
// when it has no link, or when the others of that name share its site
// (Xel, 2026-11-07). Recipes with a name of their own get no line.

interface Named {
  id: string;
  title: string;
  source_url?: string;
  created?: string;
}

const nameKey = (title: string) => title.trim().toLowerCase();

function siteOf(url: string | undefined): string {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, "") : "";
  } catch {
    return "";
  }
}

// "added 7 Nov" from PocketBase's "2026-11-07 01:23:45.678Z".
function addedOn(created: string | undefined): string {
  const date = created ? new Date(created.replace(" ", "T")) : null;
  return date && !Number.isNaN(date.getTime())
    ? `added ${date.toLocaleDateString(undefined, { day: "numeric", month: "short" })}`
    : "";
}

// Every card's source line, by recipe id (Xel, 2026-11-07: easier to find
// a recipe without opening several): the site it came from, or "home
// recipe" with no link; a recipe sharing its name with another gets its
// twin line instead (the day it was added when the site doesn't tell them
// apart).
export function sourceLines(recipes: Named[]): Map<string, string> {
  const twins = twinLabels(recipes);
  return new Map(recipes.map((recipe) => [recipe.id, twins.get(recipe.id) ?? (siteOf(recipe.source_url) || "home recipe")]));
}

// Each twin's line, by recipe id.
export function twinLabels(recipes: Named[]): Map<string, string> {
  const byName = new Map<string, Named[]>();
  for (const recipe of recipes) byName.set(nameKey(recipe.title), [...(byName.get(nameKey(recipe.title)) ?? []), recipe]);
  const labels = new Map<string, string>();
  for (const twins of byName.values()) {
    if (twins.length < 2) continue;
    for (const recipe of twins) {
      const site = siteOf(recipe.source_url);
      const sameSite = !!site && twins.some((other) => other !== recipe && siteOf(other.source_url) === site);
      const label = site && !sameSite ? site : addedOn(recipe.created);
      if (label) labels.set(recipe.id, label);
    }
  }
  return labels;
}
