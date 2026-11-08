import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
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
import QuickTime from "../QuickTime";
import {
  BigCardsIcon,
  CheckIcon,
  ChevronIcon,
  GripIcon,
  HeartIcon,
  ListIcon,
  OnigiriIcon,
  PencilIcon,
  SlidersIcon,
  SmallCardsIcon,
  TagIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  ZapIcon,
} from "../icons";
import { matchesSearch, searchWords } from "../recipeSearch";
import { SORTS, sortRecipes, type SortOrder } from "../recipeSort";
import { isOffline, saveRatings, saveRecipes, savedRatings, savedRecipes } from "../offline";
import OfflineNote from "../OfflineNote";
import DrawerToggle from "../DrawerToggle";
import { OTHER, inCategory, movedTo, puttingOn, shelves, sortCategories, takingOff } from "../recipeCategories";
import { useShelfDrawers } from "../shelfDrawers";
import { HelpBox, HelpButton, useHelp } from "../Help";
import { useSingleUser, useSpell } from "../household";
import RecipePhoto from "../RecipePhoto";
import { saveCategoryOrder } from "../categoryOrder";
import { sourceLines } from "../recipeTwins";
import { confirmDelete, deleteRecipes } from "../recipeDeletion";
import BackupNudge from "../BackupNudge";
import { BenMood } from "../Brand";
import { ensureLogin } from "../session";

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

// How the cards are shown, remembered on this device too: small cards
// (three across on a phone), big ones (two across) or a list.
type CardLayout = "small" | "big" | "list";
const LAYOUT_KEY = "bento.recipeLayout";
const LAYOUTS: { value: CardLayout; label: string; icon: React.JSX.Element }[] = [
  { value: "small", label: "Small", icon: <SmallCardsIcon /> },
  { value: "big", label: "Big", icon: <BigCardsIcon /> },
  { value: "list", label: "List", icon: <ListIcon /> },
];

function savedLayout(): CardLayout {
  try {
    const saved = localStorage.getItem(LAYOUT_KEY);
    return LAYOUTS.find((layout) => layout.value === saved)?.value ?? "small";
  } catch {
    return "small";
  }
}

// Edit mode: tidying the collection. Tapping cards picks
// them for the bar at the bottom ("Put on a shelf", "Delete"), and shelves
// show their grips (drag to reorder) and "Edit shelf". Everything else
// about a single recipe is on its own page. Lives in the address
// ("#/?edit=1"), keeping any chosen tags and the shelves or list being viewed.
function useEditMode() {
  const [searchParams, setSearchParams] = useSearchParams();
  const editing = searchParams.has("edit");
  const setEditing = (on: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (on) next.set("edit", "1");
    else next.delete("edit");
    setSearchParams(next, { replace: true });
  };
  return [editing, setEditing] as const;
}

export default function RecipeList() {
  const [all, setAll] = useState<Recipe[] | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useEditMode();
  // Edit mode: the recipes picked, by id; what the bar is doing; whether it
  // shows the shelves to put them on; and what the last action did.
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  const [working, setWorking] = useState(false);
  const [choosingShelf, setChoosingShelf] = useState(false);
  const [done, setDone] = useState("");
  // After putting recipes on a shelf or taking them off: each changed
  // recipe's tags from before, for the Undo next to the message.
  const [undoTags, setUndoTags] = useState<Map<string, string[]> | null>(null);
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
  // The View panel: the cards' size, the order, shelves or one list, Edit.
  const [viewOpen, setViewOpen] = useState(false);
  const shelfHelp = useHelp();
  const spell = useSpell();
  const navigate = useNavigate();
  // What tapping a tag in the panel does: show only recipes with it, or
  // hide the ones with it.
  const [tagMode, setTagMode] = useState<"with" | "without">("with");
  const me = useCurrentUser();
  const quickMinutes = useQuickMinutes();
  const [ratings, setRatings] = useState<RecipeRating[]>([]);
  const [sort, setSort] = useState<SortOrder>(savedSort);
  const [layout, setLayout] = useState<CardLayout>(savedLayout);
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

  function changeLayout(next: CardLayout) {
    setLayout(next);
    try {
      localStorage.setItem(LAYOUT_KEY, next);
    } catch {
      // Not remembered; it starts with small cards next time.
    }
  }

  const gridClass = `recipe-grid ${layout === "small" ? "" : layout}`;

  useEffect(() => {
    // The login first: with an expired one the server answers with no
    // recipes, which would replace the copy kept on this phone (session.ts).
    void ensureLogin()
      .then((state) => (state === "signedOut" ? null : recipes().getFullList({ sort: "title", expand: "added_by" })))
      .then((list) => {
        if (!list) return;
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
    // (After the same login check: ensureLogin asks the server only once.)
    void ensureLogin()
      .then((state) =>
        state === "signedOut" ? null : recipeRatings().getFullList({ fields: "id,recipe,user,stars,favorite,approved,disliked" })
      )
      .then((list) => {
        if (!list) return;
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

  // Entering or leaving Edit mode starts afresh: nothing picked, no old
  // error or message.
  useEffect(() => {
    setError("");
    setDone("");
    setUndoTags(null);
    setPicked(new Set());
    setChoosingShelf(false);
  }, [editing]);

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

  // Each card's source line: its site, "home recipe", or what tells it
  // apart from a recipe of the same name (recipeTwins).
  const sources = useMemo(() => sourceLines(all ?? []), [all]);

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

  function togglePicked(id: string) {
    setDone("");
    setUndoTags(null);
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // The picked recipes still matching the search and filters (a search or
  // filter may hide some, and the bar leaves those alone). Ones in a closed
  // drawer still count, so the Delete question names them.
  const pickedRecipes = (list: Recipe[]) => list.filter((recipe) => picked.has(recipe.id));
  const quoted = (titles: string[]) => titles.map((title) => `“${title}”`).join(", ");
  // The server's reason as a sentence, so the next one can follow it.
  const reasonOf = (err: unknown) => {
    const text = errorMessage(err);
    return /[.?!]$/.test(text) ? text : `${text}.`;
  };

  async function deletePicked(list: Recipe[]) {
    // Busy from the first tap, while the question's counts load, so a second
    // tap can't ask (and delete) twice.
    setWorking(true);
    setError("");
    setDone("");
    setUndoTags(null);
    if (!(await confirmDelete(list, singleUser))) return setWorking(false);
    const { deleted, failed } = await deleteRecipes(list);
    const gone = new Set(deleted);
    setAll((previous) => (previous ?? []).filter((r) => !gone.has(r.id)));
    setPicked(new Set(failed.length ? list.filter((r) => !gone.has(r.id)).map((r) => r.id) : []));
    if (deleted.length) setDone(deleted.length === 1 ? "Deleted 1 recipe." : `Deleted ${deleted.length} recipes.`);
    if (failed.length) {
      setError(
        `Couldn't delete ${quoted(failed.map((f) => f.title))}: ${reasonOf(failed[0].reason)} Still picked, so you can try again.`
      );
    }
    setWorking(false);
  }

  // Puts the picked recipes on a shelf by adding its first tag, or takes
  // them off (removing every tag that counts for it), like "Put on a shelf"
  // in the recipe form. `takeOff` is what the tapped chip showed. Each
  // recipe's tags are read fresh first, so a housemate's change made since
  // this page loaded isn't saved over. Undo puts the old tags back.
  async function shelvePicked(list: Recipe[], category: RecipeCategory, takeOff: boolean) {
    setWorking(true);
    setError("");
    setDone("");
    setUndoTags(null);
    const changed = new Map<string, Recipe>();
    const before = new Map<string, string[]>();
    const failed: { recipe: Recipe; reason: unknown }[] = [];
    for (const recipe of list) {
      try {
        const { tags: current } = await recipes().getOne(recipe.id, { fields: "id,tags" });
        const tags = takeOff ? takingOff(current, category) : puttingOn(current, category);
        if (tags.length === (current ?? []).length) continue;
        changed.set(recipe.id, await recipes().update(recipe.id, { tags }, { expand: "added_by" }));
        before.set(recipe.id, current ?? []);
      } catch (reason) {
        failed.push({ recipe, reason });
      }
    }
    setAll((previous) => (previous ?? []).map((r) => changed.get(r.id) ?? r));
    // After a failure only the failed ones stay picked, so trying again acts
    // on just them; otherwise they all stay, ready for another shelf.
    if (failed.length) setPicked(new Set(failed.map((f) => f.recipe.id)));
    const count = changed.size === 1 ? "1 recipe" : `${changed.size} recipes`;
    if (changed.size) {
      // Taking off removes tags another shelf may share: say which shelves
      // they left too.
      const alsoLeft = takeOff
        ? (categories ?? []).filter(
            (other) =>
              other.id !== category.id &&
              [...changed.values()].some((r) => inCategory({ tags: before.get(r.id) ?? [] }, other) && !inCategory(r, other))
          )
        : [];
      const also = alsoLeft.length
        ? ` ${changed.size === 1 ? "It" : "They"} left ${alsoLeft.map((c) => c.name).join(" and ")} too (same tags).`
        : "";
      setDone(takeOff ? `Took ${count} off ${category.name}.${also}` : `Put ${count} on ${category.name}.`);
      setUndoTags(before);
    } else if (!failed.length) {
      setDone(takeOff ? `None of them are on ${category.name}.` : `They're all on ${category.name} already.`);
    }
    if (failed.length) {
      setError(
        `Couldn't change ${quoted(failed.map((f) => f.recipe.title))}: ${reasonOf(failed[0].reason)} Still picked, so you can try again.`
      );
    } else setChoosingShelf(false);
    setWorking(false);
  }

  // Undo after shelving: each changed recipe gets its tags from before back.
  async function undoShelving() {
    if (!undoTags) return;
    setWorking(true);
    setError("");
    const restored = new Map<string, Recipe>();
    const failed: string[] = [];
    let reason: unknown = null;
    for (const [id, tags] of undoTags) {
      try {
        restored.set(id, await recipes().update(id, { tags }, { expand: "added_by" }));
      } catch (err) {
        failed.push(all?.find((r) => r.id === id)?.title ?? id);
        reason = err;
      }
    }
    setAll((previous) => (previous ?? []).map((r) => restored.get(r.id) ?? r));
    setUndoTags(null);
    setDone(restored.size === 1 ? "Put back as it was." : restored.size ? "Put back as they were." : "");
    if (failed.length) setError(`Couldn't put back ${quoted(failed)}: ${reasonOf(reason)} Change their tags on the recipe instead.`);
    setWorking(false);
  }

  if (!all) return error ? <p className="error">{error}</p> : <p className="muted">Loading recipes…</p>;

  if (all.length === 0) {
    return (
      <div className="empty card stack">
        <BenMood mood="ready" />
        <h2>No recipes yet</h2>
        <p>Add your first one from a link, or type it in by hand. Chopsticks at the ready.</p>
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
        </span>
        <span className="recipe-card-text">
          <strong title={recipe.title}>{recipe.title}</strong>
          {/* Where it's from, so a recipe is easy to find without opening
              several; see recipeTwins.ts. */}
          <span className="card-source muted">{sources.get(recipe.id)}</span>
          <CardDetails
            recipe={recipe}
            ratings={ratingsByRecipe.get(recipe.id) ?? []}
            quick={isQuick(recipe, quickMinutes)}
          />
        </span>
      </>
    );
    // Edit mode: the whole card picks it (a tick in the heart's corner shows
    // it's picked), instead of opening it.
    if (editing) {
      const on = picked.has(recipe.id);
      return (
        <li key={recipe.id} className={`recipe-tile ${on ? "picked" : ""}`}>
          <span className="pick-mark" aria-hidden="true">
            {on && <CheckIcon size={18} />}
          </span>
          <button className="recipe-card" aria-pressed={on} aria-label={`Pick ${recipe.title}`} onClick={() => togglePicked(recipe.id)} disabled={working}>
            {card}
          </button>
        </li>
      );
    }
    return (
      <li key={recipe.id} className="recipe-tile">
        {/* Your favourites wear a heart: a badge, not a
            button. A row of empty hearts was clutter; favouriting is on the
            recipe's own page. */}
        {isMyFavorite(recipe) && (
          <span className="favorite-badge" role="img" aria-label={spell("Your favourite")} title={spell("Your favourite")}>
            <HeartIcon filled size={14} />
          </span>
        )}
        <Link to={`/recipes/${recipe.id}`} className="recipe-card">
          {card}
        </Link>
      </li>
    );
  }

  // Shelves are the start page: no search or filter yet.
  const showShelves =
    !!categories?.length && !offline && !listChosen && !search.trim() && !filtering && !favoritesOnly && !quickOnly;
  const allShelves = showShelves ? shelves(shown, categories!) : [];
  const filledShelves = allShelves.filter((shelf) => shelf.recipes.length > 0);
  const anyShelfOpen = filledShelves.some((shelf) => drawers.isOpen(shelf.id));
  const emptyShelves = allShelves.filter((shelf) => shelf.recipes.length === 0);
  const pickedNow = editing ? pickedRecipes(shown) : [];
  // Shelves recipes can be put on: those with a tag to add.
  const shelfChoices = sortCategories(categories ?? []).filter((category) => (category.tags ?? []).length > 0);

  return (
    <div className={`stack ${editing ? "editing" : ""}`}>
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
          aria-label={spell("Show only my favourites")}
          title={spell("Show only my favourites")}
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
        <span className="list-options-links">
          <span className="muted">
            {shown.length} {shown.length === 1 ? "recipe" : "recipes"}
          </span>
          {/* Every shelf shut or open at once. */}
          {showShelves && !editing && filledShelves.length > 1 && (
            <>
              <span aria-hidden="true">·</span>
              <button
                className="link-button list-options-link"
                onClick={() => drawers.setAll(filledShelves.map((shelf) => shelf.id), !anyShelfOpen)}
              >
                {anyShelfOpen ? "Close all shelves" : "Open all shelves"}
              </button>
            </>
          )}
        </span>
        {/* The rest, used now and then, behind one button: the cards' size, the order, shelves or one list,
            and Edit. */}
        <button
          className={`button small view-options-button ${viewOpen ? "primary" : ""}`}
          aria-expanded={viewOpen}
          aria-controls="view-panel"
          onClick={() => setViewOpen((open) => !open)}
        >
          <SlidersIcon size={16} /> View
        </button>
      </div>
      {viewOpen && (
        <div id="view-panel" className="view-panel" role="group" aria-label="View">
          {/* A settings list: each row's name on the left, its control on
              the right, lines between (Xel: the first try looked sloppy). */}
          <div className="view-panel-row">
            <span className="view-panel-label">Show as</span>
            <span className="view-switch" role="group" aria-label="Show recipes as">
              {LAYOUTS.map((option) => (
                <button key={option.value} aria-pressed={layout === option.value} onClick={() => changeLayout(option.value)}>
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </span>
          </div>
          <label className="view-panel-row">
            <span className="view-panel-label">Sort</span>
            <select className="view-panel-select" value={sort} onChange={(e) => changeSort(e.target.value as SortOrder)}>
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          {!!categories?.length && !offline && (
            <div className="view-panel-row">
              <span className="view-panel-label">Shelves</span>
              <span className="view-switch" role="group" aria-label="Shelves or one list">
                <button aria-pressed={!listChosen} onClick={() => listChosen && showShelvesAgain()}>
                  Shelves
                </button>
                <button
                  aria-pressed={listChosen}
                  onClick={() => !listChosen && navigate({ search: editing ? "?list=1&edit=1" : "?list=1" })}
                >
                  One list
                </button>
              </span>
            </div>
          )}
          {categories?.length === 0 && (
            <Link to="/shelves?new=1" className="view-panel-row view-panel-link">
              <span className="view-panel-label">
                Make shelves
                <span className="view-panel-detail">Group recipes, like “Mains” or “Baking”</span>
              </span>
              <ChevronIcon />
            </Link>
          )}
          {!editing && !offline && (
            <button
              className="view-panel-row view-panel-link"
              onClick={() => {
                setViewOpen(false);
                setEditing(true);
              }}
            >
              <span className="view-panel-label">
                Edit recipes
                <span className="view-panel-detail">Pick some to put on a shelf or delete</span>
              </span>
              <ChevronIcon />
            </button>
          )}
        </div>
      )}

      {offline && <OfflineNote />}
      <BackupNudge recipes={all.length} />
      {editing && (
        <div className="edit-bar">
          <p>
            Tap recipes to pick them{showShelves ? ", or drag a shelf by its ⠿ to move it" : ""}.
          </p>
          <button className="button primary" onClick={() => setEditing(false)}>
            Done
          </button>
        </div>
      )}
      {editing && error && <p className="error">{error}</p>}
      {editing && done && (
        <p className="success" role="status">
          {done}
          {undoTags && (
            <>
              {" "}
              <button className="link-button" onClick={() => void undoShelving()} disabled={working}>
                Undo
              </button>
            </>
          )}
        </p>
      )}
      {/* What to do with the picked recipes, above the tab bar. */}
      {pickedNow.length > 0 && (
        <div className="select-bar" role="region" aria-label="Picked recipes">
          {choosingShelf ? (
            <>
              <div className="select-bar-row">
                <strong>Put {pickedNow.length === 1 ? "it" : `these ${pickedNow.length}`} on a shelf</strong>
                <button className="link-button" onClick={() => setChoosingShelf(false)} disabled={working}>
                  Cancel
                </button>
              </div>
              {shelfChoices.length ? (
                <>
                  <div className="tag-list" role="group" aria-label="Shelves">
                    {shelfChoices.map((category) => {
                      const on = pickedNow.every((recipe) => inCategory(recipe, category));
                      return (
                        <button
                          key={category.id}
                          className={`tag-chip ${on ? "selected" : ""}`}
                          aria-pressed={on}
                          disabled={working}
                          onClick={() => void shelvePicked(pickedNow, category, on)}
                        >
                          {category.name}
                        </button>
                      );
                    })}
                  </div>
                  <p className="muted select-bar-hint">A highlighted shelf already has them all: tap it to take them off.</p>
                </>
              ) : (
                <p className="muted select-bar-hint">
                  No shelves to put recipes on yet. <Link to="/shelves?new=1">Make one</Link>
                </p>
              )}
            </>
          ) : (
            <div className="select-bar-row">
              <span>
                <strong>{pickedNow.length}</strong> picked
              </span>
              <button className="link-button" onClick={() => setPicked(new Set())} disabled={working}>
                Clear
              </button>
              <span className="select-bar-actions">
                <button className="button" onClick={() => setChoosingShelf(true)} disabled={working || !categories}>
                  Put on a shelf
                </button>
                <button className="button danger" onClick={() => void deletePicked(pickedNow)} disabled={working}>
                  Delete
                </button>
              </span>
            </div>
          )}
        </div>
      )}
      {shown.length === 0 && (
        <p className="muted">
          {favoritesOnly && !quickOnly && !search.trim() && !filtering
            ? spell("No favourites yet. Open a recipe and tap its ♥ to add it here.")
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
          {/* Edit mode shows every shelf in its real order, empty ones as
              shut drawers with grips, so any can be moved or edited and
              lands where it's dropped. Otherwise the
              empty ones are one line at the end: a new
              household's first recipes come first, not seven empty drawers. */}
          {(editing ? allShelves : filledShelves).map((shelf) => (
            <Shelf
              key={shelf.id}
              id={shelf.id}
              name={shelf.name}
              count={shelf.recipes.length}
              open={shelf.recipes.length > 0 && drawers.isOpen(shelf.id)}
              onToggle={() => drawers.toggle(shelf.id)}
              // "Everything else" always comes last, and isn't a real shelf.
              movable={editing && shelf.id !== OTHER}
              editLink={editing && shelf.id !== OTHER ? `/shelves?edit=${shelf.id}` : null}
            >
              <ul className={gridClass}>{shelf.recipes.map((recipe) => tile(recipe))}</ul>
            </Shelf>
          ))}
          {!editing && emptyShelves.length > 0 && (
            <>
              <p className="muted shelf-empty-line">
                Empty shelves: {emptyShelves.map((shelf) => shelf.name).join(" · ")}
                <HelpButton help={shelfHelp} label="How to fill a shelf" />
              </p>
              <HelpBox help={shelfHelp}>
                <p>Tap View, then Edit recipes, pick some recipes, then Put on a shelf.</p>
              </HelpBox>
            </>
          )}
          {editing && (
            <Link to="/shelves?new=1" className="button small new-shelf">
              + New shelf
            </Link>
          )}
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
        <ul className={gridClass}>{shown.map((recipe) => tile(recipe))}</ul>
      )}

      {!editing && error && <p className="error">{error}</p>}
    </div>
  );
}

// One shelf: a drawer of recipes with its name and count. In Edit mode, a
// grip before the name drags it onto another shelf to swap places (not
// "Everything else", which stays last; the shelf it would land on is
// outlined), and "Edit shelf" after it opens its name and tags.
function Shelf({
  id,
  name,
  count,
  open,
  onToggle,
  movable,
  editLink,
  children,
}: {
  id: string;
  name: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  movable: boolean;
  editLink: string | null;
  children: ReactNode;
}) {
  const drag = useDraggable({ id, disabled: !movable });
  const drop = useDroppable({ id, disabled: !movable });
  const classes = ["shelf", drag.isDragging ? "dragging" : "", drop.isOver && !drag.isDragging ? "drop-here" : ""];
  const [editing] = useEditMode();
  return (
    <section ref={drop.setNodeRef} className={classes.join(" ")}>
      <div className={`shelf-head ${editing ? "with-handle" : ""}`} ref={drag.setNodeRef}>
        {movable ? (
          <button className="drag-handle shelf-handle" aria-label={`Move the ${name} shelf`} title="Drag to move" {...drag.attributes} {...drag.listeners}>
            <GripIcon />
          </button>
        ) : (
          editing && <span className="shelf-handle-space" aria-hidden="true" />
        )}
        <h2>
          {count === 0 ? (
            // An empty shelf (Edit mode only): nothing to open.
            <span className="drawer-toggle shelf-toggle shelf-empty-name">
              <span className="drawer-label">{name}</span>
              <span className="drawer-counts muted">empty</span>
            </span>
          ) : (
            <DrawerToggle open={open} onToggle={onToggle} className="shelf-toggle">
              <span className="drawer-label">{name}</span>
              <span className="drawer-counts muted">{count}</span>
            </DrawerToggle>
          )}
        </h2>
        {editLink && (
          <Link to={editLink} className="button small shelf-edit" aria-label={`Edit the ${name} shelf`}>
            <PencilIcon /> Edit shelf
          </Link>
        )}
      </div>
      {open && children}
    </section>
  );
}

// The small line under a card's name: time, the household's average in
// onigiri (or, until anyone here rates it, the website's own in grey ★),
// and a tiny thumbs up if anyone has given it one.
function CardDetails({ recipe, ratings, quick }: { recipe: Recipe; ratings: RecipeRating[]; quick: boolean }) {
  const time = formatMinutes(totalMinutes(recipe));
  const average = averageStars(ratings);
  const site = average === null && recipe.site_rating && recipe.source_url ? recipe.site_rating : null;
  const thumbsUp = ratings.some((r) => r.approved);
  const thumbsDown = ratings.some((r) => r.disliked);
  if (!time && average === null && site === null && !thumbsUp && !thumbsDown) return null;
  return (
    <span className="card-details muted">
      {time && <QuickTime quick={quick}>{time}</QuickTime>}
      {average !== null && (
        <span aria-label={`${average} of 5 onigiri`}>
          <OnigiriIcon size={12} /> {average}
        </span>
      )}
      {site !== null && (
        <span className="site-star" aria-label={`${site} of 5 stars on its website`} title="The website's rating">
          ★ {site}
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
