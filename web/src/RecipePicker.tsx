import { useRef, useState } from "react";
import { Link } from "react-router";
import { errorMessage } from "./pb";
import { importRecipe, nextRecipeList, type RecipeList } from "./recipeImport";
import { someNames } from "./paprikaImport";

// A page listing recipes (a site's category), to tick the ones wanted and
// add them all: each is imported like a pasted link, one after another so
// the site isn't flooded. Recipes already here can't be ticked.
export default function RecipePicker({ list: first }: { list: RecipeList }) {
  const [list, setList] = useState(first);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  // Added in this visit, so they show as here without asking the server.
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [progress, setProgress] = useState("");
  const [status, setStatus] = useState<{
    text: string;
    isError: boolean;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const stopped = useRef(false);

  const isHere = (url: string) =>
    added.has(url) ||
    list.recipes.some((recipe) => recipe.url === url && recipe.have);
  const pickable = list.recipes.filter((recipe) => !isHere(recipe.url));
  const allPicked =
    pickable.length > 0 && pickable.every((recipe) => picked.has(recipe.url));
  const adding = progress !== "";

  function toggle(url: string) {
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  async function addPicked() {
    const chosen = list.recipes.filter(
      (recipe) => picked.has(recipe.url) && !isHere(recipe.url),
    );
    stopped.current = false;
    setStatus(null);
    let count = 0;
    let already = 0;
    const failed: string[] = [];
    for (const [i, recipe] of chosen.entries()) {
      if (stopped.current) break;
      setProgress(`Adding ${i + 1} of ${chosen.length}…`);
      try {
        const result = await importRecipe({ url: recipe.url });
        if ("id" in result) count += 1;
        else if ("duplicate" in result) already += 1;
        else failed.push(recipe.title);
        if (!("list" in result)) {
          setAdded((previous) => new Set(previous).add(recipe.url));
          setPicked((previous) => {
            const next = new Set(previous);
            next.delete(recipe.url);
            return next;
          });
        }
      } catch (err) {
        // Kept going: one site refusing one page shouldn't stop the rest.
        console.warn(
          "Importing from a list failed",
          recipe.url,
          errorMessage(err),
        );
        failed.push(recipe.title);
      }
    }
    setProgress("");
    const parts = [count === 1 ? "Added 1 recipe." : `Added ${count} recipes.`];
    if (already)
      parts.push(
        already === 1 ? "1 was already here." : `${already} were already here.`,
      );
    if (stopped.current) parts.push("Stopped before the rest.");
    if (failed.length)
      parts.push(
        `Couldn't add ${someNames(failed)}: try ${failed.length === 1 ? "its" : "their"} link on its own.`,
      );
    setStatus({
      text: parts.join(" "),
      isError: failed.length > 0 && count === 0,
    });
  }

  async function loadMore() {
    setLoadingMore(true);
    setStatus(null);
    try {
      const more = await nextRecipeList(list.next);
      if (!more) {
        setList({ ...list, next: "" });
        return;
      }
      const known = new Set(list.recipes.map((recipe) => recipe.url));
      setList({
        ...list,
        recipes: [
          ...list.recipes,
          ...more.recipes.filter((recipe) => !known.has(recipe.url)),
        ],
        next: more.next,
      });
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <section className="card stack recipe-picker">
      <div>
        <h2>{list.title || "Recipes on this page"}</h2>
        <p className="muted">
          {list.recipes.length} recipes found. Tick the ones you want.
        </p>
      </div>
      {pickable.length > 0 && (
        <button
          type="button"
          className="button small ghost picker-all"
          disabled={adding}
          onClick={() =>
            setPicked(
              allPicked
                ? new Set()
                : new Set(pickable.map((recipe) => recipe.url)),
            )
          }
        >
          {allPicked ? "Untick all" : "Tick all"}
        </button>
      )}
      <ul className="checklist picker-list">
        {list.recipes.map((recipe) => {
          const here = isHere(recipe.url);
          return (
            <li key={recipe.url}>
              <label className={here ? "done" : ""}>
                <input
                  type="checkbox"
                  checked={here || picked.has(recipe.url)}
                  disabled={here || adding}
                  onChange={() => toggle(recipe.url)}
                />
                {recipe.image ? (
                  <img
                    className="picker-photo"
                    src={recipe.image}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <span className="picker-photo" aria-hidden="true" />
                )}
                <span className="picker-title">{recipe.title}</span>
                {here && <span className="muted picker-state">Here</span>}
              </label>
            </li>
          );
        })}
      </ul>
      {list.next && (
        <button
          type="button"
          className="button small"
          onClick={() => void loadMore()}
          disabled={loadingMore || adding}
        >
          {loadingMore ? "Loading…" : "More from this page"}
        </button>
      )}
      {/* Stays at the bottom of the screen while scrolling a long list. */}
      <div className="picker-bar stack">
        {progress && (
          <p className="muted" role="status">
            {progress}
          </p>
        )}
        {status && (
          <p className={status.isError ? "error" : "success"} role="status">
            {status.text}{" "}
            {!status.isError && added.size > 0 && (
              <Link to="/">See them in Recipes</Link>
            )}
          </p>
        )}
        <div className="actions">
          {adding ? (
            <button
              type="button"
              className="button"
              onClick={() => (stopped.current = true)}
            >
              Stop
            </button>
          ) : (
            <button
              type="button"
              className="button primary"
              disabled={!picked.size}
              onClick={() => void addPicked()}
            >
              {picked.size
                ? `Add ${picked.size} ${picked.size === 1 ? "recipe" : "recipes"}`
                : "Add recipes"}
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
