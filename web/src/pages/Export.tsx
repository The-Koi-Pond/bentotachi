import { useState, type ChangeEvent } from "react";
import { averageStars, errorMessage, isAndroidApp, recipeImageUrl, recipeRatings, recipes, type Recipe } from "../pb";
import { paprikaZip, toPaprika } from "../paprikaExport";
import { alreadyHave, fitImported, fromPaprika, paprikaEntries, paprikaPhoto, someNames } from "../paprikaImport";
import { startFile } from "../saveFile";
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
// photos, skipping any already here (alreadyHave: Bentotachi's own export
// of it, or the same name and the same link or ingredients).
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
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (!bytes.length) {
        // A file Android still lists after it was deleted hands over nothing.
        setStatus({ text: "The file came through empty. Choose it again, and if that keeps happening, copy it to the phone again.", isError: true });
        return;
      }
      // Unpacked a few MB at a time, so a big collection fits in a phone's
      // memory (paprikaEntries).
      const entries = paprikaEntries(bytes);
      const existing = await recipes().getFullList({ fields: "id,title,source_url,ingredients" });
      let added = 0;
      let unreadable = 0;
      let i = 0;
      const skipped: string[] = [];
      const failed: string[] = [];
      const shortened: string[] = [];
      const sameName: string[] = [];
      let yielded = Date.now();
      for (const raw of entries.recipes()) {
        i += 1;
        setProgress(`Adding ${i} of ${entries.count}…`);
        // Recipes already here are quick and never wait for the server: let
        // the screen catch up every so often, so a big re-import doesn't
        // freeze it.
        if (Date.now() - yielded > 100) {
          await new Promise((resume) => setTimeout(resume));
          yielded = Date.now();
        }
        if (!raw) {
          unreadable += 1;
          continue;
        }
        const converted = fromPaprika(raw, { withPhoto: false });
        const recipe = fitImported(converted);
        if (alreadyHave(recipe, existing, typeof raw.uid === "string" ? raw.uid : "")) {
          skipped.push(recipe.title);
          continue;
        }
        if (JSON.stringify(recipe) !== JSON.stringify(converted)) shortened.push(recipe.title);
        // A different recipe with a name already here: both are kept, and
        // the summary says so (their cards tell them apart, recipeTwins).
        const twin = existing.some((other) => other.title.trim().toLowerCase() === recipe.title.trim().toLowerCase());
        // Decoded only now: the slow part, and only for recipes being added.
        const photo = paprikaPhoto(raw);
        const image =
          photo && photo.bytes.length <= MAX_PHOTO
            ? new File([new Uint8Array(photo.bytes)], `photo.${photo.type.split("/")[1]}`, { type: photo.type })
            : undefined;
        try {
          const created = await recipes().create({ ...recipe, ...(image && { image }) });
          existing.push({ id: created.id, title: recipe.title, source_url: recipe.source_url, ingredients: recipe.ingredients } as Recipe);
          added += 1;
          if (twin) sameName.push(recipe.title);
        } catch {
          failed.push(recipe.title);
        }
      }
      if (!added && !skipped.length && !failed.length) {
        setStatus({ text: "That doesn't look like a Paprika file. Export one from your other app and try again.", isError: true });
        return;
      }
      const parts = [`Added ${added} ${added === 1 ? "recipe" : "recipes"}.`];
      if (skipped.length) {
        parts.push(`${skipped.length} ${skipped.length === 1 ? "was" : "were"} already here (${someNames(skipped)}).`);
      }
      if (sameName.length) {
        const one = sameName.length === 1;
        parts.push(
          `${someNames(sameName)} ${one ? "has" : "have"} the same name as ${one ? "a recipe" : "recipes"} already here but ${one ? "is" : "are"} different, so you now have both (their cards say which is which).`
        );
      }
      if (shortened.length) {
        parts.push(
          `${someNames(shortened)} ${shortened.length === 1 ? "was" : "were"} too long, so ${shortened.length === 1 ? "it was" : "they were"} shortened to fit.`
        );
      }
      if (unreadable) parts.push(`${unreadable} couldn't be read.`);
      if (failed.length) parts.push(`Couldn't add ${someNames(failed)}: try them again, or add them by hand.`);
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

  // The recipe's photo as base64: "" when it has none, null when it has one
  // that wouldn't load (the recipe then goes without it, and the message
  // says how many).
  async function photoOf(recipe: Recipe): Promise<string | null> {
    const url = recipeImageUrl(recipe);
    if (!url) return "";
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

  async function exportAll() {
    setStatus(null);
    setProgress("Getting the recipes…");
    try {
      const [all, ratings] = await Promise.all([
        recipes().getFullList({ sort: "title" }),
        recipeRatings().getFullList(),
      ]);
      // Written into the file a recipe (and its photo) at a time, so a big
      // collection never has to fit in memory at once (paprikaZip).
      const file = await startFile();
      let pieces: Uint8Array[] = [];
      const zip = paprikaZip((piece) => pieces.push(piece));
      const missingPhotos: string[] = [];
      for (const [i, recipe] of all.entries()) {
        setProgress(`Adding ${i + 1} of ${all.length}…`);
        const stars = averageStars(ratings.filter((r) => r.recipe === recipe.id)) ?? 0;
        const photo = await photoOf(recipe);
        if (photo === null) missingPhotos.push(recipe.title);
        zip.add(toPaprika(recipe, photo ?? "", stars));
        for (const piece of pieces) await file.add(piece);
        pieces = [];
      }
      zip.end();
      for (const piece of pieces) await file.add(piece);
      setProgress("Saving…");
      const name = `Bentotachi recipes ${localToday()}.paprikarecipes`;
      const saved = await file.save(name, "application/octet-stream");
      if (saved) {
        const text = `Saved ${all.length} ${all.length === 1 ? "recipe" : "recipes"} as “${name}”.`;
        // A connection that dropped partway: say so, as the copy is missing them.
        const missing = missingPhotos.length
          ? ` ${missingPhotos.length === 1 ? "1 photo" : `${missingPhotos.length} photos`} couldn't be fetched, so ${someNames(missingPhotos)} ${missingPhotos.length === 1 ? "is" : "are"} saved without ${missingPhotos.length === 1 ? "it" : "them"}: export again to include ${missingPhotos.length === 1 ? "it" : "them"}.`
          : "";
        setStatus({ text: text + missing, isError: false });
      }
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
        Your notes and the recipe writer's notes go into each recipe's notes, tags become categories, and each recipe's
        rating is the household's average onigiri (as stars, Paprika's way). The meal plan, shopping list, pantry and cooking history aren't included.
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
