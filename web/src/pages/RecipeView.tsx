import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { confirmDelete, deleteRecipes } from "../recipeDeletion";
import {
  cookedLog,
  displayName,
  errorMessage,
  pb,
  personStyle,
  recipeImageUrl,
  recipePhotoUrl,
  recipes,
  useCurrentUser,
  useQuickMinutes,
  type CookedEntry,
  type MealPlanEntry,
  type PantryItem,
  type Recipe,
} from "../pb";
import { daysHad, nextPlanned } from "../cookHistory";
import NoteList from "../NoteList";
import { continuesNumbering, extraTimes, formatMinutes, headingOf, isQuick, linesToText, textToLines, totalMinutes } from "../format";
import { CartIcon, LinkIcon, PencilIcon, TimerIcon } from "../icons";
import { carriedLinks, linkFor, linkKey, missingFromPantry, sameLinks, type IngredientLink } from "../pantryLinks";
import PantryLinkSheet from "../PantryLinkSheet";
import { useLiveRecords } from "../useLiveRecords";
import { addToShoppingList, addedMessage } from "../shoppingAdd";
import RecipeReactions, { FavoriteHeart, useRecipeRatings } from "../RecipeReactions";
import QuickTime from "../QuickTime";
import PlanButton from "../PlanButton";
import { datePart, formatDay, localToday, timeAgo, toStoredDate } from "../dates";
import { isOffline, saveRecipe, savedRecipes } from "../offline";
import OfflineNote from "../OfflineNote";
import { useCountry, useSingleUser, useTablespoon } from "../household";
import { withRegionalHint } from "../regionalNames";
import { withWeightHint } from "../weights";
import { recipeMeasures, withVolumeHint, type RecipeMeasures } from "../volumes";
import { withTemperatureHint } from "../temperatures";
import { withLengthHint } from "../lengths";
import QuickTags from "../QuickTags";
import { DetailsEditor, EditButton, TextEditor } from "../RecipeInlineEdit";
import SoftText from "../SoftText";
import { withoutSoftMarks } from "../softMarks";
import { listWording } from "../weekShopping";
import PhotoFramer from "../PhotoFramer";
import PhotoViewer from "../PhotoViewer";
import HeroPhotos from "../HeroPhotos";
import { shrinkPhoto } from "../pantryPhoto";
import {
  MAX_PHOTOS,
  PHOTO_SIDE,
  carriedStepPhotos,
  galleryPhotos,
  numberedSteps,
  samePhotoSteps,
  savedName,
  stepKey,
  stepPhotos,
  uploadName,
} from "../recipePhotos";
import RecipeTimer from "../RecipeTimer";
import ScaleControl, { scaledServings } from "../ScaleControl";
import RecipeMenu from "../RecipeMenu";
import { scaleLine } from "../scaling";
import { saveScale, savedScale } from "../recipeScale";
import { stepTimes } from "../stepTimers";
import { siteHost } from "../recipeSites";
import RecipeJumpBar from "../RecipeJumpBar";
import { startTimer, useStepTimers } from "../StepTimerTray";

// An ingredient or method line with soft hints for the household: weights,
// temperatures, lengths and liquids in its units ("1½ lbs (680 g)", "350°F
// (180°C)", "1-inch (2.5 cm)", "1 cup (240 ml)"), tablespoons in its spoons
// ("2 tbsp (your 1 tbsp + 2 tsp)") and its names ("bell pepper
// (capsicum)"). Only for showing: the saved line, its pantry link and the
// shopping list keep the original text.
interface Hints {
  country: string;
  measures: RecipeMeasures;
  tablespoon: number;
}

// The recipe's spoons and cups are guessed from its website (volumes.ts).
function useHints(sourceUrl: string): Hints {
  const [country] = useCountry();
  const [tablespoon] = useTablespoon();
  return { country, measures: recipeMeasures(sourceUrl), tablespoon };
}

const withHints = (line: string, { country, measures, tablespoon }: Hints) =>
  withRegionalHint(
    withLengthHint(
      withTemperatureHint(withWeightHint(withVolumeHint(line, country, measures, tablespoon), country), country),
      country,
    ),
    country,
  );

// Shown with the ingredient and method boxes.
const SOFT_HINT = " Select words and press B, I or U to make them bold, soft grey italics or underlined.";

// The parts of a recipe that can be changed right on its page.
type Part = "details" | "ingredients" | "steps" | "author_notes" | "notes" | "nutrition";

export default function RecipeView() {
  const { id = "" } = useParams();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState("");
  const singleUser = useSingleUser();
  // Nutrition shows only to people who turned on "Show nutrition".
  const showNutrition = !!useCurrentUser()?.show_nutrition;
  const navigate = useNavigate();
  // For hints like "1 red bell pepper (capsicum)" in the household's words
  // and units.
  const hints = useHints(recipe?.source_url ?? "");
  // Ticked-off ingredients and steps, only for this cooking session.
  const [done, setDone] = useState<Set<string>>(new Set());
  const ratings = useRecipeRatings(id);
  // "We cooked this" days, shared by the history line and the timer.
  const cooked = useLiveRecords<CookedEntry>("cooked");
  const [cookError, setCookError] = useState("");
  const quickMinutes = useQuickMinutes();
  // Showing the phone's saved copy because the server can't be reached.
  const [offline, setOffline] = useState(false);
  // The part being changed right here, if any (one at a time).
  const [editing, setEditing] = useState<Part | null>(null);
  // The photo framer, opened from the cover photo's viewer.
  const [framing, setFraming] = useState(false);
  // The photo open full size (PhotoViewer.tsx): its file name, "" for the
  // cover, or null.
  const [viewing, setViewing] = useState<string | null>(null);
  // How much bigger or smaller the ingredients are shown (1 = as written),
  // as it was last made on this device (recipeScale.ts).
  const [scale, setScale] = useState(() => savedScale(id));
  function changeScale(factor: number) {
    setScale(factor);
    saveScale(id, factor);
  }
  // Countdowns started from steps (StepTimerTray.tsx), to show which run.
  const timers = useStepTimers();

  useEffect(() => {
    setScale(savedScale(id));
    recipes()
      .getOne(id, { expand: "added_by" })
      .then((found) => {
        setRecipe(found);
        setOffline(false);
        saveRecipe(found);
      })
      .catch((err) => {
        if (!isOffline(err)) return setError(errorMessage(err));
        const saved = savedRecipes()?.find((r) => r.id === id);
        if (saved) {
          setRecipe(saved);
          setOffline(true);
        } else setError("You're offline, and this recipe isn't saved on this phone yet.");
      });
  }, [id]);

  function toggle(key: string) {
    setDone((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (error) return <p className="error">{error}</p>;
  if (!recipe) return <p className="muted">Loading…</p>;

  const current = recipe;
  // ⋯ → Duplicate: a copy to make a variation ("Lasagne (copy)"), with the
  // photo, opened in the editor to change. Ratings, cooking history and
  // plans stay with the original.
  async function duplicate() {
    if (!recipe) return;
    const data: Record<string, unknown> = {
      title: `${recipe.title.slice(0, 290)} (copy)`,
      description: recipe.description,
      source_url: recipe.source_url,
      servings: recipe.servings,
      prep_minutes: recipe.prep_minutes,
      cook_minutes: recipe.cook_minutes,
      total_minutes: recipe.total_minutes,
      extra_times: recipe.extra_times,
      ingredients: recipe.ingredients,
      steps: recipe.steps,
      tags: recipe.tags,
      notes: recipe.notes,
      author_notes: recipe.author_notes,
      nutrition: recipe.nutrition,
      ingredient_links: recipe.ingredient_links,
      site_rating: recipe.site_rating,
      site_rating_count: recipe.site_rating_count,
      image_framing: recipe.image_framing,
      added_by: pb.authStore.record?.id,
    };
    if (recipe.image) {
      // The photo comes along when it loads; the copy is made either way.
      const answer = await fetch(recipeImageUrl(recipe)).catch(() => null);
      if (answer?.ok) data.image = new File([await answer.blob()], recipe.image);
    }
    // The other photos too, sent under made-up names to find them again.
    const sent: [string, string][] = [];
    const photos: File[] = [];
    for (const name of recipe.photos ?? []) {
      const answer = await fetch(recipePhotoUrl(recipe, name)).catch(() => null);
      if (!answer?.ok) continue;
      const upload = uploadName();
      photos.push(new File([await answer.blob()], upload));
      sent.push([name, upload]);
    }
    if (photos.length) data.photos = photos;
    const copy = await recipes().create(data);
    // Step photos stay with their steps, under the copies' names.
    const onSteps: Record<string, string> = {};
    for (const [name, upload] of sent) {
      const key = recipe.photo_steps?.[name];
      const saved = savedName(upload, copy.photos);
      if (key && saved) onSteps[saved] = key;
    }
    if (Object.keys(onSteps).length) await recipes().update(copy.id, { photo_steps: onSteps });
    navigate(`/recipes/${copy.id}/edit`);
  }

  // ⋯ → Delete recipe, after asking (confirmDelete). Several at once: the
  // Recipes page's Edit mode.
  async function remove() {
    if (!recipe) return;
    if (!(await confirmDelete([recipe], singleUser))) return;
    const { failed } = await deleteRecipes([recipe]);
    if (failed.length) throw new Error(`Couldn't delete it: ${errorMessage(failed[0].reason)}`);
    navigate("/", { replace: true });
  }

  // Saves changes to this recipe, showing them straight away and undoing
  // them if the server says no (the editor then shows why).
  async function save(changes: Partial<Recipe>) {
    setRecipe({ ...current, ...changes });
    try {
      const saved = await recipes().update(current.id, changes, { expand: "added_by" });
      setRecipe(saved);
      saveRecipe(saved);
      setEditing(null);
    } catch (err) {
      setRecipe(current);
      throw err;
    }
  }

  // The ingredients, with their pantry links carried over: a reworded line
  // keeps its link and lines that are gone lose theirs (carriedLinks, as in
  // the full editor), worked out from the links as saved now so one someone
  // else picked meanwhile isn't undone.
  async function saveIngredients(text: string) {
    const ingredients = textToLines(text);
    const { ingredient_links: links } = await recipes().getOne(current.id, { fields: "id,ingredient_links" });
    const carried = carriedLinks(current.ingredients ?? [], ingredients, links);
    await save(sameLinks(carried, links) ? { ingredients } : { ingredients, ingredient_links: carried });
  }

  // The method, with step photos kept on their steps (carriedStepPhotos),
  // worked out from them as saved now, like the pantry links.
  async function saveSteps(text: string) {
    const steps = textToLines(text);
    const { photo_steps, photos } = await recipes().getOne(current.id, { fields: "id,photo_steps,photos" });
    const carried = carriedStepPhotos(current.steps, steps, photo_steps, photos);
    await save(samePhotoSteps(carried, photo_steps) ? { steps } : { steps, photo_steps: carried });
  }

  // The photos besides the cover (recipePhotos.ts). Each change saves
  // straight away; step choices are made on photo_steps as saved now, so
  // someone else's meanwhile isn't undone.
  async function savePhotos(data: Record<string, unknown>) {
    const saved = await recipes().update(current.id, data, { expand: "added_by" });
    setRecipe(saved);
    saveRecipe(saved);
    return saved;
  }
  // The cover and photos as saved now: this page doesn't update by itself,
  // and deciding from its copy could replace a cover someone added since
  // (which deletes their photo).
  const photosNow = () => recipes().getOne(current.id, { fields: "id,image,photos" });
  async function photoStepsNow(change: (steps: Record<string, string>) => void) {
    const { photo_steps } = await recipes().getOne(current.id, { fields: "id,photo_steps" });
    const steps = { ...(photo_steps ?? {}) };
    change(steps);
    return steps;
  }
  async function loadPhoto(url: string): Promise<File> {
    const answer = await fetch(url).catch(() => null);
    if (!answer?.ok) throw new Error("Couldn't load the photo. Check the connection and try again.");
    const blob = await answer.blob();
    return new File([blob], uploadName(), { type: blob.type });
  }
  async function setPhotoStep(name: string, key: string | null) {
    const photo_steps = await photoStepsNow((steps) => {
      if (key) steps[name] = key;
      else delete steps[name];
    });
    await savePhotos({ photo_steps });
  }
  async function removePhoto(name: string) {
    const photo_steps = await photoStepsNow((steps) => delete steps[name]);
    await savePhotos({ "photos-": [name], photo_steps });
  }
  // The photo becomes the cover (framed from the middle), and the cover
  // joins the other photos.
  async function makeCover(name: string) {
    const now = await photosNow();
    const data: Record<string, unknown> = {
      image: await loadPhoto(recipePhotoUrl(current, name)),
      image_framing: null,
      "photos-": [name],
      photo_steps: await photoStepsNow((steps) => delete steps[name]),
    };
    if (now.image) data["photos+"] = [await loadPhoto(recipeImageUrl({ ...current, image: now.image }))];
    await savePhotos(data);
    setViewing(null);
  }
  // ⋯ → Add photos: shrunk, then added; the first becomes the cover if
  // there isn't one. Says what happened.
  async function addPhotos(files: File[]): Promise<string> {
    const now = await photosNow();
    const hasCover = !!now.image;
    const room = MAX_PHOTOS - (now.photos?.length ?? 0) + (hasCover ? 0 : 1);
    if (room <= 0) return `This recipe already has ${MAX_PHOTOS} photos besides its cover. Remove one to add another.`;
    const picked = files.slice(0, room);
    const shrunk = await Promise.all(
      picked.map(async (file) => {
        const small = await shrinkPhoto(file, PHOTO_SIDE);
        return new File([small], uploadName(), { type: small.type });
      })
    );
    const data: Record<string, unknown> = {};
    let rest = shrunk;
    if (!hasCover) {
      data.image = shrunk[0];
      data.image_framing = null;
      rest = shrunk.slice(1);
    }
    if (rest.length) data["photos+"] = rest;
    const saved = await savePhotos(data);
    // A server older than these photos (a friend's copy not updated yet)
    // says yes but keeps only the cover.
    if (rest.length && saved.photos === undefined) {
      return hasCover
        ? "This Bentotachi server is too old to keep more photos, so they weren't saved. Whoever runs it can update it, then try again."
        : "Added the first photo as the cover, but this Bentotachi server is too old to keep more, so the others weren't saved. Whoever runs it can update it, then try again.";
    }
    const added = `Added ${picked.length === 1 ? "the photo" : `${picked.length} photos`}${hasCover ? "" : ", the first as the cover"}.`;
    return files.length > picked.length
      ? `${added} The rest didn't fit: a recipe keeps up to ${MAX_PHOTOS} photos besides its cover.`
      : `${added} Tap one to put it with a step.`;
  }

  // "We cooked this" (or finishing the timer): today, by whoever's logged
  // in. Once a day is enough.
  const cookedToday = (cooked.items ?? []).some((entry) => entry.recipe === current.id && datePart(entry.date) === localToday());
  async function markCooked() {
    if (cookedToday) return;
    setCookError("");
    try {
      cooked.upsert(await cookedLog().create({ date: toStoredDate(localToday()), recipe: current.id, cooked_by: pb.authStore.record?.id }));
    } catch (err) {
      setCookError(`Couldn't mark it as cooked: ${errorMessage(err)}`);
    }
  }
  async function undoCooked(entries: CookedEntry[]) {
    setCookError("");
    try {
      for (const entry of entries) {
        await cookedLog().delete(entry.id);
        cooked.removeLocally(entry.id);
      }
    } catch (err) {
      setCookError(`Couldn't undo it: ${errorMessage(err)}`);
    }
  }

  // Each part's ✎, while nothing else is being changed (so no draft is lost).
  const editButton = (part: Part, label: string) =>
    !offline && editing === null ? <EditButton label={label} onClick={() => setEditing(part)} /> : null;
  const stopEditing = () => setEditing(null);

  // Prep, Cook, then any extra ones like "Cool", then Total.
  const times = [
    ["Prep", recipe.prep_minutes],
    ["Cook", recipe.cook_minutes],
    ...extraTimes(recipe).map((time) => [time.label, time.minutes]),
    ["Total", totalMinutes(recipe)],
  ].filter(([, minutes]) => minutes) as [string, number][];
  let stepNumber = 0;
  // The photos: the cover and the gallery at the top, the rest in their
  // steps; the viewer goes through them in that order ("" is the cover).
  const gallery = galleryPhotos(recipe);
  const byStep = stepPhotos(recipe);
  const allPhotos = [
    ...new Set([
      ...(recipe.image ? [""] : []),
      ...gallery,
      ...numberedSteps(recipe.steps).flatMap((step) => byStep.get(stepKey(step.line)) ?? []),
    ]),
  ];

  return (
    <article className="recipe stack">
      {offline && <OfflineNote />}
      {(recipe.image || gallery.length > 0) && !offline && (
        <div className="hero-wrap">
          <HeroPhotos recipe={recipe} gallery={gallery} onOpen={setViewing} />
          <FavoriteHeart state={ratings} onPhoto />
        </div>
      )}
      {viewing !== null && !offline && (
        <PhotoViewer
          recipe={recipe}
          photos={allPhotos}
          shown={viewing}
          onShow={setViewing}
          onClose={() => setViewing(null)}
          onAdjustCover={() => {
            setViewing(null);
            setFraming(true);
          }}
          onSetStep={setPhotoStep}
          onMakeCover={makeCover}
          onRemove={removePhoto}
        />
      )}
      {framing && (
        <PhotoFramer recipe={recipe} onSave={(image_framing) => save({ image_framing })} onClose={() => setFraming(false)} />
      )}
      {editing === "details" ? (
        <DetailsEditor recipe={recipe} onSave={save} onCancel={stopEditing} />
      ) : (
        <>
          <div className="title-row">
            <h1>{recipe.title}</h1>
            <span className="title-actions">
              {!offline && (
                <>
                  <PlanButton recipe={recipe} />
                  <Link to={`/recipes/${recipe.id}/edit`} className="button small">
                    <PencilIcon />
                    Edit
                  </Link>
                </>
              )}
              {/* Share, Save as a Paprika file, Print, Duplicate, Delete. */}
              <RecipeMenu
                recipe={recipe}
                scale={scale}
                offline={offline}
                editing={editing !== null}
                onDuplicate={duplicate}
                onDelete={remove}
                onAddPhotos={addPhotos}
              />
            </span>
          </div>
          {/* About it, in one card: the description, servings and times in
              even columns, "⏱ Time it", and the ✎ for all of those (and the
              name) in its corner. */}
          <section className="details-card" aria-label="About this recipe">
            <span className="details-edit">{editButton("details", "Change the name, description, servings and times")}</span>
            {recipe.description && <DescriptionPreview key={recipe.id} text={recipe.description} />}
            {(recipe.servings || times.length > 0) && (
              <dl className="facts">
                {recipe.servings && (
                  <div>
                    <dt>Makes</dt>
                    <dd>{scaledServings(recipe.servings, scale)}</dd>
                  </div>
                )}
                {times.map(([label, minutes], index) => (
                  <div key={index}>
                    <dt>{label}</dt>
                    <dd>
                      <QuickTime quick={label === "Total" && isQuick(recipe, quickMinutes)}>{formatMinutes(minutes)}</QuickTime>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            {/* Timing it while cooking, to save how long it really takes. */}
            {!offline && <RecipeTimer recipe={recipe} onSave={save} onFinished={() => void markCooked()} />}
          </section>
        </>
      )}

      <QuickTags
        tags={recipe.tags ?? []}
        content={[recipe.title, recipe.description, ...(recipe.ingredients ?? [])].join("\n")}
        canEdit={!offline}
        onSave={(tags) => save({ tags })}
      />

      {!offline && (
        <>
          {/* How it's gone for us, in one card: ratings, then when it was
              last had and next planned, with "We cooked this". */}
          <div className="verdict-card">
            <RecipeReactions state={ratings} showHeart={!recipe.image} />
            {/* The website's own rating, plainly the site's (★, not onigiri). */}
            {!!recipe.site_rating && !!siteHost(recipe.source_url) && (
              <p className="muted site-rating">
                <span className="site-star">★</span> {recipe.site_rating}
                {recipe.site_rating_count
                  ? ` from ${recipe.site_rating_count.toLocaleString()} ${recipe.site_rating_count === 1 ? "rating" : "ratings"}`
                  : ""}{" "}
                on {siteHost(recipe.source_url)}
              </p>
            )}
            <CookHistory
              recipeId={recipe.id}
              cooked={cooked.items ?? []}
              onCooked={() => void markCooked()}
              onUndo={(entries) => void undoCooked(entries)}
            />
            {cookError && <p className="error">{cookError}</p>}
          </div>
        </>
      )}

      {/* Ingredients · Method · Notes, sticking under the top bar. */}
      <RecipeJumpBar
        sections={[
          { id: "jump-ingredients", label: "Ingredients" },
          { id: "jump-method", label: "Method" },
          ...(recipe.author_notes || recipe.notes ? [{ id: "jump-notes", label: "Notes" }] : []),
        ]}
      />

      <div id="jump-ingredients" className="jump-target">
      {editing === "ingredients" ? (
        <section className="recipe-panel">
          <h2>Ingredients</h2>
          <TextEditor
            label="Ingredients"
            hint={"One per line. Start a line with # for a heading, like “# For the sauce”." + SOFT_HINT}
            initial={linesToText(recipe.ingredients)}
            rows={12}
            onSave={saveIngredients}
            onCancel={stopEditing}
          />
        </section>
      ) : (
        <IngredientsSection
          recipe={recipe}
          offline={offline}
          done={done}
          onToggleDone={toggle}
          onRecipeChange={setRecipe}
          editButton={editButton("ingredients", "Change the ingredients")}
          scale={scale}
          onScale={changeScale}
        />
      )}
      </div>

      <section id="jump-method" className="recipe-panel">
        <div className="section-head">
          <h2>Method</h2>
          {editButton("steps", "Change the method")}
        </div>
        {editing === "steps" ? (
          <TextEditor
            label="Method"
            hint={
              "One step per line. A # heading starts the step numbers again at 1 (a separate part, like a sauce); a ## heading carries on counting." +
              SOFT_HINT
            }
            initial={linesToText(recipe.steps)}
            rows={12}
            onSave={saveSteps}
            onCancel={stopEditing}
          />
        ) : (
          <ol className="steps">
            {(recipe.steps ?? []).map((line, i) => {
              const heading = headingOf(line);
              if (heading !== null) {
                // A # heading's steps count from 1 again, like recipe sites;
                // a ## heading's carry on from the steps before.
                if (!continuesNumbering(line)) stepNumber = 0;
                return (
                  <li key={i} className="list-heading">
                    <SoftText text={heading} />
                  </li>
                );
              }
              const key = `s${i}`;
              stepNumber += 1;
              const number = stepNumber;
              const times = stepTimes(withoutSoftMarks(line));
              const photosHere = offline ? [] : (byStep.get(stepKey(line)) ?? []);
              return (
                <li key={i}>
                  <button className={`step ${done.has(key) ? "done" : ""}`} onClick={() => toggle(key)} aria-pressed={done.has(key)}>
                    <span className="step-number">{number}</span>
                    <span>
                      <SoftText text={withHints(line, hints)} />
                    </span>
                  </button>
                  {/* Beside the step, not inside it: the step itself is a button. */}
                  {times.length > 0 && (
                    <div className="step-timers">
                      {times.map((time) => {
                        const running = timers.some(
                          (t) => t.recipeId === recipe.id && t.step === number && t.label === time.label && !t.rang
                        );
                        return (
                          <button
                            key={time.label}
                            className="timer-chip"
                            onClick={() => startTimer(recipe.id, recipe.title, number, time)}
                            disabled={running}
                            aria-label={running ? `Step ${number}'s ${time.label} timer is running` : `Start a ${time.label} timer for step ${number}`}
                          >
                            <TimerIcon size={14} />
                            {running ? `${time.label}, running` : time.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                  {photosHere.length > 0 && (
                    <div className="step-photos">
                      {photosHere.map((name) => (
                        <button key={name} className="step-photo" onClick={() => setViewing(name)} aria-label={`Step ${number}'s photo, full size`}>
                          <img src={recipePhotoUrl(recipe, name, "600x0")} alt="" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {(recipe.author_notes || recipe.notes || editing === "author_notes" || editing === "notes") && (
      <div id="jump-notes" className="stack">
      {(recipe.author_notes || editing === "author_notes") && (
        <section>
          <div className="section-head">
            <h2>Author's notes</h2>
            {editButton("author_notes", "Change the author's notes")}
          </div>
          {editing === "author_notes" ? (
            <TextEditor
              label="Author's notes"
              hint="Tips from the recipe's writer, like swaps, storage or making ahead."
              initial={recipe.author_notes ?? ""}
              rows={6}
              onSave={(text) => save({ author_notes: text.trim() })}
              onCancel={stopEditing}
            />
          ) : (
            <NoteList text={recipe.author_notes} />
          )}
        </section>
      )}
      {(recipe.notes || editing === "notes") && (
        <section>
          <div className="section-head">
            <h2>Our notes</h2>
            {editButton("notes", "Change our notes")}
          </div>
          {editing === "notes" ? (
            <TextEditor
              label="Our notes"
              hint="Changes you made, what worked, what to try next time."
              initial={recipe.notes}
              rows={5}
              onSave={(text) => save({ notes: text.trim() })}
              onCancel={stopEditing}
            />
          ) : (
            <NoteList text={recipe.notes} />
          )}
        </section>
      )}
      </div>
      )}
      {/* Per serving, for people who turned on "Show nutrition" (the ⋮ menu):
          from the website's recipe data or a Paprika file, or typed in. */}
      {showNutrition && ((recipe.nutrition?.length ?? 0) > 0 || editing === "nutrition") && (
        <section className="nutrition">
          <div className="section-head">
            <h2>Nutrition</h2>
            {editButton("nutrition", "Change the nutrition")}
          </div>
          {editing === "nutrition" ? (
            <TextEditor
              label="Nutrition"
              hint="Per serving, one per line, like “Calories: 420 kcal”."
              initial={(recipe.nutrition ?? []).join("\n")}
              rows={8}
              onSave={(text) => save({ nutrition: textToLines(text) })}
              onCancel={stopEditing}
            />
          ) : (
            <>
              {/* Where the numbers are from, as Bentotachi doesn't work them
                  out (a tester asked, 2026-11-08). Not the site's name: they
                  may have been typed in (review, 2026-11-08). */}
              <p className="muted nutrition-note">
                Per serving{scale !== 1 ? ", whatever the recipe's size" : ""}, as the recipe gives it (Bentotachi doesn't
                work it out).
              </p>
              <dl className="nutrition-list">
                {(recipe.nutrition ?? []).map((line, i) => {
                  const at = line.indexOf(":");
                  return at > 0 ? (
                    <div key={i}>
                      <dt>{line.slice(0, at)}</dt>
                      <dd>{line.slice(at + 1).trim()}</dd>
                    </div>
                  ) : (
                    <div key={i}>
                      <dd>{line}</dd>
                    </div>
                  );
                })}
              </dl>
            </>
          )}
        </section>
      )}
      {!offline &&
        editing === null &&
        (!recipe.notes || !recipe.author_notes || (showNutrition && !recipe.nutrition?.length)) && (
        <p className="add-notes">
          {/* In the same order as the sections they add. */}
          {!recipe.author_notes && (
            <button className="link-button" onClick={() => setEditing("author_notes")}>
              + Add author's notes
            </button>
          )}
          {!recipe.notes && (
            <button className="link-button" onClick={() => setEditing("notes")}>
              + Add our notes
            </button>
          )}
          {showNutrition && !recipe.nutrition?.length && (
            <button className="link-button" onClick={() => setEditing("nutrition")}>
              + Add nutrition
            </button>
          )}
        </p>
      )}

      {(recipe.source_url || (recipe.expand?.added_by && !singleUser)) && (
        // One line, "From ica.se · Added by Sam" (Xel, 2026-11-08).
        <footer className="muted small-print">
          <p>
            {recipe.source_url && (
              <>
                From{" "}
                <a href={recipe.source_url} target="_blank" rel="noreferrer">
                  {siteHost(recipe.source_url)}
                </a>
              </>
            )}
            {recipe.source_url && recipe.expand?.added_by && !singleUser && <span aria-hidden="true"> · </span>}
            {recipe.expand?.added_by && !singleUser && (
              <>
                Added by{" "}
                {/* Opens the recipe list showing everything they added. */}
                <Link
                  to={`/?by=${recipe.added_by}`}
                  className="person-name"
                  style={personStyle(recipe.expand.added_by)}
                  aria-label={`Recipes added by ${displayName(recipe.expand.added_by)}`}
                >
                  {displayName(recipe.expand.added_by)}
                </Link>
              </>
            )}
          </p>
        </footer>
      )}

    </article>
  );
}

// Ingredients, with two modes: normally the boxes are for ticking things off
// while cooking; "Add to list" switches them to picking what to buy. Each
// line also shows its pantry item's status (Have / Low / Out), linked by a
// guess or by someone's choice; tapping it changes the link.
function IngredientsSection({
  recipe,
  offline,
  done,
  onToggleDone,
  onRecipeChange,
  editButton,
  scale,
  onScale,
}: {
  recipe: Recipe;
  // Offline, the pantry and shopping list can't be reached: just the list.
  offline: boolean;
  done: Set<string>;
  onToggleDone: (key: string) => void;
  onRecipeChange: (recipe: Recipe) => void;
  // The ✎ that changes the ingredients right here.
  editButton: ReactNode;
  // Amounts shown this many times as written (ScaleControl).
  scale: number;
  onScale: (scale: number) => void;
}) {
  const pantry = useLiveRecords<PantryItem>("pantry_items");
  const pantryList = pantry.items ?? [];
  const hints = useHints(recipe.source_url ?? "");
  const lines = recipe.ingredients ?? [];
  const pickable = lines.flatMap((line, i) => (headingOf(line) === null ? [i] : []));
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);
  // The line whose pantry link is being changed.
  const [linking, setLinking] = useState<string | null>(null);

  const linkOf = (line: string) => linkFor(line, recipe.ingredient_links, pantryList);
  // Lines the pantry doesn't have enough of, or at all (not water and the
  // like): "Missing from pantry", and "Select what we need" when choosing
  // (which once left out lines not linked to the pantry; Xel, 2026-11-08).
  const missing = pickable.filter((i) => missingFromPantry(linkOf(lines[i])));
  // "Add to shopping list" first offers All / Missing from pantry / Choose
  // (Lilly, 2026-11-08); Choose is the ticking below.
  const [choosing, setChoosing] = useState(false);

  function startPicking() {
    setChoosing(false);
    setPicking(true);
    setPicked(new Set());
    setStatus(null);
  }

  function togglePicked(index: number) {
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  // Saves someone's choice for a line (a pantry item id, or "" for "not a
  // pantry item"), showing it straight away. `added` is a pantry item just
  // made in the panel: it's added to this page's pantry list at once rather
  // than waiting for the live update (which may never come on a weak
  // connection), or the line would look unlinked.
  async function chooseLink(line: string, pantryItemId: string, added?: PantryItem) {
    setLinking(null);
    setStatus(null);
    if (added) pantry.upsert(added);
    const key = linkKey(line);
    const before = recipe;
    onRecipeChange({ ...recipe, ingredient_links: { ...(recipe.ingredient_links ?? {}), [key]: pantryItemId } });
    try {
      // Added to the links as saved now, not this page's copy, so a link
      // someone else chose meanwhile isn't undone.
      const { ingredient_links: current } = await recipes().getOne(recipe.id, { fields: "id,ingredient_links" });
      const links = { ...(current ?? {}), [key]: pantryItemId };
      const saved = await recipes().update(recipe.id, { ingredient_links: links }, { expand: "added_by" });
      onRecipeChange(saved);
    } catch (err) {
      onRecipeChange(before);
      setStatus({ text: errorMessage(err), isError: true });
    }
  }

  async function addPicked(indexes: Iterable<number> = picked) {
    setBusy(true);
    setStatus(null);
    try {
      const things = [...indexes]
        .sort((a, b) => a - b)
        .map((index) => {
          const { item } = linkOf(lines[index]);
          // In the recipe's words at its size, without how to prepare it
          // ("2 onions", listWording); still linked to its pantry item, so
          // buying it marks that as Have again.
          return {
            text: listWording(scaleLine(lines[index], scale)),
            pantryItem: item?.id ?? "",
            recipe: recipe.id,
          };
        });
      setStatus({ text: addedMessage(await addToShoppingList(things)), isError: false });
      setPicking(false);
      setChoosing(false);
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
    } finally {
      setBusy(false);
    }
  }

  const allPicked = picked.size === pickable.length;

  return (
    <section className="recipe-panel">
      <div className="section-head">
        <h2>Ingredients</h2>
        {!picking && editButton}
      </div>
      {picking ? (
        <p className="muted">Tick what you need to buy.</p>
      ) : (
        pickable.length > 0 && <ScaleControl servings={recipe.servings ?? ""} factor={scale} onChange={onScale} />
      )}

      <ul className={`checklist ${picking ? "picking" : ""}`}>
        {lines.map((line, i) => {
          const heading = headingOf(line);
          if (heading !== null)
            return (
              <li key={i} className="list-heading">
                <SoftText text={heading} />
              </li>
            );
          const key = `i${i}`;
          return (
            <li key={i} className="ingredient-row">
              {picking ? (
                <label>
                  <input type="checkbox" checked={picked.has(i)} onChange={() => togglePicked(i)} />
                  <SoftText text={withHints(scaleLine(line, scale), hints)} />
                </label>
              ) : (
                <label className={done.has(key) ? "done" : ""}>
                  <input type="checkbox" checked={done.has(key)} onChange={() => onToggleDone(key)} />
                  <SoftText text={withHints(scaleLine(line, scale), hints)} />
                </label>
              )}
              {pantry.items && <PantryChip line={line} link={linkOf(line)} onClick={() => setLinking(line)} />}
            </li>
          );
        })}
      </ul>

      {/* Under the list, where picking's own buttons then appear. */}
      {!picking && !choosing && !offline && pickable.length > 0 && (
        <button
          className="button add-to-list"
          onClick={() => {
            setChoosing(true);
            setStatus(null);
          }}
        >
          <CartIcon size={18} />
          Add to shopping list
        </button>
      )}
      {choosing && (
        <div className="add-choices" role="group" aria-label="Add to the shopping list">
          <button className="button" disabled={busy} onClick={() => void addPicked(pickable)}>
            All ({pickable.length})
          </button>
          <button className="button" disabled={busy || missing.length === 0} onClick={() => void addPicked(missing)}>
            {missing.length ? `Missing from pantry (${missing.length})` : "Pantry has it all"}
          </button>
          <button className="button" disabled={busy} onClick={startPicking}>
            Choose…
          </button>
          <button className="button ghost" disabled={busy} onClick={() => setChoosing(false)}>
            Cancel
          </button>
        </div>
      )}
      {picking && (
        <div className="actions">
          {missing.length > 0 && (
            <button className="button" onClick={() => setPicked(new Set(missing))}>
              Select what we need ({missing.length})
            </button>
          )}
          <button className="button" onClick={() => setPicked(new Set(allPicked ? [] : pickable))}>
            {allPicked ? "Select none" : "Select all"}
          </button>
          <button className="button ghost" onClick={() => setPicking(false)} disabled={busy}>
            Cancel
          </button>
          <button className="button primary" disabled={picked.size === 0 || busy} onClick={() => void addPicked()}>
            {busy ? "Adding…" : picked.size ? `Add ${picked.size} to shopping list` : "Add to shopping list"}
          </button>
        </div>
      )}
      {status && (
        <p className={status.isError ? "error" : "success"} role="status">
          {status.text} {!status.isError && <Link to="/shopping">Open the list</Link>}
        </p>
      )}

      {linking !== null && (
        <PantryLinkSheet
          line={linking}
          current={linkOf(linking)}
          items={pantryList}
          onChoose={(id, added) => void chooseLink(linking, id, added)}
          onClose={() => setLinking(null)}
        />
      )}
    </section>
  );
}

const STATUS_WORDS = { have: "Have", low: "Low", out: "Out" } as const;

// The pantry status beside an ingredient when it's linked: the pantry's
// level (three bars) and the word, all the same width so they line up (a
// dotted outline means Bento guessed the link); or a faint link button when
// it isn't linked. Tapping either changes the link.
function PantryChip({ line, link, onClick }: { line: string; link: IngredientLink; onClick: () => void }) {
  if (!link.item) {
    return (
      <button
        className="pantry-link-button"
        onClick={onClick}
        aria-label={`Link “${line}” to the pantry`}
        title={link.kind === "notPantry" ? "Not a pantry item (tap to change)" : "Link to the pantry"}
      >
        <LinkIcon />
      </button>
    );
  }
  const status = link.item.status;
  const description = `${link.item.name}: ${STATUS_WORDS[status]}${link.kind === "guessed" ? " (guessed)" : ""}. Tap to change.`;
  return (
    <button
      className={`pantry-chip status-${status} ${link.kind === "guessed" ? "guessed" : ""}`}
      onClick={onClick}
      aria-label={`Pantry: ${description}`}
      title={description}
    >
      <span className="meter-bars" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      {STATUS_WORDS[status]}
    </button>
  );
}

// The description, cut to a few lines. Tapping the box (or "Show more")
// opens the full text; the button only appears when there's more to show.
function DescriptionPreview({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  // Measure while it's cut short, and again if the screen size changes.
  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element || expanded) return;
    const measure = () => setOverflows(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, expanded]);

  function toggle() {
    // Don't snap shut while someone is selecting text to copy it.
    if (window.getSelection()?.toString()) return;
    setExpanded((value) => !value);
  }

  return (
    <div className={`description-box ${overflows ? "expandable" : ""}`} onClick={overflows ? toggle : undefined}>
      <p ref={textRef} className={expanded ? "description" : "description clamped"}>
        <SoftText text={text} />
      </p>
      {overflows && (
        <button
          type="button"
          className="link-button"
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((value) => !value);
          }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

// When we last had this, going by past nights on the dinner plan, and when
// it's next planned: "Last had 2 weeks ago (Tue, Oct 14) · 3 times · Next: Mon, Nov 2".
// Counted from past nights on the dinner plan and "We cooked this" (see
// cookHistory.ts). The button records today; once it has, it offers Undo.
function CookHistory({
  recipeId,
  cooked,
  onCooked,
  onUndo,
}: {
  recipeId: string;
  cooked: CookedEntry[];
  onCooked: () => void;
  onUndo: (entries: CookedEntry[]) => void;
}) {
  const plan = useLiveRecords<MealPlanEntry>("meal_plan");
  const planned = plan.items ?? [];
  const today = localToday();
  const days = daysHad(recipeId, planned, cooked, today);
  const next = nextPlanned(recipeId, planned, cooked, today);
  const last = days[days.length - 1];
  const cookedToday = cooked.filter((entry) => entry.recipe === recipeId && datePart(entry.date) === today);
  return (
    <div className="cook-history">
      {/* One line each, beside the button, so it sits the same way however
          much there is to say. */}
      <div className="muted plan-history">
        {last && (
          <>
            <p>{last === today ? "Had today" : `Last had ${formatDay(last)}`}</p>
            {(last !== today || days.length > 1) && (
              <p className="plan-history-detail">
                {[last !== today && timeAgo(last, today), days.length > 1 && `${days.length} times`].filter(Boolean).join(" · ")}
              </p>
            )}
          </>
        )}
        {next && (
          <p>
            Next: <Link to="/plan">{next === today ? "today" : formatDay(next)}</Link>
          </p>
        )}
        {!last && !next && <p>Not cooked yet</p>}
      </div>
      {cookedToday.length ? (
        <button className="link-button cooked-undo" onClick={() => onUndo(cookedToday)}>
          Undo “cooked today”
        </button>
      ) : (
        <button className="button small cooked-button" onClick={onCooked}>
          <span className="button-mark" aria-hidden="true">✓</span> We cooked this
        </button>
      )}
    </div>
  );
}
