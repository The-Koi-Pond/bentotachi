import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { errorMessage, recipeCategories, recipes, type Recipe, type RecipeCategory } from "../pb";
import { inCategory, normaliseTag, sortCategories } from "../recipeCategories";
import { forEveryone, useSingleUser } from "../household";
import { saveCategoryOrder } from "../categoryOrder";
import { useUnsavedChanges } from "../unsavedChanges";

// The household's recipe categories: the shelves on the Recipes page. Each
// is a name and the tags that count for it, so the many ways websites spell
// the same thing ("main course", "mains"…) all land on one shelf.
export default function Categories() {
  const [categories, setCategories] = useState<RecipeCategory[] | null>(null);
  const [tagged, setTagged] = useState<Pick<Recipe, "id" | "tags">[]>([]);
  const [error, setError] = useState("");
  // The category being edited: its id, or "new" for one not saved yet.
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const singleUser = useSingleUser();

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

  if (!categories) return error ? <p className="error">{error}</p> : <p className="muted">Loading categories…</p>;

  async function save(original: RecipeCategory | null, name: string, tags: string[]) {
    setBusy(true);
    setError("");
    try {
      const data = { name: name.trim(), tags };
      const saved = original
        ? await recipeCategories().update(original.id, data)
        : await recipeCategories().create({ ...data, position: Math.max(-1, ...categories!.map((c) => c.position)) + 1 });
      setCategories((list) => sortCategories([...(list ?? []).filter((c) => c.id !== saved.id), saved]));
      setEditing(null);
    } catch (err) {
      setError(errorMessage(err));
    }
    setBusy(false);
  }

  async function remove(category: RecipeCategory) {
    if (!window.confirm(`Delete the “${category.name}” category${forEveryone(singleUser)}? Its recipes keep their tags.`)) return;
    setBusy(true);
    setError("");
    try {
      await recipeCategories().delete(category.id);
      setCategories((list) => (list ?? []).filter((c) => c.id !== category.id));
      setEditing(null);
    } catch (err) {
      setError(errorMessage(err));
    }
    setBusy(false);
  }

  // Swaps a category with its neighbour, numbering them all 0, 1, 2… so the
  // order is always clear.
  async function move(index: number, by: -1 | 1) {
    const order = [...categories!];
    [order[index], order[index + by]] = [order[index + by], order[index]];
    setBusy(true);
    setError("");
    try {
      setCategories(await saveCategoryOrder(order, categories!));
    } catch (err) {
      setError(errorMessage(err));
    }
    setBusy(false);
  }

  return (
    <div className="stack narrow">
      <div className="stack">
        <h1>Categories</h1>
        <p className="muted">
          Each category is a shelf on the <Link to="/">Recipes</Link> page, holding every recipe with any of its tags.
          Websites name the same thing in different ways, so add each spelling you see.
        </p>
      </div>
      {error && <p className="error">{error}</p>}

      {categories.map((category, index) =>
        editing === category.id ? (
          <CategoryForm
            key={category.id}
            category={category}
            tagCounts={tagCounts}
            busy={busy}
            onSave={(name, tags) => void save(category, name, tags)}
            onCancel={() => setEditing(null)}
            onDelete={() => void remove(category)}
          />
        ) : (
          <section key={category.id} className="card stack category-card">
            <div className="category-head">
              <h2>{category.name}</h2>
              <span className="muted">{countLabel(tagged.filter((recipe) => inCategory(recipe, category)).length)}</span>
              <div className="category-moves">
                <button
                  className="icon-button small"
                  aria-label={`Move ${category.name} up`}
                  title="Move up"
                  disabled={busy || index === 0}
                  onClick={() => void move(index, -1)}
                >
                  ↑
                </button>
                <button
                  className="icon-button small"
                  aria-label={`Move ${category.name} down`}
                  title="Move down"
                  disabled={busy || index === categories.length - 1}
                  onClick={() => void move(index, 1)}
                >
                  ↓
                </button>
              </div>
            </div>
            <div className="tag-list">
              {(category.tags ?? []).length ? (
                (category.tags ?? []).map((tag) => (
                  <span key={tag} className="tag-chip static">
                    {tag}
                  </span>
                ))
              ) : (
                <span className="muted">No tags yet.</span>
              )}
            </div>
            <button className="button small category-edit" disabled={busy || editing !== null} onClick={() => setEditing(category.id)}>
              Edit
            </button>
          </section>
        ),
      )}

      {editing === "new" ? (
        <CategoryForm
          category={null}
          tagCounts={tagCounts}
          busy={busy}
          onSave={(name, tags) => void save(null, name, tags)}
          onCancel={() => setEditing(null)}
        />
      ) : (
        <button className="button primary" disabled={busy || editing !== null} onClick={() => setEditing("new")}>
          + New category
        </button>
      )}
    </div>
  );
}

function countLabel(count: number) {
  return `${count} ${count === 1 ? "recipe" : "recipes"}`;
}

// Adding or changing a category: its name, and its tags picked from the
// ones recipes use (narrowed by typing) or typed in new, like "one-pot".
function CategoryForm({
  category,
  tagCounts,
  busy,
  onSave,
  onCancel,
  onDelete,
}: {
  category: RecipeCategory | null;
  tagCounts: [string, number][];
  busy: boolean;
  onSave: (name: string, tags: string[]) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState(category?.name ?? "");
  const [tags, setTags] = useState<string[]>((category?.tags ?? []).map(normaliseTag));
  const [typed, setTyped] = useState("");
  const now = JSON.stringify([name, tags]);
  const [opened] = useState(now);
  useUnsavedChanges(now !== opened || typed.trim() !== "");

  const wanted = normaliseTag(typed);
  const suggestions = tagCounts.filter(([tag]) => !tags.includes(tag) && (!wanted || tag.includes(wanted)));
  const counts = new Map(tagCounts);

  function addTag(tag: string) {
    const clean = normaliseTag(tag);
    if (clean && !tags.includes(clean)) setTags([...tags, clean]);
    setTyped("");
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(name, tags);
  }

  return (
    <form className="card stack category-form" onSubmit={submit}>
      <h2>{category ? `Edit “${category.name}”` : "New category"}</h2>
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
          <button type="button" className="button danger push-left" onClick={onDelete} disabled={busy}>
            Delete
          </button>
        )}
        <button type="button" className="button ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className="button primary" disabled={busy || !name.trim()}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
