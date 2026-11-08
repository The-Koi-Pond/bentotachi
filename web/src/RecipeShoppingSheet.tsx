import { useEffect, useRef, useState } from "react";
import { errorMessage, recipes, type PantryItem, type Recipe } from "./pb";
import { gatherIngredients } from "./weekShopping";
import { addToShoppingList, addedMessage } from "./shoppingAdd";
import { useLiveRecords } from "./useLiveRecords";
import { CloseIcon } from "./icons";
import { GatheredList, useGatheredTicks } from "./GatheredTicks";

// "From a recipe" on the shopping list (Lilly, 2026-11-08): find a recipe,
// then add its ingredients without leaving the list. What the pantry says
// we have starts unticked; "All" ticks everything.
export default function RecipeShoppingSheet({ onClose }: { onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const pantry = useLiveRecords<PantryItem>("pantry_items");
  const [all, setAll] = useState<Recipe[] | null>(null);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [chosen, setChosen] = useState<Recipe | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  useEffect(() => {
    recipes()
      .getFullList({ sort: "title", fields: "id,collectionId,title,ingredients,ingredient_links" })
      .then(setAll)
      .catch((err) => setLoadError(errorMessage(err)));
  }, []);

  const words = search.trim().toLowerCase();
  const found = (all ?? []).filter((recipe) => !words || recipe.title.toLowerCase().includes(words));

  return (
    <dialog
      ref={dialogRef}
      className="sheet"
      aria-labelledby="recipe-shop-title"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="sheet-panel">
        <div className="sheet-head">
          <h2 id="recipe-shop-title">{chosen ? chosen.title : "Add from a recipe"}</h2>
          <button className="icon-button small" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>
        {chosen ? (
          <ChosenRecipe recipe={chosen} pantry={pantry.items} pantryError={pantry.loadError} onBack={() => setChosen(null)} />
        ) : (
          <>
            <input
              type="search"
              className="search"
              placeholder="Search recipes"
              aria-label="Search recipes"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
            />
            {loadError && <p className="error">{loadError}</p>}
            {!all && !loadError && <p className="muted">Fetching the recipes…</p>}
            {all && found.length === 0 && <p className="muted">No recipe called that.</p>}
            <ul className="site-list recipe-pick-list">
              {found.map((recipe) => (
                <li key={recipe.id}>
                  <button className="site-row" onClick={() => setChosen(recipe)}>
                    <span className="site-name">{recipe.title}</span>
                    <span className="muted">{(recipe.ingredients ?? []).length ? "›" : "no ingredients"}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </dialog>
  );
}

// The chosen recipe's ingredients, to tick and add.
function ChosenRecipe({
  recipe,
  pantry,
  pantryError,
  onBack,
}: {
  recipe: Recipe;
  pantry: PantryItem[] | null;
  pantryError: string;
  onBack: () => void;
}) {
  const rows = gatherIngredients([recipe], pantry ?? []);
  const ticks = useGatheredTicks(rows);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);

  async function add() {
    setBusy(true);
    setStatus(null);
    try {
      const result = await addToShoppingList(
        ticks.ticked.map((row) => ({ text: row.text, pantryItem: row.pantryItem?.id ?? "", recipe: row.recipeId }))
      );
      setStatus({ text: addedMessage(result), isError: false });
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
    } finally {
      setBusy(false);
    }
  }

  const loading = !pantry || ticks.loading;
  return (
    <>
      <button className="link-button recipe-pick-back" onClick={onBack}>
        ‹ Another recipe
      </button>
      {loading && <p className="muted">Checking the pantry…</p>}
      {(pantryError || ticks.loadError) && <p className="error">{pantryError || ticks.loadError}</p>}
      {!loading && rows.length === 0 && <p className="muted">This recipe has no ingredients to buy.</p>}
      {!loading && rows.length > 0 && (
        <>
          <div className="filter-chips" role="group" aria-label="Tick">
            <button onClick={ticks.tickAll}>All</button>
            <button onClick={ticks.tickMissing}>Missing from pantry</button>
          </div>
          <GatheredList rows={rows} ticks={ticks} showFor={false} />
        </>
      )}
      <div className="actions">
        <button className="button primary" disabled={busy || ticks.ticked.length === 0} onClick={() => void add()}>
          {busy ? "Adding…" : ticks.ticked.length ? `Add ${ticks.ticked.length} to the list` : "Add to the list"}
        </button>
      </div>
      {status && (
        <p className={status.isError ? "error" : "success"} role="status">
          {status.text}
        </p>
      )}
    </>
  );
}
