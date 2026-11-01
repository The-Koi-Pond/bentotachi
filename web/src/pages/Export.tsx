import { useState, type ChangeEvent } from "react";
import { averageStars, errorMessage, isAndroidApp, recipeImageUrl, recipeRatings, recipes, type Recipe } from "../pb";
import { paprikaFile, toPaprika } from "../paprikaExport";
import { alreadyHave, fromPaprika, readPaprikaFile } from "../paprikaImport";
import { saveFile } from "../saveFile";
import { localToday } from "../dates";

// ⋮ → Import & export: bring in recipes from a Paprika file (Paprika,
// Mealie, Tandoor or another Bento make them), and save every recipe as one.
export default function Export() {
  return (
    <div className="stack narrow">
      <h1>Import & export</h1>
      <ImportRecipes />
      <ExportRecipes />
    </div>
  );
}

// A photo bigger than the server takes (10 MB) is left off its recipe.
const MAX_PHOTO = 10 * 1024 * 1024;

// Adds the recipes from a Paprika file (see paprikaImport.ts), with their
// photos, skipping any already here (same name and link).
function ImportRecipes() {
  const [progress, setProgress] = useState("");
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);
  const busy = progress !== "";

  async function importFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setStatus(null);
    setProgress("Reading the file…");
    try {
      const { recipes: found, unreadable } = readPaprikaFile(new Uint8Array(await file.arrayBuffer()));
      if (!found.length) {
        setStatus({ text: "That doesn't look like a Paprika file. Export one from your other app and try again.", isError: true });
        return;
      }
      const existing = await recipes().getFullList({ fields: "title,source_url" });
      let added = 0;
      let skipped = 0;
      const failed: string[] = [];
      for (const [i, raw] of found.entries()) {
        setProgress(`Adding ${i + 1} of ${found.length}…`);
        const { photo, ...recipe } = fromPaprika(raw);
        if (alreadyHave({ ...recipe, photo }, existing)) {
          skipped += 1;
          continue;
        }
        const image =
          photo && photo.bytes.length <= MAX_PHOTO
            ? new File([new Uint8Array(photo.bytes)], `photo.${photo.type.split("/")[1]}`, { type: photo.type })
            : undefined;
        try {
          await recipes().create({ ...recipe, ...(image && { image }) });
          existing.push({ title: recipe.title, source_url: recipe.source_url } as Recipe);
          added += 1;
        } catch {
          failed.push(recipe.title);
        }
      }
      const parts = [`Added ${added} ${added === 1 ? "recipe" : "recipes"}.`];
      if (skipped) parts.push(`${skipped} ${skipped === 1 ? "was" : "were"} already here.`);
      if (unreadable) parts.push(`${unreadable} couldn't be read.`);
      if (failed.length) parts.push(`Couldn't add: ${failed.join(", ")}.`);
      setStatus({ text: parts.join(" "), isError: failed.length > 0 && added === 0 });
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
    } finally {
      setProgress("");
    }
  }

  return (
    <section className="card stack">
      <h2>Import recipes</h2>
      <p>
        Adds recipes from a Paprika file (<code>.paprikarecipes</code>), with their photos. Paprika, Mealie, Tandoor and
        Bentotachi itself can export one. Recipes already here are skipped, so importing the same file twice is fine.
      </p>
      <p className="muted small-note">Categories become tags. Ratings and meal plans don't come across.</p>
      <div className="actions">
        <label className={`button primary ${busy ? "disabled" : ""}`}>
          {busy ? progress : "Choose a file"}
          {/* Android's file picker greys out types it doesn't know (it has
              no type for .paprikarecipes), so the app lets any file through
              and the import says if it isn't one. */}
          <input
            type="file"
            accept={isAndroidApp ? undefined : ".paprikarecipes,.paprikarecipe"}
            onChange={(e) => void importFile(e)}
            disabled={busy}
            hidden
          />
        </label>
      </div>
      {status && (
        <p className={status.isError ? "error" : "success"} role="status">
          {status.text}
        </p>
      )}
    </section>
  );
}

// Every recipe, with its photo, as a Paprika file (see paprikaExport.ts),
// to move to another app or keep a copy.
function ExportRecipes() {
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
      const name = `Bentotachi recipes ${localToday()}.paprikarecipes`;
      const saved = await saveFile(name, "application/octet-stream", paprikaFile(exported));
      if (saved) setStatus({ text: `Saved ${all.length} ${all.length === 1 ? "recipe" : "recipes"} as “${name}”.`, isError: false });
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
    } finally {
      setProgress("");
    }
  }

  return (
    <section className="card stack">
      <h2>Export recipes</h2>
      <p>
        Saves every recipe, with its photo, as one Paprika file (<code>.paprikarecipes</code>). Paprika, Mealie and
        Tandoor can import it, so you can move your recipes to another app, or just keep a copy.
      </p>
      <p className="muted small-note">
        Your notes and the recipe writer's notes go into each recipe's notes, tags become categories, and ratings become
        the household's average stars. The meal plan, shopping list, pantry and cooking history aren't included.
      </p>
      <div className="actions">
        <button className="button" onClick={() => void exportAll()} disabled={busy}>
          {busy ? progress : "Export recipes"}
        </button>
      </div>
      {status && (
        <p className={status.isError ? "error" : "success"} role="status">
          {status.text}
        </p>
      )}
    </section>
  );
}
