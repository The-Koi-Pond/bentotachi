import { averageStars, recipeImageUrl, recipePhotoUrl, type Recipe, type RecipeRating } from "./pb";
import { paprikaZip, toPaprika, type ExtraPhoto } from "./paprikaExport";
import { startFile } from "./saveFile";

// Saves recipes, with their photos, as one Paprika file (paprikaExport.ts):
// Import & export's "Export recipes", and one recipe from its page's ⋯ menu
// ("Save as a Paprika file", to send to a friend). Written a recipe (and its
// photo) at a time, so a big collection never has to fit in memory at once.
// Each recipe's rating is the household's average; `me`'s hearts become
// Paprika favorites. Says whether it was saved (not cancelled) and whose
// photos couldn't be fetched (they're saved without).
export async function savePaprikaFile(
  list: Recipe[],
  ratings: RecipeRating[],
  me: string | undefined,
  name: string,
  onProgress: (text: string) => void
): Promise<{ saved: boolean; missingPhotos: string[] }> {
  const file = await startFile();
  let pieces: Uint8Array[] = [];
  const zip = paprikaZip((piece) => pieces.push(piece));
  const missingPhotos: string[] = [];
  for (const [i, recipe] of list.entries()) {
    if (list.length > 1) onProgress(`Adding ${i + 1} of ${list.length}…`);
    const theirs = ratings.filter((r) => r.recipe === recipe.id);
    const stars = averageStars(theirs) ?? 0;
    const favorite = theirs.some((r) => r.user === me && r.favorite);
    const photo = recipe.image ? await base64Of(recipeImageUrl(recipe)) : "";
    // The other photos too; one that won't load is left out.
    const extras: ExtraPhoto[] = [];
    let missing = photo === null;
    for (const file of recipe.photos ?? []) {
      const data = await base64Of(recipePhotoUrl(recipe, file));
      if (data === null) missing = true;
      else extras.push({ file, data });
    }
    if (missing) missingPhotos.push(recipe.title);
    zip.add(toPaprika(recipe, photo ?? "", stars, favorite, extras));
    for (const piece of pieces) await file.add(piece);
    pieces = [];
  }
  zip.end();
  for (const piece of pieces) await file.add(piece);
  onProgress("Saving…");
  const saved = await file.save(name, "application/octet-stream");
  return { saved, missingPhotos };
}

// A file name without the characters file systems refuse, kept short.
export function fileNamePart(text: string): string {
  return text.replace(/[\\/:*?"<>|\x00-\x1f]/g, "").trim().slice(0, 60);
}

// A photo as base64, or null when it wouldn't load (the recipe then goes
// without it).
async function base64Of(url: string): Promise<string | null> {
  try {
    const answer = await fetch(url);
    if (!answer.ok) return null;
    const bytes = new Uint8Array(await answer.arrayBuffer());
    let text = "";
    for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(text);
  } catch {
    return null;
  }
}
