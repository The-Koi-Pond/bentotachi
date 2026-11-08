import { someNames } from "./paprikaImport.ts";

// What adding several recipes from a site's list (RecipePicker) says at the
// end. Tested in web/test/recipeBatch.test.ts.
export interface BatchOutcome {
  added: number;
  already: number;
  // Names of the recipes that couldn't be added.
  failed: string[];
  // The first failure's own message, like "That website refused the request (error 403)…".
  firstError: string;
  stopped: boolean;
  // The Android app's browser can save pages from sites that block the server.
  hasBuiltInBrowser: boolean;
}

export function batchSummary(outcome: BatchOutcome): { text: string; isError: boolean } {
  const { added, already, failed } = outcome;
  const parts = [added === 1 ? "Added 1 recipe." : `Added ${added} recipes.`];
  if (already) parts.push(already === 1 ? "1 was already here." : `${already} were already here.`);
  if (outcome.stopped) parts.push("Stopped before the rest.");
  if (failed.length) {
    parts.push(`Couldn't add ${someNames(failed)}.`);
    // None worked: the site likely blocks Bentotachi, so trying each link on
    // its own would fail the same way. Its reason says more than a guess.
    if (!added && !already) {
      if (outcome.firstError) parts.push(outcome.firstError);
      if (outcome.hasBuiltInBrowser) parts.push("Opening a recipe in Bentotachi's browser and saving it from there often works.");
    } else {
      parts.push(failed.length === 1 ? "Try its link on its own." : "Try their links on their own.");
    }
  }
  return { text: parts.join(" "), isError: failed.length > 0 && added === 0 };
}
