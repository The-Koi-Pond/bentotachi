import { useState } from "react";
import { Link } from "react-router";
import { errorMessage } from "./pb";
import { normaliseTag } from "./recipeCategories";
import { tagsIn } from "./tagText";
import TagSuggestions from "./TagSuggestions";

// A recipe's tags on its page: each opens the recipe list filtered to it,
// and "+" opens tag editing right here, without the Edit page. While open,
// each tag gets a × and the form's suggestions show below a box for typing
// a new one. Every change saves straight away.
export default function QuickTags({
  tags,
  content,
  canEdit,
  onSave,
}: {
  tags: string[];
  // The recipe's name, description and ingredients, for suggestions.
  content: string;
  canEdit: boolean;
  onSave: (tags: string[]) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [error, setError] = useState("");

  // The suggestions work on the recipe form's comma-separated text.
  const text = [...tags, typed].filter(Boolean).join(", ") + (typed ? "" : ", ");

  async function change(next: string[]) {
    setError("");
    try {
      await onSave(next);
    } catch (err) {
      setError(errorMessage(err));
    }
  }

  // A tapped suggestion changes the text; what's left half-typed stays in
  // the box rather than becoming a tag.
  function fromSuggestions(newText: string) {
    let next = tagsIn(newText);
    let stillTyped = "";
    if (typed.trim() && !/,\s*$/.test(newText) && next.at(-1) === normaliseTag(typed)) {
      stillTyped = typed;
      next = next.slice(0, -1);
    }
    setTyped(stillTyped);
    void change(next);
  }

  function addTyped() {
    const tag = normaliseTag(typed);
    if (tag && !tags.includes(tag)) void change([...tags, tag]);
    setTyped("");
  }

  if (!tags.length && !canEdit) return null;

  return (
    <div className="quick-tags stack">
      <ul className="tags">
        {tags.map((tag) => (
          <li key={tag}>
            {open ? (
              <button className="tag-remove" onClick={() => void change(tags.filter((t) => t !== tag))} aria-label={`Remove the tag ${tag}`}>
                {tag} <span aria-hidden="true">×</span>
              </button>
            ) : (
              // Opens the recipe list filtered to this tag.
              <Link to={`/?tag=${encodeURIComponent(tag)}`} aria-label={`Recipes tagged ${tag}`}>
                {tag}
              </Link>
            )}
          </li>
        ))}
        {canEdit && (
          <li>
            <button
              className={`tag-add ${open ? "open" : ""}`}
              aria-expanded={open}
              aria-label={open ? "Done changing tags" : "Add or remove tags"}
              title={open ? "Done" : "Add or remove tags"}
              onClick={() => {
                setOpen(!open);
                setTyped("");
                setError("");
              }}
            >
              {open ? "Done" : tags.length ? "+" : "+ Add tags"}
            </button>
          </li>
        )}
      </ul>
      {open && (
        <div className="quick-tag-panel stack">
          <input
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addTyped();
              }
            }}
            aria-label="Add a tag"
            placeholder="New tag, then Enter"
            autoFocus
          />
          <TagSuggestions text={text} content={content} onChange={fromSuggestions} />
          {error && <p className="error">{error}</p>}
        </div>
      )}
    </div>
  );
}
