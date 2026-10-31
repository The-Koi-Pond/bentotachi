import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  averageStars,
  displayName,
  errorMessage,
  personStyle,
  recipeCategories,
  recipeRatings,
  recipes,
  useCurrentUser,
  useQuickMinutes,
  type Recipe,
  type RecipeCategory,
  type RecipeRating,
  type User,
} from "../pb";
import { formatMinutes, isQuick, totalMinutes } from "../format";
import QuickBadge from "../QuickBadge";
import { CheckIcon, GripIcon, HeartIcon, TagIcon, ThumbsDownIcon, ThumbsUpIcon, TrashIcon, ZapIcon } from "../icons";
import { matchesSearch, searchWords } from "../recipeSearch";
import { SORTS, sortRecipes, type SortOrder } from "../recipeSort";
import { isOffline, saveRatings, saveRecipes, savedRatings, savedRecipes } from "../offline";
import OfflineNote from "../OfflineNote";
import DrawerToggle from "../DrawerToggle";
import { OTHER, movedTo, shelves } from "../recipeCategories";
import { useShelfDrawers } from "../shelfDrawers";
import { forEveryone, useSingleUser } from "../household";
import RecipePhoto from "../RecipePhoto";
import { saveCategoryOrder } from "../categoryOrder";

// Where a dragged shelf would land: the shelf under the finger, else the
// nearest one (as on the dinner plan).
const shelfDropTarget: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  return underPointer.length > 0 ? underPointer : closestCenter(args);
};

// The chosen order is remembered on this device.
const SORT_KEY = "bento.recipeSort";

function savedSort(): SortOrder {
  try {
    const saved = localStorage.getItem(SORT_KEY);
    return SORTS.find((sort) => sort.value === saved)?.value ?? "title";
  } catch {
    return "title";
  }
}

// Delete mode (a bin on every card on screen) lives in the address
// ("#/?manage=1"), so the button in the top bar can switch it. Changing it
// keeps any chosen tags and the shelves or list being viewed.
export function useManageMode() {
  const [searchParams, setSearchParams] = useSearchParams();
  const managing = searchParams.has("manage");
  const setManaging = (on: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (on) next.set("manage", "1");
    else next.delete("manage");
    setSearchParams(next, { replace: true });
  };
  return [managing, setManaging] as const;
}

// Top-bar button, shown only on the recipe list: a bin, or a tick
// ("Done") while deleting.
export function ManageButton() {
  const [managing, setManaging] = useManageMode();
  const label = managing ? "Done deleting" : "Delete recipes";
  return (
    <button
      className={`icon-button ${managing ? "primary" : ""}`}
      onClick={() => setManaging(!managing)}
      aria-label={label}
      aria-pressed={managing}
      title={label}
    >
      {managing ? <CheckIcon size={24} /> : <TrashIcon />}
    </button>
  );
}

export default function RecipeList() {
  const [all, setAll] = useState<Recipe[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [managing] = useManageMode();
  // The recipe being deleted right now, if any.
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Chosen tags live in the address too ("#/?tag=quick&tag=japanese"), so
  // links from a recipe's tags and the back button both keep the filter.
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTags = searchParams.getAll("tag");
  // Tags to leave out ("#/?not=spicy"): recipes with any of them are hidden.
  const excludedTags = searchParams.getAll("not");
  // Who added it, as a person's id ("#/?by=…"): filters like a tag does.
  const selectedBy = searchParams.get("by");
  const filtering = selectedTags.length > 0 || excludedTags.length > 0 || !!selectedBy;
  // "#/?list=1": every recipe as one list instead of shelves.
  const listChosen = searchParams.has("list");
  const favoritesOnly = searchParams.has("fav");
  const quickOnly = searchParams.has("quick");
  const [tagsOpen, setTagsOpen] = useState(false);
  // What tapping a tag in the panel does: show only recipes with it, or
  // hide the ones with it.
  const [tagMode, setTagMode] = useState<"with" | "without">("with");
  const me = useCurrentUser();
  const quickMinutes = useQuickMinutes();
  const [ratings, setRatings] = useState<RecipeRating[]>([]);
  const [sort, setSort] = useState<SortOrder>(savedSort);
  // Showing the phone's saved copy because the server can't be reached.
  const [offline, setOffline] = useState(false);
  // The household's categories (shelves); null until loaded, or if they
  // can't be (offline, or an older server), which shows the plain list.
  const [categories, setCategories] = useState<RecipeCategory[] | null>(null);
  const drawers = useShelfDrawers();
  const singleUser = useSingleUser();
  // Dragging shelves into a new order: by the grip (a small move starts
  // it, so taps still open drawers), or the keyboard (Space, arrows, Space).
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }), useSensor(KeyboardSensor));
  const [draggingShelf, setDraggingShelf] = useState<string | null>(null);
  const [shelfError, setShelfError] = useState("");

  // A shelf dragged onto another takes its place, for the whole household.
  // Shown straight away; put back if the server says no.
  async function moveShelf(fromId: string, toId: string) {
    if (!categories) return;
    const before = categories;
    const order = movedTo(categories, fromId, toId);
    if (order.every((category) => before.find((c) => c.id === category.id)?.position === category.position)) return;
    setShelfError("");
    setCategories(order);
    try {
      setCategories(await saveCategoryOrder(order, before));
    } catch (err) {
      setCategories(before);
      setShelfError(`Couldn't move the shelf: ${errorMessage(err)}`);
    }
  }

  function changeSort(next: SortOrder) {
    setSort(next);
    try {
      localStorage.setItem(SORT_KEY, next);
    } catch {
      // Not remembered; it starts A–Z next time.
    }
  }

  useEffect(() => {
    recipes()
      .getFullList({ sort: "title", expand: "added_by" })
      .then((list) => {
        setAll(list);
        saveRecipes(list);
      })
      .catch((err) => {
        // No connection: show the copy kept on this phone, if there is one.
        const saved = isOffline(err) ? savedRecipes() : null;
        if (saved) {
          setAll(saved);
          setRatings(savedRatings());
          setOffline(true);
        } else setError(errorMessage(err));
      });
    // Ratings are extras on the cards; the list still works without them.
    recipeRatings()
      .getFullList({ fields: "id,recipe,user,stars,favorite,approved,disliked" })
      .then((list) => {
        setRatings(list);
        saveRatings(list);
      })
      .catch(() => {});
    recipeCategories()
      .getFullList()
      .then(setCategories)
      .catch(() => {});
  }, []);

  // Per recipe: everyone's ratings, the average, and whether it's your favorite.
  const ratingsByRecipe = useMemo(() => {
    const map = new Map<string, RecipeRating[]>();
    for (const rating of ratings) map.set(rating.recipe, [...(map.get(rating.recipe) ?? []), rating]);
    return map;
  }, [ratings]);
  const myRating = (recipe: Recipe) => (ratingsByRecipe.get(recipe.id) ?? []).find((r) => r.user === me?.id);
  const isMyFavorite = (recipe: Recipe) => myRating(recipe)?.favorite ?? false;

  // The heart on a card: flips your favorite straight away, and undoes it if
  // the server says no.
  async function toggleFavorite(recipe: Recipe) {
    if (!me) return;
    const mine = myRating(recipe);
    const favorite = !mine?.favorite;
    const before = ratings;
    const draft = { ...(mine ?? { id: "", recipe: recipe.id, user: me.id, stars: 0, approved: false }), favorite } as RecipeRating;
    setRatings([...ratings.filter((r) => r !== mine), draft]);
    try {
      const saved = mine
        ? await recipeRatings().update(mine.id, { favorite })
        : await recipeRatings().create({ recipe: recipe.id, user: me.id, stars: 0, favorite, approved: false });
      setRatings((current) => [...current.filter((r) => !(r.recipe === recipe.id && r.user === me.id)), saved]);
    } catch (err) {
      setRatings(before);
      setError(errorMessage(err));
    }
  }

  // Entering or leaving delete mode clears an old error.
  useEffect(() => {
    setError("");
  }, [managing]);

  // A recipe must match every typed word, have every chosen tag and none of
  // the left-out ones, be added by the chosen person, and be quick and/or
  // one of your favorites if those are switched on.
  const words = searchWords(search);
  const matching = (all ?? []).filter(
    (recipe) =>
      matchesSearch(recipe, words) &&
      selectedTags.every((tag) => (recipe.tags ?? []).includes(tag)) &&
      !excludedTags.some((tag) => (recipe.tags ?? []).includes(tag)) &&
      (!selectedBy || recipe.added_by === selectedBy) &&
      (!quickOnly || isQuick(recipe, quickMinutes)) &&
      (!favoritesOnly || isMyFavorite(recipe))
  );
  const shown = sortRecipes(matching, sort, (recipe) => {
    const theirs = ratingsByRecipe.get(recipe.id) ?? [];
    return { stars: averageStars(theirs), thumbs: theirs.filter((r) => r.approved).length };
  });

  // The ⚡ and ♥ filters live in the address like tags ("#/?quick=1&fav=1").
  function toggleParam(name: "fav" | "quick") {
    const next = new URLSearchParams(searchParams);
    if (next.has(name)) next.delete(name);
    else next.set(name, "1");
    setSearchParams(next, { replace: true });
  }

  // Every tag in use, most-used first.
  const allTags = useMemo(() => {
    const totals = new Map<string, number>();
    for (const recipe of all ?? []) for (const tag of recipe.tags ?? []) totals.set(tag, (totals.get(tag) ?? 0) + 1);
    return [...totals.entries()].sort(([a, x], [b, y]) => y - x || a.localeCompare(b)).map(([tag]) => tag);
  }, [all]);

  // Everyone who has added a recipe, by name. The "Added by" filter shows
  // once there are two of them.
  const people = useMemo(() => {
    const byId = new Map<string, User>();
    for (const recipe of all ?? []) if (recipe.expand?.added_by) byId.set(recipe.added_by, recipe.expand.added_by);
    return [...byId.values()].sort((a, b) => displayName(a).localeCompare(displayName(b)));
  }, [all]);
  const selectedPerson = people.find((person) => person.id === selectedBy);

  // How many of the recipes on screen have each tag, or were added by each
  // person, i.e. what tapping it would leave.
  const shownTagCounts = new Map<string, number>();
  for (const recipe of shown) for (const tag of recipe.tags ?? []) shownTagCounts.set(tag, (shownTagCounts.get(tag) ?? 0) + 1);
  const shownByCounts = new Map<string, number>();
  for (const recipe of shown) if (recipe.added_by) shownByCounts.set(recipe.added_by, (shownByCounts.get(recipe.added_by) ?? 0) + 1);

  function setTags(tags: string[], by = selectedBy) {
    // Keep other settings in the address (like delete mode).
    const next = new URLSearchParams(searchParams);
    next.delete("tag");
    for (const tag of tags) next.append("tag", tag);
    if (by) next.set("by", by);
    else next.delete("by");
    setSearchParams(next, { replace: true });
  }

  function setExcluded(tags: string[]) {
    const next = new URLSearchParams(searchParams);
    next.delete("not");
    for (const tag of tags) next.append("not", tag);
    setSearchParams(next, { replace: true });
  }

  // Back to everything (or the shelves): no tags, left-out tags or person.
  function clearFilters() {
    const next = new URLSearchParams(searchParams);
    for (const name of ["tag", "not", "by"]) next.delete(name);
    setSearchParams(next, { replace: true });
  }

  function showShelvesAgain() {
    const next = new URLSearchParams(searchParams);
    next.delete("list");
    setSearchParams(next);
  }

  function toggleBy(personId: string) {
    setTags(selectedTags, selectedBy === personId ? null : personId);
  }

  function toggleTag(tag: string) {
    setTags(selectedTags.includes(tag) ? selectedTags.filter((t) => t !== tag) : [...selectedTags, tag]);
  }

  function toggleExcluded(tag: string) {
    setExcluded(excludedTags.includes(tag) ? excludedTags.filter((t) => t !== tag) : [...excludedTags, tag]);
  }

  async function deleteRecipe(recipe: Recipe) {
    if (!window.confirm(`Delete “${recipe.title}”${forEveryone(singleUser)}? This can't be undone.`)) return;
    setDeletingId(recipe.id);
    setError("");
    try {
      await recipes().delete(recipe.id);
      setAll((previous) => (previous ?? []).filter((r) => r.id !== recipe.id));
    } catch (err) {
      setError(`Couldn't delete “${recipe.title}”: ${errorMessage(err)}`);
    }
    setDeletingId(null);
  }

  if (!all) return error ? <p className="error">{error}</p> : <p className="muted">Loading recipes…</p>;

  if (all.length === 0) {
    return (
      <div className="empty card stack">
        <h2>No recipes yet</h2>
        <p>Add your first one from a link, or type it in by hand.</p>
        <Link to="/add" className="button primary">
          + Add recipe
        </Link>
      </div>
    );
  }

  // One recipe's card, in the list or on a shelf.
  function tile(recipe: Recipe) {
    const card = (
      <>
        <span className="card-photo">
          {recipe.image && !offline ? (
            <RecipePhoto recipe={recipe} size="card" loading="lazy" />
          ) : (
            <span className="no-photo" aria-hidden="true">
              🍲
            </span>
          )}
          {isQuick(recipe, quickMinutes) && <QuickBadge />}
        </span>
        <span className="recipe-card-text">
          <strong title={recipe.title}>{recipe.title}</strong>
          <CardDetails recipe={recipe} ratings={ratingsByRecipe.get(recipe.id) ?? []} />
        </span>
      </>
    );
    return (
      <li key={recipe.id} className="recipe-tile">
        {/* Sit over the photo, beside the card's link rather than inside it:
            the heart, or in delete mode, the bin. */}
        {managing ? (
          <button
            className="delete-toggle"
            aria-label={`Delete ${recipe.title}`}
            title="Delete"
            disabled={deletingId !== null}
            onClick={() => void deleteRecipe(recipe)}
          >
            <TrashIcon size={16} />
          </button>
        ) : (
          <button
            className="heart-toggle on-photo small"
            aria-pressed={isMyFavorite(recipe)}
            aria-label={`Favorite ${recipe.title}`}
            onClick={() => void toggleFavorite(recipe)}
          >
            <HeartIcon filled={isMyFavorite(recipe)} size={16} />
          </button>
        )}
        <Link to={`/recipes/${recipe.id}`} className={`recipe-card ${deletingId === recipe.id ? "deleting" : ""}`}>
          {card}
        </Link>
      </li>
    );
  }

  // Shelves are the start page: no search or filter yet.
  const showShelves =
    !!categories?.length && !offline && !listChosen && !search.trim() && !filtering && !favoritesOnly && !quickOnly;

  return (
    <div className="stack">
      <div className="toolbar">
        <input
          type="search"
          className="search"
          placeholder="Search recipes"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search recipes"
        />
        {(allTags.length > 0 || people.length > 1) && (
          <button
            className={`button tags-button ${tagsOpen ? "primary" : ""}`}
            aria-expanded={tagsOpen}
            aria-controls="tag-panel"
            aria-label="Filter by tag or who added it"
            title="Filter by tag or who added it"
            onClick={() => setTagsOpen((open) => !open)}
          >
            <TagIcon size={20} />
          </button>
        )}
        <button
          className={`button quick-button ${quickOnly ? "primary" : ""}`}
          aria-pressed={quickOnly}
          aria-label={`Show only quick recipes (${quickMinutes} min or less)`}
          title={`Show only quick recipes (${quickMinutes} min or less)`}
          onClick={() => toggleParam("quick")}
        >
          <ZapIcon filled={quickOnly} />
        </button>
        <button
          className={`button favorites-button ${favoritesOnly ? "primary" : ""}`}
          aria-pressed={favoritesOnly}
          aria-label="Show only my favorites"
          title="Show only my favorites"
          onClick={() => toggleParam("fav")}
        >
          <HeartIcon filled={favoritesOnly} />
        </button>
      </div>
      {filtering && (
        <div className="tag-bar">
          {selectedBy && (
            <button
              className="tag-chip selected person-chip"
              style={personStyle(selectedPerson)}
              onClick={() => toggleBy(selectedBy)}
              aria-label={`Stop filtering by who added it (${selectedPerson ? displayName(selectedPerson) : "someone"})`}
            >
              Added by {selectedPerson ? displayName(selectedPerson) : "someone"} <span aria-hidden="true">×</span>
            </button>
          )}
          {selectedTags.map((tag) => (
            <button key={tag} className="tag-chip selected" onClick={() => toggleTag(tag)} aria-label={`Stop filtering by ${tag}`}>
              {tag} <span aria-hidden="true">×</span>
            </button>
          ))}
          {excludedTags.map((tag) => (
            <button key={tag} className="tag-chip excluded" onClick={() => toggleExcluded(tag)} aria-label={`Stop leaving out ${tag}`}>
              <span className="tag-without">without</span> {tag} <span aria-hidden="true">×</span>
            </button>
          ))}
          <button className="link-button" onClick={clearFilters}>
            Clear
          </button>
        </div>
      )}
      {tagsOpen && (
        <div id="tag-panel" className="tag-panel" role="group" aria-label="Filter by tag or who added it">
          <div className="tag-panel-mode">
            <span className="muted tag-panel-label">Show recipes</span>
            <div className="view-switch" role="group" aria-label="What tapping a tag does">
              <button aria-pressed={tagMode === "with"} onClick={() => setTagMode("with")}>
                With
              </button>
              <button aria-pressed={tagMode === "without"} onClick={() => setTagMode("without")}>
                Without
              </button>
            </div>
          </div>
          {tagMode === "with" && people.length > 1 && !selectedBy && (
            <div className="tag-panel-people" role="group" aria-label="Added by">
              <span className="muted tag-panel-label">Added by</span>
              {people.map((person) => {
                const count = shownByCounts.get(person.id) ?? 0;
                return (
                  <button
                    key={person.id}
                    className="tag-chip person-chip"
                    style={personStyle(person)}
                    disabled={count === 0}
                    onClick={() => toggleBy(person.id)}
                  >
                    {displayName(person)} <span className="tag-count">{count}</span>
                  </button>
                );
              })}
            </div>
          )}
          {allTags
            .filter((tag) => !selectedTags.includes(tag) && !excludedTags.includes(tag))
            .map((tag) => {
              // With: how many tapping it would leave. Without: how many it would hide.
              const count = shownTagCounts.get(tag) ?? 0;
              return (
                <button
                  key={tag}
                  className="tag-chip"
                  disabled={count === 0}
                  onClick={() => (tagMode === "with" ? toggleTag(tag) : toggleExcluded(tag))}
                  aria-label={tagMode === "without" ? `Leave out ${tag} (${count})` : undefined}
                >
                  {tag} <span className="tag-count">{count}</span>
                </button>
              );
            })}
        </div>
      )}

      <div className="list-options">
        <span className="muted">
          {shown.length} {shown.length === 1 ? "recipe" : "recipes"}
        </span>
        {/* Between the count and Sort: switching between shelves and one
            list, and the categories. */}
        <span className="list-options-links">
          {showShelves && (
            <>
              <Link to={{ search: "?list=1" }} className="list-options-link">
                One list
              </Link>
              <span aria-hidden="true">·</span>
              <Link to="/categories" className="list-options-link" aria-label="Edit categories">
                Categories
              </Link>
            </>
          )}
          {listChosen && !!categories?.length && (
            <button className="link-button list-options-link" onClick={showShelvesAgain}>
              Show shelves
            </button>
          )}
          {categories?.length === 0 && !managing && (
            <Link to="/categories" className="list-options-link">
              Make categories
            </Link>
          )}
        </span>
        <label className="sort-picker">
          <span className="muted">Sort</span>
          <select value={sort} onChange={(e) => changeSort(e.target.value as SortOrder)}>
            {SORTS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {offline && <OfflineNote />}
      {managing && <p className="muted">Tap the bin on a recipe to delete it. Tap ✓ at the top when you're done.</p>}
      {managing && error && <p className="error">{error}</p>}
      {shown.length === 0 && (
        <p className="muted">
          {favoritesOnly && !quickOnly && !search.trim() && !filtering
            ? "No favorites yet. Tap the ♥ on a recipe to add it here."
            : quickOnly && !favoritesOnly && !search.trim() && !filtering
              ? `No recipes take ${quickMinutes} minutes or less. You can change what counts as quick in the ⋮ menu.`
              : search.trim()
                ? `Nothing matches “${search.trim()}”${filtering || favoritesOnly || quickOnly ? " with those filters." : "."}`
                : "Nothing matches all of those filters."}
        </p>
      )}

      {showShelves ? (
        <DndContext
          sensors={sensors}
          collisionDetection={shelfDropTarget}
          onDragStart={(event) => setDraggingShelf(String(event.active.id))}
          onDragEnd={(event) => {
            setDraggingShelf(null);
            if (event.over) void moveShelf(String(event.active.id), String(event.over.id));
          }}
          onDragCancel={() => setDraggingShelf(null)}
        >
          {shelfError && <p className="error">{shelfError}</p>}
          {shelves(shown, categories!).map((shelf) => (
            <Shelf
              key={shelf.id}
              id={shelf.id}
              name={shelf.name}
              count={shelf.recipes.length}
              open={drawers.isOpen(shelf.id)}
              onToggle={() => drawers.toggle(shelf.id)}
              // "Everything else" always comes last.
              movable={shelf.id !== OTHER}
            >
              {shelf.recipes.length ? (
                <ul className="recipe-grid">{shelf.recipes.map((recipe) => tile(recipe))}</ul>
              ) : (
                <p className="muted shelf-empty">
                  {shelf.category?.tags?.length
                    ? `Nothing yet. Tag a recipe “${shelf.category.tags[0]}” to put it here.`
                    : "Nothing yet. Choose its tags in Categories."}
                </p>
              )}
            </Shelf>
          ))}
          {/* What follows the finger while dragging: just the shelf's name. */}
          <DragOverlay>
            {draggingShelf && (
              <div className="shelf-lifted">
                <GripIcon />
                {categories?.find((c) => c.id === draggingShelf)?.name}
              </div>
            )}
          </DragOverlay>
        </DndContext>
      ) : (
        <ul className="recipe-grid">{shown.map((recipe) => tile(recipe))}</ul>
      )}

      {!managing && error && <p className="error">{error}</p>}
    </div>
  );
}

// One shelf: a drawer of recipes with its name and count. A grip before the
// name drags it onto another shelf to swap places (not "Everything else",
// which stays last); the shelf it would land on is outlined.
function Shelf({
  id,
  name,
  count,
  open,
  onToggle,
  movable,
  children,
}: {
  id: string;
  name: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  movable: boolean;
  children: ReactNode;
}) {
  const drag = useDraggable({ id, disabled: !movable });
  const drop = useDroppable({ id, disabled: !movable });
  const classes = ["shelf", drag.isDragging ? "dragging" : "", drop.isOver && !drag.isDragging ? "drop-here" : ""];
  return (
    <section ref={drop.setNodeRef} className={classes.join(" ")}>
      <div className="shelf-head" ref={drag.setNodeRef}>
        {movable ? (
          <button className="drag-handle shelf-handle" aria-label={`Move the ${name} shelf`} title="Drag to move" {...drag.attributes} {...drag.listeners}>
            <GripIcon />
          </button>
        ) : (
          <span className="shelf-handle-space" aria-hidden="true" />
        )}
        <h2>
          <DrawerToggle open={open} onToggle={onToggle} className="shelf-toggle">
            <span className="drawer-label">{name}</span>
            <span className="drawer-counts muted">{count}</span>
          </DrawerToggle>
        </h2>
      </div>
      {open && children}
    </section>
  );
}

// The small line under a card's name: time, average stars, and a tiny
// thumbs up if anyone has given it one.
function CardDetails({ recipe, ratings }: { recipe: Recipe; ratings: RecipeRating[] }) {
  const time = formatMinutes(totalMinutes(recipe));
  const average = averageStars(ratings);
  const thumbsUp = ratings.some((r) => r.approved);
  const thumbsDown = ratings.some((r) => r.disliked);
  if (!time && average === null && !thumbsUp && !thumbsDown) return null;
  return (
    <span className="card-details muted">
      {time && <span>{time}</span>}
      {average !== null && (
        <span aria-label={`${average} stars`}>
          <span className="star-gold">★</span>
          {average}
        </span>
      )}
      {thumbsUp && (
        <span className="card-thumb" role="img" aria-label="Has a thumbs up" title="Has a thumbs up">
          <ThumbsUpIcon filled size={12} />
        </span>
      )}
      {thumbsDown && (
        <span className="card-thumb down" role="img" aria-label="Has a thumbs down" title="Someone gave it a thumbs down">
          <ThumbsDownIcon filled size={12} />
        </span>
      )}
    </span>
  );
}
