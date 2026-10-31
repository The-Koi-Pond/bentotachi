import { useState } from "react";
import { averageStars, errorMessage, recipeImageUrl, recipeRatings, recipes, type Recipe } from "../pb";
import { paprikaFile, toPaprika } from "../paprikaExport";
import { saveFile } from "../saveFile";
import { localToday } from "../dates";

// ⋮ → Export recipes: every recipe, with its photo, as a Paprika file
// (see paprikaExport.ts), to move to another app or keep a copy.
export default function Export() {
  const [progress, setProgress] = useState("");
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);
  const busy = progress !== "";

  async function photoOf(recipe: Recipe): Promise<string> {
    const url = recipeImageUrl(recipe);
    if (!url) return "";
    try {
      const answer = await fetch(url);
      if (!answer.ok) return "";
      const bytes = new Uint8Array(await answer.arrayBuffer());
      let text = "";
      for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(text);
    } catch {
      // A photo that won't load: the recipe goes without it.
      return "";
    }
  }

  async function exportAll() {
    setStatus(null);
    setProgress("Getting the recipes…");
    try {
      const [all, ratings] = await Promise.all([
        recipes().getFullList({ sort: "title" }),
        recipeRatings().getFullList(),
      ]);
      const exported = [];
      for (const [i, recipe] of all.entries()) {
        setProgress(`Adding photos: ${i + 1} of ${all.length}…`);
        const stars = averageStars(ratings.filter((r) => r.recipe === recipe.id)) ?? 0;
        exported.push(toPaprika(recipe, await photoOf(recipe), stars));
      }
      setProgress("Saving…");
      const name = `Bento recipes ${localToday()}.paprikarecipes`;
      const saved = await saveFile(name, "application/octet-stream", paprikaFile(exported));
      if (saved) setStatus({ text: `Saved ${all.length} ${all.length === 1 ? "recipe" : "recipes"} as “${name}”.`, isError: false });
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
    } finally {
      setProgress("");
    }
  }

  return (
    <div className="stack narrow">
      <h1>Export recipes</h1>
      <section className="card stack">
        <p>
          Saves every recipe, with its photo, as one Paprika file (<code>.paprikarecipes</code>). Paprika, Mealie and
          Tandoor can import it, so you can move your recipes to another app, or just keep a copy.
        </p>
        <p className="muted small-note">
          Your notes and the recipe writer's notes go into each recipe's notes, tags become categories, and ratings become
          the household's average stars. The dinner plan, shopping list, pantry and cooking history aren't included.
        </p>
        <div className="actions">
          <button className="button primary" onClick={() => void exportAll()} disabled={busy}>
            {busy ? progress : "Export recipes"}
          </button>
        </div>
        {status && (
          <p className={status.isError ? "error" : "success"} role="status">
            {status.text}
          </p>
        )}
      </section>
    </div>
  );
}
