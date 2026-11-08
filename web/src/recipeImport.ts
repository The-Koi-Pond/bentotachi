import { pb } from "./pb";

// One recipe on a page that lists recipes (a site's category page).
export interface ListedRecipe {
  url: string;
  title: string;
  // The site's photo address, or "".
  image: string;
  // A recipe from this link is already here.
  have: boolean;
}

export interface RecipeList {
  // The page's own name, like "Quick and Easy".
  title: string;
  recipes: ListedRecipe[];
  // The page with the next lot, or "".
  next: string;
}

// What importing a recipe page gives: the new recipe; or (when a recipe
// from that page is already here) that one, for "Open it" or "Add another
// copy" (AlreadyHere.tsx); or, for a page listing recipes, the list to pick
// from (RecipePicker.tsx). The server checks the link (import.pb.js);
// `again` asks for another copy anyway.
export type ImportResult = { id: string } | { duplicate: { id: string; title: string } } | { list: RecipeList };

export interface ImportRequest {
  url: string;
  // The page itself, when the app's browser or a saved page has it.
  html?: string;
  again?: boolean;
  // Read the page without saving anything.
  preview?: boolean;
}

// The server's list, checked field by field (an older or odd answer leaves
// out what it can't vouch for).
function readList(value: unknown): RecipeList | null {
  if (!value || typeof value !== "object") return null;
  const list = value as { title?: unknown; recipes?: unknown; next?: unknown };
  if (!Array.isArray(list.recipes)) return null;
  const recipes = list.recipes
    .filter((recipe): recipe is Record<string, unknown> => !!recipe && typeof recipe === "object")
    .filter((recipe) => typeof recipe.url === "string")
    .map((recipe) => ({
      url: String(recipe.url),
      title: String(recipe.title ?? ""),
      image: typeof recipe.image === "string" ? recipe.image : "",
      have: recipe.have === true,
    }));
  return { title: String(list.title ?? ""), recipes, next: typeof list.next === "string" ? list.next : "" };
}

export async function importRecipe(request: ImportRequest): Promise<ImportResult> {
  try {
    const { id } = await pb.send<{ id: string }>("/api/cookbook/import", { method: "POST", body: request });
    return { id };
  } catch (err) {
    const answer = err as { status?: number; response?: { id?: unknown; title?: unknown; list?: unknown } };
    if (answer.status === 409 && typeof answer.response?.id === "string") {
      return { duplicate: { id: answer.response.id, title: String(answer.response.title ?? "") } };
    }
    const list = answer.status === 400 ? readList(answer.response?.list) : null;
    if (list) return { list };
    throw err;
  }
}

// The next page of a list ("More from this page"), read without saving
// anything even if it turns out to be a recipe.
export async function nextRecipeList(url: string): Promise<RecipeList | null> {
  const result = await importRecipe({ url, preview: true });
  return "list" in result ? result.list : null;
}
