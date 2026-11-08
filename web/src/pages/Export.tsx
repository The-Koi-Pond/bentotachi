import { useEffect, useState, type ChangeEvent } from "react";
import {
  errorMessage,
  isAndroidApp,
  pb,
  recipeCategories,
  recipeRatings,
  recipes,
  type Recipe,
  type RecipeCategory,
} from "../pb";
import { inCategory, sortCategories } from "../recipeCategories";
import { useLocation, useNavigate } from "react-router";
import { readSharedFile, type SharedFile } from "../shareReceiver";
import { fileNamePart, savePaprikaFile } from "../paprikaSave";
import {
  alreadyHave,
  fitImported,
  fromPaprika,
  isSmallPhoto,
  paprikaEntries,
  paprikaPhotos,
  paprikaPhotoUrl,
  paprikaRating,
  paprikaStepPhotos,
  someNames,
} from "../paprikaImport";
import { MAX_PHOTOS, photoStepsFor, uploadName } from "../recipePhotos";
import { localToday } from "../dates";
import { HelpBox, HelpButton, useHelp } from "../Help";

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

// A recipe's full-size photo from its web address, fetched by the server
// (server/pb_hooks/recipe_photo.pb.js; browsers can't read other sites'
// files), or null if it couldn't be.
async function recipePhoto(url: string): Promise<Blob | null> {
  try {
    const answer = await fetch(pb.buildURL("/api/cookbook/recipe-photo"), {
      method: "POST",
      headers: { "content-type": "application/json", authorization: pb.authStore.token },
      body: JSON.stringify({ url }),
    });
    return answer.ok ? await answer.blob() : null;
  } catch {
    return null;
  }
}

// Adds the recipes from a Paprika file (see paprikaImport.ts), with their
// photos, skipping any already here (alreadyHave: Bentotachi's own export
// of it, or the same name and the same link or ingredients).
function ImportRecipes() {
  const help = useHelp();
  const [progress, setProgress] = useState("");
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);
  const busy = progress !== "";

  // A Paprika file opened with Bentotachi from Files, email or chat
  // (shareReceiver.ts): offered here, imported once you say so.
  const navigate = useNavigate();
  const location = useLocation();
  const [opened, setOpened] = useState<SharedFile | null>(() => (location.state as { sharedFile?: SharedFile } | null)?.sharedFile ?? null);
  useEffect(() => {
    const state = location.state as { sharedFile?: SharedFile; sharedError?: string } | null;
    const shared = state?.sharedFile;
    // A file opened with Bentotachi that couldn't be read.
    if (state?.sharedError) {
      setStatus({ text: state.sharedError, isError: true });
      navigate(".", { replace: true, state: null });
      return;
    }
    if (!shared) return;
    setOpened(shared);
    // Taken out of the page's history, so going back doesn't offer it again.
    navigate(".", { replace: true, state: null });
  }, [location.state, navigate]);

  async function importOpened() {
    if (!opened) return;
    setStatus(null);
    setProgress("Reading the file…");
    try {
      const file = await readSharedFile(opened);
      setOpened(null);
      await importFile(file);
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
      setProgress("");
    }
  }

  function pickFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void importFile(file);
  }

  async function importFile(file: File) {
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
      const me = pb.authStore.record?.id;
      let added = 0;
      let rated = 0;
      let unrated = 0;
      // Added with only Paprika's small preview as their photo.
      let smallPhotos = 0;
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
        const { cover: photo, gallery } = paprikaPhotos(raw);
        let image =
          photo && photo.bytes.length <= MAX_PHOTO
            ? new File([new Uint8Array(photo.bytes)], `photo.${photo.type.split("/")[1]}`, { type: photo.type })
            : undefined;
        // Paprika's photo is only a small preview; one saved from a website
        // has the site's full-size photo's address, which the server fetches.
        // The preview stays if that fails.
        const small = !!photo && isSmallPhoto(photo.bytes);
        const link = paprikaPhotoUrl(raw);
        let full = false;
        if (link && (!photo || small)) {
          const blob = await recipePhoto(link);
          if (blob && blob.size <= MAX_PHOTO) {
            image = new File([blob], `photo.${blob.type.split("/")[1] || "jpg"}`, { type: blob.type });
            full = true;
          }
        }
        if (small && !full) smallPhotos += 1;
        // Its other photos too (up to Bentotachi's limit), sent under
        // made-up names to find them again for their steps.
        const sent: [string, string][] = [];
        const photos: File[] = [];
        for (const extra of gallery) {
          if (photos.length >= MAX_PHOTOS || extra.bytes.length > MAX_PHOTO) continue;
          const upload = uploadName();
          photos.push(new File([new Uint8Array(extra.bytes)], upload, { type: extra.type }));
          sent.push([extra.name, upload]);
        }
        let created: Recipe;
        try {
          created = await recipes().create({ ...recipe, ...(image && { image }), ...(photos.length && { photos }) });
          existing.push({ id: created.id, title: recipe.title, source_url: recipe.source_url, ingredients: recipe.ingredients } as Recipe);
          added += 1;
          if (twin) sameName.push(recipe.title);
        } catch {
          failed.push(recipe.title);
          continue;
        }
        // Photos marked in a step ("[photo:Step 3]") show in that step. The
        // recipe is in either way.
        const photo_steps = photoStepsFor(sent, paprikaStepPhotos(raw), created.photos);
        if (Object.keys(photo_steps).length) await recipes().update(created.id, { photo_steps }).catch(() => {});
        // Paprika's rating and favorite are the person's own, so they
        // become the importing person's onigiri and heart. The recipe is in
        // either way; a rating that won't save is only counted.
        const rating = paprikaRating(raw);
        if (rating && me) {
          try {
            await recipeRatings().create({ recipe: created.id, user: me, stars: rating.stars, favorite: rating.favorite, approved: false });
            rated += 1;
          } catch {
            unrated += 1;
          }
        }
      }
      if (!added && !skipped.length && !failed.length) {
        setStatus({ text: "That doesn't look like a Paprika file. Export one from your other app and try again.", isError: true });
        return;
      }
      const parts = [`Added ${added} ${added === 1 ? "recipe" : "recipes"}.`];
      if (rated) parts.push(`${rated === 1 ? "1 came" : `${rated} came`} with a rating or favorite, now yours.`);
      if (unrated) parts.push(`${unrated === 1 ? "1 rating" : `${unrated} ratings`} couldn't be saved: rate ${unrated === 1 ? "it" : "them"} on the recipe page.`);
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
      if (smallPhotos) {
        parts.push(
          `The file only had small previews of ${smallPhotos === 1 ? "1 photo" : `${smallPhotos} photos`}, so ${smallPhotos === 1 ? "it" : "they"} may look blurry: a better one can go in from the recipe's Edit.`
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
      <h2>
        Import recipes
        <HelpButton help={help} label="What comes across" />
      </h2>
      <p>
        Adds recipes from a Paprika file (<code>.paprikarecipes</code>), with their photos. Paprika, Mealie, Tandoor and
        Bentotachi itself can export one. Recipes already here are skipped, so importing the same file twice is fine.
      </p>
      <HelpBox help={help}>
        <p>
          Categories become tags, and each recipe's rating becomes your own onigiri (and a favourite your heart, where the
          file has them: Paprika's own files don't). Nutrition comes too; where it's from (when that isn't a link) and
          difficulty go into its notes. Meal plans don't come across.
        </p>
      </HelpBox>
      {opened && !busy && (
        <div className="opened-file stack" role="status">
          <p>
            Import “<strong>{opened.name}</strong>”?
          </p>
          <div className="actions">
            <button className="button" onClick={() => setOpened(null)}>
              Not now
            </button>
            <button className="button primary" onClick={() => void importOpened()}>
              Import it
            </button>
          </div>
        </div>
      )}
      <div className="actions">
        <label className={`button ${opened ? "" : "primary"} ${busy ? "disabled" : ""}`}>
          {busy ? progress : opened ? "Choose another file" : "Choose a file"}
          {/* Android's file picker greys out types it doesn't know (it has
              no type for .paprikarecipes), so the app lets any file through
              and the import says if it isn't one. */}
          <input
            type="file"
            accept={isAndroidApp ? undefined : ".paprikarecipes,.paprikarecipe"}
            onChange={pickFile}
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
  const help = useHelp();
  const [progress, setProgress] = useState("");
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);
  const busy = progress !== "";
  // What to export: "all", "favorites" (yours), or a shelf's id (its
  // recipes are the ones with its tags, as on the recipe list).
  const [which, setWhich] = useState("all");
  const [categories, setCategories] = useState<RecipeCategory[] | null>(null);
  useEffect(() => {
    recipeCategories()
      .getFullList()
      .then((list) => setCategories(sortCategories(list).filter((category) => (category.tags ?? []).length > 0)))
      .catch(() => setCategories([]));
  }, []);

  async function exportAll() {
    setStatus(null);
    setProgress("Getting the recipes…");
    const me = pb.authStore.record?.id;
    try {
      const [every, ratings] = await Promise.all([
        recipes().getFullList({ sort: "title" }),
        recipeRatings().getFullList(),
      ]);
      // Every recipe, one shelf's, or your favorites.
      const shelf = (categories ?? []).find((category) => category.id === which);
      const all =
        which === "favorites"
          ? every.filter((recipe) => ratings.some((r) => r.recipe === recipe.id && r.user === me && r.favorite))
          : shelf
            ? every.filter((recipe) => inCategory(recipe, shelf))
            : every;
      if (!all.length) {
        setStatus({
          text:
            which === "favorites"
              ? "You haven't hearted any recipes yet."
              : shelf
                ? "There are no recipes on that shelf yet."
                : "There are no recipes to export yet.",
          isError: true,
        });
        return;
      }
      // "Bentotachi recipes 2026-11-07", "Bentotachi Soups 2026-11-07".
      const part = which === "favorites" ? "favorites" : shelf ? fileNamePart(shelf.name).slice(0, 40) : "";
      const name = `Bentotachi ${part || "recipes"} ${localToday()}.paprikarecipes`;
      const { saved, missingPhotos } = await savePaprikaFile(all, ratings, me, name, setProgress);
      if (saved) {
        const text = `Saved ${all.length} ${all.length === 1 ? "recipe" : "recipes"} as “${name}”.`;
        // A connection that dropped partway: say so, as the copy is missing them.
        const missing = missingPhotos.length
          ? ` Some photos couldn't be fetched, so ${someNames(missingPhotos)} ${missingPhotos.length === 1 ? "is" : "are"} saved without ${missingPhotos.length === 1 ? "one" : "some"}: export again to include them.`
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
      <h2>
        Export recipes
        <HelpButton help={help} label="What goes in the file" />
      </h2>
      <p>
        Saves recipes, with their photos, as one Paprika file (<code>.paprikarecipes</code>). Paprika, Mealie, Tandoor
        and Bentotachi can import it, so you can move your recipes to another app, share a shelf with a friend, or just
        keep a copy.
      </p>
      <label>
        Which recipes
        <select value={which} onChange={(e) => setWhich(e.target.value)} disabled={busy}>
          <option value="all">Every recipe</option>
          <option value="favorites">My favorites</option>
          {(categories ?? []).map((category) => (
            <option key={category.id} value={category.id}>
              The {category.name} shelf
            </option>
          ))}
        </select>
      </label>
      <HelpBox help={help}>
        <p>
          Your notes and the recipe writer's notes go into each recipe's notes, tags become categories, each recipe's
          rating is the household's average onigiri (as stars, Paprika's way), and your hearts become favourites. The
          meal plan, shopping list, pantry and cooking history aren't included.
        </p>
      </HelpBox>
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
