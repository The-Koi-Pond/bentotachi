import { useEffect, useMemo, useRef, useState } from "react";
import { useModalSheet } from "./useModalSheet";
import {
  averageStars,
  errorMessage,
  recipeRatings,
  recipes,
  useCurrentUser,
  useQuickMinutes,
  type PantryItem,
  type Recipe,
  type RecipeRating,
} from "./pb";
import { formatDay, localToday, timeAgo } from "./dates";
import { formatMinutes, isQuick, totalMinutes } from "./format";
import { matchesSearch } from "./recipeSearch";
import { searchVariants } from "./regionalNames";
import { pantryCheck } from "./pantryLinks";
import { twinLabels } from "./recipeTwins";
import { useLiveRecords } from "./useLiveRecords";
import { CloseIcon, HeartIcon, OnigiriIcon, ZapIcon } from "./icons";
import RecipePhoto from "./RecipePhoto";
import { MEAL_NAMES, type Meal } from "./meals";
import { useSpell } from "./household";
import RecipeStandIn from "./RecipeStandIn";
import { surpriseLine } from "./surpriseLines";

// Slides up from the bottom to choose a meal for one day: search names,
// tags and ingredients, narrow to favorites or quick recipes, and see what's
// already planned. Or skip the recipes and write a short note instead, like
// "Take-away night". Closes with ✕, Escape, tapping outside, or (in the
// Android app) the back gesture.

// One-tap notes for the usual non-recipe nights.
const NOTE_SUGGESTIONS = ["Take-away", "Leftovers", "Eating out"];

export default function RecipeChooser({
  date,
  meal,
  upcoming,
  lastHad,
  onPick,
  onNote,
  onClose,
}: {
  date: string;
  meal: Meal;
  // Recipe id -> days it's already planned for, from today on.
  upcoming: Map<string, string[]>;
  // Recipe id -> the last night before today it was on the plan.
  lastHad: Map<string, string>;
  onPick: (recipe: Recipe) => void;
  onNote: (note: string) => void;
  onClose: () => void;
}) {
  const [note, setNote] = useState("");
  const me = useCurrentUser();
  const quickMinutes = useQuickMinutes();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [all, setAll] = useState<Recipe[] | null>(null);
  const [ratings, setRatings] = useState<RecipeRating[]>([]);
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const spell = useSpell();
  const [quickOnly, setQuickOnly] = useState(false);
  const [haveOnly, setHaveOnly] = useState(false);
  // "Surprise me": the recipe Bento picked, shown above the list, with what
  // it says about it (surpriseLines.ts), cheekier the more times in a row
  // it's asked while the chooser is open.
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [surprised, setSurprised] = useState<{ rolls: number; line: string }>({ rolls: 0, line: "" });
  const [error, setError] = useState("");
  const pantry = useLiveRecords<PantryItem>("pantry_items");

  // Open as a modal (dimmed background, focus inside) as soon as it appears.
  const sheetClosed = useModalSheet(dialogRef, onClose);

  useEffect(() => {
    recipes()
      .getFullList({
        sort: "title",
        fields:
          "id,collectionId,collectionName,title,image,tags,ingredients,ingredient_links,prep_minutes,cook_minutes,total_minutes,extra_times,source_url,created,site_rating",
      })
      .then(setAll)
      .catch((err) => setError(errorMessage(err)));
    // Stars and hearts are extras; the chooser works without them.
    recipeRatings()
      .getFullList({ fields: "id,recipe,user,stars,favorite" })
      .then(setRatings)
      .catch(() => {});
  }, []);

  const ratingsByRecipe = useMemo(() => {
    const map = new Map<string, RecipeRating[]>();
    for (const rating of ratings) map.set(rating.recipe, [...(map.get(rating.recipe) ?? []), rating]);
    return map;
  }, [ratings]);
  const isFavorite = (recipe: Recipe) =>
    (ratingsByRecipe.get(recipe.id) ?? []).some((r) => r.user === me?.id && r.favorite);

  const pantryItems = pantry.items;
  const checks = useMemo(
    () => new Map((all ?? []).map((recipe) => [recipe.id, pantryCheck(recipe, pantryItems ?? [])])),
    [all, pantryItems]
  );
  // "We have it": something in it is linked to the pantry, and nothing is out.
  const haveIt = (recipe: Recipe) => {
    const check = checks.get(recipe.id);
    return !!check && check.linked > 0 && check.out.length === 0;
  };

  // Recipes sharing a name, each with a line to tell it apart (recipeTwins).
  const twins = useMemo(() => twinLabels(all ?? []), [all]);

  const words = searchVariants(search);
  const shown = (all ?? []).filter(
    (recipe) =>
      matchesSearch(recipe, words) &&
      (!favoritesOnly || isFavorite(recipe)) &&
      (!quickOnly || isQuick(recipe, quickMinutes)) &&
      (!haveOnly || haveIt(recipe))
  );
  const suggested = shown.find((recipe) => recipe.id === suggestion);

  // Picks a random recipe from those shown, preferring ones that aren't
  // already planned, and never the one just suggested (if there's a choice).
  function surprise() {
    const others = shown.filter((recipe) => recipe.id !== suggestion);
    const unplanned = others.filter((recipe) => !upcoming.has(recipe.id));
    const pool = unplanned.length ? unplanned : others.length ? others : shown;
    if (!pool.length) return;
    setSuggestion(pool[Math.floor(Math.random() * pool.length)].id);
    const rolls = surprised.rolls + 1;
    setSurprised({ rolls, line: surpriseLine(rolls, { last: surprised.line || null, choices: shown.length }) });
  }

  // The small grey line under a recipe's name.
  function details(recipe: Recipe) {
    const time = formatMinutes(totalMinutes(recipe));
    const average = averageStars(ratingsByRecipe.get(recipe.id) ?? []);
    const out = checks.get(recipe.id)?.out ?? [];
    const planned = upcoming.get(recipe.id);
    const last = lastHad.get(recipe.id);
    // Whether anything comes before "Out of …", for its " · ".
    const lead = !!(time || twins.has(recipe.id) || average !== null || (recipe.site_rating && recipe.source_url));
    return (
      <span className="muted chooser-details">
        {/* Another recipe has this name: where this one's from first. */}
        {[twins.get(recipe.id), time].filter(Boolean).join(" · ")}
        {/* The household's onigiri, or until anyone rates it the site's ★. */}
        {average !== null ? (
          <span aria-label={`${average} of 5 onigiri`}>
            {time || twins.has(recipe.id) ? " · " : ""}
            <OnigiriIcon size={12} /> {average}
          </span>
        ) : (
          !!recipe.site_rating && !!recipe.source_url && (
            <span className="site-star" aria-label={`${recipe.site_rating} of 5 stars on its website`}>
              {time || twins.has(recipe.id) ? " · " : ""}★ {recipe.site_rating}
            </span>
          )
        )}
        {out.length > 0 && (
          <span className="chooser-out" title={`Out: ${out.map((item) => item.name).join(", ")}`}>
            {lead ? " · " : ""}
            {out.length === 1 ? `Out of ${out[0].name}` : `${out.length} things out`}
          </span>
        )}
        {planned ? (
          <span className="chooser-planned">
            {lead || out.length > 0 ? " · " : ""}Planned {formatDay(planned[0])}
          </span>
        ) : (
          last && <span>{lead || out.length > 0 ? " · " : ""}Had {timeAgo(last, localToday())}</span>
        )}
      </span>
    );
  }

  function photo(recipe: Recipe) {
    return recipe.image ? (
      <RecipePhoto recipe={recipe} size="card" loading="lazy" />
    ) : (
      <RecipeStandIn title={recipe.title} className="dinner-no-photo" />
    );
  }

  function title(recipe: Recipe) {
    return (
      <span className="chooser-title">
        {recipe.title}
        {isFavorite(recipe) && (
          <span className="chooser-heart" aria-label={spell("(a favourite)")}>
            <HeartIcon filled size={12} />
          </span>
        )}
      </span>
    );
  }

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="chooser-title"
      onClose={sheetClosed}
      // A tap on the dimmed area outside the panel lands on the dialog itself.
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="sheet-panel">
        <div className="sheet-head">
          <h2 id="chooser-title">
            {MEAL_NAMES[meal]} for {formatDay(date)}
          </h2>
          <button className="icon-button small" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        {/* Recipes first, the main job (docs/VISION.md, "The dinner
            chooser"): search and filters as one bento tray. Only once there
            are recipes to search. */}
        {all?.length !== 0 && (
          <>
            <div className="chooser-search">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search names, tags or ingredients"
                aria-label="Search recipes"
              />
              <div className="chooser-filters">
                <button aria-pressed={favoritesOnly} onClick={() => setFavoritesOnly(!favoritesOnly)}>
                  <HeartIcon filled={favoritesOnly} size={14} /> {spell("Favourites")}
                </button>
                <button aria-pressed={quickOnly} onClick={() => setQuickOnly(!quickOnly)}>
                  <ZapIcon filled={quickOnly} size={14} /> Quick
                </button>
                <button
                  aria-pressed={haveOnly}
                  onClick={() => setHaveOnly(!haveOnly)}
                  title="Recipes where nothing in the pantry is out"
                >
                  <span aria-hidden="true">🥕</span> We have it
                </button>
              </div>
            </div>
            <div className="chooser-tools">
              {/* Opens a pick; with one showing, puts it away again
                  (Another rolls again). */}
              <button
                className="button small"
                onClick={suggested ? () => setSuggestion(null) : surprise}
                disabled={!suggested && shown.length === 0}
                aria-expanded={!!suggested}
              >
                <span className="button-mark" aria-hidden="true">🎲</span> Surprise me
              </button>
              {all && <span className="muted chooser-count">{shown.length} recipes</span>}
            </div>
          </>
        )}

        {error && <p className="error">{error}</p>}
        {!all && !error && <p className="muted">The recipes are in here somewhere…</p>}
        {all && all.length === 0 && (
          <p className="muted">
            No recipes yet, so a note like “Toast again” will do for now. Recipes you add on the Recipes tab show up here.
          </p>
        )}
        {all && all.length > 0 && shown.length === 0 && (
          <p className="muted">No recipe for that one. Who says you need one? Add it as a note.</p>
        )}

        {/* The surprise: a plum tray, so it stands out from the jade ones,
            its line in the rim. */}
        {suggested && (
          <div className="suggestion" role="status">
            <p className="suggestion-label">{surprised.line || "How about…"}</p>
            <div className="suggestion-recipe">
              {photo(suggested)}
              <span className="chooser-text">
                {title(suggested)}
                {details(suggested)}
              </span>
            </div>
            <div className="suggestion-actions">
              <button className="button primary small" onClick={() => onPick(suggested)}>
                Plan this
              </button>
              <button className="button small" onClick={surprise} disabled={shown.length < 2}>
                <span aria-hidden="true">🎲</span> Another
              </button>
            </div>
          </div>
        )}

        {/* A tray of recipes, each a compartment; none when nothing
            matches (the line above says so). */}
        {shown.length > 0 && (
          <ul className="chooser-list">
            {shown.map((recipe) => (
              <li key={recipe.id}>
                <button onClick={() => onPick(recipe)}>
                  {photo(recipe)}
                  <span className="chooser-text">
                    {title(recipe)}
                    {details(recipe)}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* A note instead of a recipe, last: its own tray. */}
        <section className="chooser-note" aria-labelledby="chooser-note-title">
          <h3 id="chooser-note-title">Or just a note</h3>
          <form
            className="chooser-note-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (note.trim()) onNote(note.trim());
            }}
          >
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={100}
              placeholder="Write a note"
              aria-label={`Write a note for this ${meal} instead`}
            />
            <button className="button primary small" disabled={!note.trim()}>
              Add
            </button>
          </form>
          <div className="chooser-note-picks" role="group" aria-label="Quick notes">
            {NOTE_SUGGESTIONS.map((suggestion) => (
              <button key={suggestion} onClick={() => onNote(suggestion)}>
                {suggestion}
              </button>
            ))}
          </div>
        </section>
      </div>
    </dialog>
  );
}
