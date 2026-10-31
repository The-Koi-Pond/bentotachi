import { useEffect, useState } from "react";
import { recipeCategories, recipes, type RecipeCategory } from "./pb";
import { inCategory, normaliseTag, sortCategories } from "./recipeCategories";
import { suggestTags, tagsFromContent, tagsIn, typedTag, withTag, withoutTags } from "./tagText";

// Before typing, this many of the most-used tags show; "Show all" has the rest.
const FIRST_FEW = 16;

// Under the recipe form's tag box: known tags the recipe mentions (in
// `content`: its name, description and ingredients), the tags other
// recipes use, narrowed to what's being typed, then the categories (tap to
// put the recipe on that shelf, again to take it off). Tapping one changes
// the box's text.
export default function TagSuggestions({
  text,
  content,
  onChange,
}: {
  text: string;
  content: string;
  onChange: (text: string) => void;
}) {
  const [categories, setCategories] = useState<RecipeCategory[]>([]);
  const [used, setUsed] = useState<[string, number][]>([]);
  const [showAll, setShowAll] = useState(false);

  // Suggestions are extras: the box still works if these can't load.
  useEffect(() => {
    recipeCategories()
      .getFullList()
      .then((list) => setCategories(sortCategories(list).filter((c) => (c.tags ?? []).length > 0)))
      .catch(() => {});
    recipes()
      .getFullList({ fields: "tags" })
      .then((list) => {
        const totals = new Map<string, number>();
        for (const recipe of list) for (const tag of new Set((recipe.tags ?? []).map(normaliseTag))) totals.set(tag, (totals.get(tag) ?? 0) + 1);
        setUsed([...totals.entries()].sort(([a, x], [b, y]) => y - x || a.localeCompare(b)));
      })
      .catch(() => {});
  }, []);

  const draft = { tags: tagsIn(text) };
  const counts = new Map(used);
  // Each category's main tag counts as known too, so "one-pot" can be
  // suggested before any recipe has it. (Not their other spellings:
  // "sweets" or "baking" would turn up for "sweet chilli" or "baking dish".)
  const known = [...new Set([...used.map(([tag]) => tag), ...categories.map((c) => normaliseTag(c.tags![0]))])];
  const fromRecipe = tagsFromContent(known, content, text);
  const { tags: allMatching, narrowing } = suggestTags(
    used.map(([tag]) => tag),
    text,
  );
  // Each tag shows in one row only.
  const matching = allMatching.filter((tag) => !fromRecipe.includes(tag));
  const shown = narrowing || showAll ? matching : matching.slice(0, FIRST_FEW);
  // A suggestion finishes a half-typed tag it starts with ("be" -> beef).
  const typed = typedTag(text);

  if (!categories.length && !used.length) return null;

  return (
    <div className="tag-suggestions">
      {fromRecipe.length > 0 && (
        <div className="tag-suggestion-row" role="group" aria-label="Suggested for this recipe">
          <span className="muted tag-panel-label">Suggested for this recipe</span>
          {fromRecipe.map((tag) => (
            <button
              key={tag}
              type="button"
              className="tag-chip suggested"
              onClick={() => onChange(withTag(text, tag, narrowing && tag.startsWith(typed)))}
            >
              + {tag}
            </button>
          ))}
        </div>
      )}
      {shown.length > 0 && (
        <div className="tag-suggestion-row" role="group" aria-label="Tags you've used">
          <span className="muted tag-panel-label">{narrowing ? "Matching tags" : "Tags you've used"}</span>
          {shown.map((tag) => (
            <button key={tag} type="button" className="tag-chip" onClick={() => onChange(withTag(text, tag, narrowing))}>
              {tag} <span className="tag-count">{counts.get(tag)}</span>
            </button>
          ))}
          {!narrowing && !showAll && matching.length > FIRST_FEW && (
            <button type="button" className="link-button" onClick={() => setShowAll(true)}>
              Show all {matching.length}
            </button>
          )}
        </div>
      )}
      {categories.length > 0 && (
        <div className="tag-suggestion-row" role="group" aria-label="Put on a shelf">
          <span className="muted tag-panel-label">Put on a shelf</span>
          {categories.map((category) => {
            const on = inCategory(draft, category);
            return (
              <button
                key={category.id}
                type="button"
                className={`tag-chip ${on ? "selected" : ""}`}
                aria-pressed={on}
                onClick={() => onChange(on ? withoutTags(text, category.tags ?? []) : withTag(text, normaliseTag(category.tags![0]), false))}
              >
                {category.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
