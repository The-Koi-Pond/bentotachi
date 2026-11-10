import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router";
import { errorMessage, recipeCategories, recipes, type Recipe, type RecipeCategory } from "../pb";
import { normaliseTag, sortCategories } from "../recipeCategories";
import { forEveryone, useSingleUser } from "../household";
import { useUnsavedChanges } from "../unsavedChanges";
import { askFirst } from "../askFirst";

// The household's shelves on the Recipes page (stored as recipe
// categories). Each is a name and the tags that count for it, so the many
// ways websites spell the same thing ("main course", "mains"…) all land on
// one shelf. Reordering is on the Recipes page, in Edit mode.
//
// The Recipes page's Edit mode opens one shelf ("#/shelves?edit=<id>", or
// "?new=1" for a new one); Save, Cancel or Delete then go back there. Every
// shelf is listed there, so this page has no list of its own: without
// either it goes to that Edit mode.
export default function Shelves() {
  const [searchParams] = useSearchParams();
  const opened = searchParams.get("edit") ?? (searchParams.has("new") ? "new" : null);
  return opened ? <ShelfPage opened={opened} /> : <Navigate to="/?edit=1" replace />;
}

function ShelfPage({ opened }: { opened: string }) {
  const [categories, setCategories] = useState<RecipeCategory[] | null>(null);
  const [tagged, setTagged] = useState<Pick<Recipe, "id" | "tags">[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const singleUser = useSingleUser();
  const navigate = useNavigate();

  // Done: back to the Recipes page's Edit mode (by going back, if that's
  // where this was opened from).
  function finish() {
    const index = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (index > 0) navigate(-1);
    else navigate("/?edit=1", { replace: true });
  }

  useEffect(() => {
    recipeCategories()
      .getFullList()
      .then((list) => setCategories(sortCategories(list)))
      .catch((err) => setError(errorMessage(err)));
    recipes()
      .getFullList({ fields: "id,tags" })
      .then(setTagged)
      .catch(() => {});
  }, []);

  // Every tag on a recipe, most-used first, with how many recipes have it.
  const tagCounts = useMemo(() => {
    const totals = new Map<string, number>();
    for (const recipe of tagged) for (const tag of new Set((recipe.tags ?? []).map(normaliseTag))) totals.set(tag, (totals.get(tag) ?? 0) + 1);
    return [...totals.entries()].sort(([a, x], [b, y]) => y - x || a.localeCompare(b));
  }, [tagged]);

  if (!categories) return error ? <p className="error">{error}</p> : <p className="muted">Loading shelves…</p>;

  // Both say whether it worked; the form then moves on (see finish).
  async function save(original: RecipeCategory | null, name: string, tags: string[]): Promise<boolean> {
    setBusy(true);
    setError("");
    try {
      const data = { name: name.trim(), tags };
      const saved = original
        ? await recipeCategories().update(original.id, data)
        : await recipeCategories().create({ ...data, position: Math.max(-1, ...categories!.map((c) => c.position)) + 1 });
      setCategories((list) => sortCategories([...(list ?? []).filter((c) => c.id !== saved.id), saved]));
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function remove(category: RecipeCategory): Promise<boolean> {
    if (
      !(await askFirst(`Delete the “${category.name}” shelf${forEveryone(singleUser)}? Its recipes keep their tags.`, {
        yes: "Delete",
        danger: true,
      }))
    )
      return false;
    setBusy(true);
    setError("");
    try {
      await recipeCategories().delete(category.id);
      setCategories((list) => (list ?? []).filter((c) => c.id !== category.id));
      return true;
    } catch (err) {
      setError(errorMessage(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  const category = opened === "new" ? null : categories.find((c) => c.id === opened);

  return (
    <div className="stack narrow">
      <div className="stack">
        <h1>Shelves</h1>
        <p className="muted">
          Each shelf on the <Link to="/">Recipes</Link> page holds every recipe with any of its tags. Websites can't agree on
          what to call anything (“mains”, “main dishes”, “dinner”), so add each spelling you see.
        </p>
      </div>
      {error && <p className="error">{error}</p>}
      {category === undefined ? (
        <p className="muted">
          That shelf has gone walkabout: someone may have deleted it. <Link to="/?edit=1">Back to your recipes</Link>
        </p>
      ) : (
        <CategoryForm
          category={category}
          tagCounts={tagCounts}
          busy={busy}
          onSave={(name, tags) => save(category, name, tags)}
          onDone={finish}
          onDelete={category ? () => remove(category) : undefined}
        />
      )}
    </div>
  );
}

// Adding or changing a shelf: its name, and its tags picked from the ones
// recipes use (narrowed by typing) or typed in new, like "one-pot".
function CategoryForm({
  category,
  tagCounts,
  busy,
  onSave,
  onDone,
  onDelete,
}: {
  category: RecipeCategory | null;
  tagCounts: [string, number][];
  busy: boolean;
  // Say whether it worked; the form moves on (onDone) only if it did.
  onSave: (name: string, tags: string[]) => Promise<boolean>;
  onDone: () => void;
  onDelete?: () => Promise<boolean>;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [tags, setTags] = useState<string[]>((category?.tags ?? []).map(normaliseTag));
  const [typed, setTyped] = useState("");
  const now = JSON.stringify([name, tags]);
  const [opened] = useState(now);
  const { allowLeaving } = useUnsavedChanges(now !== opened || typed.trim() !== "");

  // Saved, deleted or cancelled on purpose: no "unsaved changes?" question
  // on the way back to the Recipes page.
  function leave() {
    allowLeaving();
    onDone();
  }

  const wanted = normaliseTag(typed);
  const suggestions = tagCounts.filter(([tag]) => !tags.includes(tag) && (!wanted || tag.includes(wanted)));
  const counts = new Map(tagCounts);

  function addTag(tag: string) {
    const clean = normaliseTag(tag);
    if (clean && !tags.includes(clean)) setTags([...tags, clean]);
    setTyped("");
  }

  // A tag still in the box counts, as Enter would have added it.
  async function submit(event: FormEvent) {
    event.preventDefault();
    const last = normaliseTag(typed);
    if (await onSave(name, last && !tags.includes(last) ? [...tags, last] : tags)) leave();
  }

  return (
    <form className="card stack category-form" onSubmit={submit}>
      <h2>{category ? `Edit “${category.name}”` : "New shelf"}</h2>
      <label>
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Desserts" required autoFocus />
      </label>

      <div className="stack">
        <span className="field-label">Its tags</span>
        <div className="tag-list">
          {tags.length ? (
            tags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="tag-chip selected"
                onClick={() => setTags(tags.filter((t) => t !== tag))}
                aria-label={`Remove ${tag}`}
              >
                {tag} {counts.has(tag) && <span className="tag-count">{counts.get(tag)}</span>} <span aria-hidden="true">×</span>
              </button>
            ))
          ) : (
            <span className="muted">None yet. Pick some below.</span>
          )}
        </div>
      </div>

      <label>
        Find or add a tag
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            // Enter adds the typed tag rather than saving the whole form.
            if (e.key === "Enter") {
              e.preventDefault();
              addTag(typed);
            }
          }}
          placeholder="e.g. one-pot"
        />
      </label>
      {wanted && !tags.includes(wanted) && !counts.has(wanted) && (
        <button type="button" className="button small add-typed-tag" onClick={() => addTag(typed)}>
          + Add “{wanted}”
        </button>
      )}
      {suggestions.length > 0 && (
        <div className="tag-list category-suggestions" role="group" aria-label="Tags on your recipes">
          {suggestions.map(([tag, count]) => (
            <button key={tag} type="button" className="tag-chip" onClick={() => addTag(tag)}>
              {tag} <span className="tag-count">{count}</span>
            </button>
          ))}
        </div>
      )}

      <div className="actions">
        {onDelete && (
          <button type="button" className="button danger push-left" onClick={() => void onDelete().then((gone) => gone && leave())} disabled={busy}>
            Delete
          </button>
        )}
        <button type="button" className="button ghost" onClick={leave} disabled={busy}>
          Cancel
        </button>
        <button className="button primary" disabled={busy || !name.trim()}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
