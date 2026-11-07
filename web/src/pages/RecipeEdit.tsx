import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router";
import type { PastedRecipe } from "../pastedRecipe";
import { errorMessage, pb, recipes, type Recipe } from "../pb";
import { linesToText, textToLines, textToTags } from "../format";
import { carriedLinks, sameLinks } from "../pantryLinks";
import { changedFields } from "../changedFields";
import TagSuggestions from "../TagSuggestions";
import RecipePhoto from "../RecipePhoto";
import PhotoFramer from "../PhotoFramer";
import type { Framing } from "../photoFraming";
import ExtraTimesEditor, { fromRows, toRows, type ExtraTimeRow } from "../ExtraTimesEditor";
import FormatTextarea from "../FormatTextarea";
import { useUnsavedChanges } from "../unsavedChanges";
import { usePreviewUrl } from "../pantryPhoto";
import { canTakePhoto } from "../PantryPhotoField";
import { siteHost } from "../recipeSites";

interface Draft {
  title: string;
  description: string;
  source_url: string;
  servings: string;
  prep_minutes: string;
  cook_minutes: string;
  total_minutes: string;
  extra_times: ExtraTimeRow[];
  ingredients: string;
  steps: string;
  tags: string;
  notes: string;
  author_notes: string;
}

function toDraft(recipe: Recipe): Draft {
  const minutes = (n: number) => (n ? String(n) : "");
  return {
    title: recipe.title,
    description: recipe.description,
    source_url: recipe.source_url,
    servings: recipe.servings,
    prep_minutes: minutes(recipe.prep_minutes),
    cook_minutes: minutes(recipe.cook_minutes),
    total_minutes: minutes(recipe.total_minutes),
    extra_times: toRows(recipe),
    ingredients: linesToText(recipe.ingredients),
    steps: linesToText(recipe.steps),
    tags: (recipe.tags ?? []).join(", "),
    notes: recipe.notes,
    author_notes: recipe.author_notes ?? "",
  };
}

const blankDraft: Draft = {
  title: "",
  description: "",
  source_url: "",
  servings: "",
  prep_minutes: "",
  cook_minutes: "",
  total_minutes: "",
  extra_times: [],
  ingredients: "",
  steps: "",
  tags: "",
  notes: "",
  author_notes: "",
};

function fromPasted(recipe: PastedRecipe): Draft {
  const minutes = (n: number) => (n ? String(n) : "");
  return {
    ...blankDraft,
    title: recipe.title,
    description: recipe.description,
    servings: recipe.servings,
    prep_minutes: minutes(recipe.prep_minutes),
    cook_minutes: minutes(recipe.cook_minutes),
    total_minutes: minutes(recipe.total_minutes),
    ingredients: linesToText(recipe.ingredients),
    steps: linesToText(recipe.steps),
    // The recipe writer's notes, like a link import's ("Our notes" are for
    // the household's own).
    author_notes: recipe.notes,
  };
}

// The form as fields to save.
function toFields(draft: Draft): Record<string, unknown> {
  return {
    title: draft.title.trim(),
    description: draft.description.trim(),
    source_url: draft.source_url.trim(),
    servings: draft.servings.trim(),
    prep_minutes: Number(draft.prep_minutes) || 0,
    cook_minutes: Number(draft.cook_minutes) || 0,
    total_minutes: Number(draft.total_minutes) || 0,
    extra_times: fromRows(draft.extra_times),
    ingredients: textToLines(draft.ingredients),
    steps: textToLines(draft.steps),
    tags: textToTags(draft.tags),
    notes: draft.notes.trim(),
    author_notes: draft.author_notes.trim(),
  };
}

// Used for both "add by hand" (/new) and editing (/recipes/:id/edit).
export default function RecipeEdit() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [existing, setExisting] = useState<Recipe | null>(null);
  // A recipe pasted as text on Add recipe arrives sorted into the boxes
  // (pastedRecipe.ts), to check before saving.
  const pasted = (useLocation().state as { pasted?: PastedRecipe } | null)?.pasted;
  const startDraft: Draft = { ...blankDraft, source_url: searchParams.get("source") ?? "" };
  const [draft, setDraft] = useState<Draft | null>(id ? null : pasted ? fromPasted(pasted) : startDraft);
  const [photo, setPhoto] = useState<File | null>(null);
  // The chosen photo, shown before it's saved.
  const photoPreview = usePreviewUrl(photo);
  const pickPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // So picking the same file again still counts as a change.
    event.target.value = "";
    if (file) setPhoto(file);
  };
  const [removePhoto, setRemovePhoto] = useState(false);
  // A new framing for the current photo, saved with the form.
  const [framing, setFraming] = useState<Framing | null>(null);
  const [framerOpen, setFramerOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  // The form as it started, to tell whether anything has been changed.
  // (A pasted recipe counts as changes: leaving asks first.)
  const [original, setOriginal] = useState(() => (id ? "" : JSON.stringify(startDraft)));
  const dirty = !!draft && (JSON.stringify(draft) !== original || !!photo || removePhoto || !!framing);
  const { allowLeaving } = useUnsavedChanges(dirty);

  useEffect(() => {
    if (!id) return;
    recipes()
      .getOne(id)
      .then((recipe) => {
        const loaded = toDraft(recipe);
        setExisting(recipe);
        setDraft(loaded);
        setOriginal(JSON.stringify(loaded));
      })
      .catch((err) => setError(errorMessage(err)));
  }, [id]);

  if (error && !draft) return <p className="error">{error}</p>;
  if (!draft) return <p className="muted">Loading…</p>;

  const field = (name: Exclude<keyof Draft, "extra_times">) => ({
    value: draft[name],
    onChange: (e: { target: { value: string } }) => setDraft({ ...draft, [name]: e.target.value }),
  });

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setError("");
    // An edit sends only the fields changed here (changedFields.ts), so
    // someone else's change saved meanwhile stays; a new recipe sends all.
    const data = existing ? changedFields(toFields(draft), toFields(JSON.parse(original))) : toFields(draft);
    // A new photo starts centred; otherwise any framing chosen here.
    if (photo) {
      data.image = photo;
      data.image_framing = null;
    } else if (removePhoto) {
      data.image = null;
      data.image_framing = null;
    } else if (framing) data.image_framing = framing;
    // The website's rating belongs to the site it came from: with the link
    // gone or pointing at another site, it's forgotten rather than credited
    // to the wrong one (or shown on a "home recipe").
    if (existing?.site_rating && "source_url" in data && siteHost(data.source_url as string) !== siteHost(existing.source_url)) {
      data.site_rating = 0;
      data.site_rating_count = 0;
    }
    try {
      // Pantry links are keyed by a line's wording: a reworded line keeps its
      // link, and lines that are gone lose theirs (carriedLinks). Worked out
      // from the links as saved now, so one someone else picked while this
      // was open isn't undone, and only sent when they changed. Only when
      // the ingredients were changed here: otherwise lines someone else
      // added meanwhile would lose their links.
      if (existing && "ingredients" in data) {
        const { ingredient_links: current } = await recipes().getOne(existing.id, { fields: "id,ingredient_links" });
        const links = carriedLinks(existing.ingredients ?? [], data.ingredients as string[], current);
        if (!sameLinks(links, current)) data.ingredient_links = links;
      }
      const saved = existing
        ? await recipes().update(existing.id, data)
        : await recipes().create({ ...data, added_by: pb.authStore.record?.id });
      allowLeaving();
      navigate(`/recipes/${saved.id}`, { replace: true });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="card stack" onSubmit={save}>
      <h1>{existing ? "Edit recipe" : "New recipe"}</h1>

      <label>
        Name
        <input {...field("title")} required />
      </label>
      <label>
        <span className="label-text">
          Short description <span className="optional">(optional)</span>
        </span>
        <FormatTextarea rows={2} {...field("description")} />
      </label>

      <div className="row">
        <label>
          Makes
          <input placeholder="4 servings" {...field("servings")} />
        </label>
        <label>
          Prep (min)
          <input type="number" min={0} inputMode="numeric" {...field("prep_minutes")} />
        </label>
        <label>
          Cook (min)
          <input type="number" min={0} inputMode="numeric" {...field("cook_minutes")} />
        </label>
        <label>
          Total (min)
          <input type="number" min={0} inputMode="numeric" {...field("total_minutes")} />
        </label>
      </div>
      <ExtraTimesEditor rows={draft.extra_times} onChange={(extra_times) => setDraft({ ...draft, extra_times })} />

      <label>
        Ingredients
        <span className="hint">
          One per line. Start a line with # for a heading, like “# For the sauce”. Select words and press B, I or U to
          make them bold, soft grey italics or underlined.
        </span>
        <FormatTextarea rows={10} {...field("ingredients")} />
      </label>
      <label>
        Method
        <span className="hint">
          One step per line. A # heading starts the step numbers again at 1 (a separate part, like a sauce); a ##
          heading carries on counting. B, I and U work here too.
        </span>
        <FormatTextarea rows={10} {...field("steps")} />
      </label>
      <div className="stack tag-field">
        <label>
          Tags
          <span className="hint">Separated by commas, like “quick, vegetarian, dinner”, or tap the ones below.</span>
          <input {...field("tags")} />
        </label>
        <TagSuggestions
          text={draft.tags}
          content={[draft.title, draft.description, draft.ingredients].join("\n")}
          onChange={(tags) => setDraft({ ...draft, tags })}
        />
      </div>
      <label>
        <span className="label-text">
          Author's notes <span className="optional">(optional)</span>
        </span>
        <span className="hint">Tips from the recipe's writer, like swaps, storage or making ahead.</span>
        <FormatTextarea rows={4} {...field("author_notes")} />
      </label>
      <label>
        <span className="label-text">
          Our notes <span className="optional">(optional)</span>
        </span>
        <span className="hint">Changes you made, what worked, what to try next time.</span>
        <FormatTextarea rows={4} {...field("notes")} />
      </label>
      <label>
        <span className="label-text">
          Original link <span className="optional">(optional)</span>
        </span>
        <input type="url" {...field("source_url")} />
      </label>

      <fieldset className="stack">
        <legend>
          Photo <span className="optional">(optional)</span>
        </legend>
        {existing?.image && !removePhoto && !photo && (
          <>
            <span className="photo-preview-box">
              <RecipePhoto recipe={existing} size="card" className="photo-preview" alt="Current photo" framing={framing ?? undefined} />
            </span>
            <button type="button" className="button small photo-adjust" onClick={() => setFramerOpen(true)}>
              Adjust photo
            </button>
          </>
        )}
        {framerOpen && existing && (
          <PhotoFramer
            recipe={existing}
            initial={framing ?? undefined}
            onSave={(chosen) => setFraming(chosen)}
            onClose={() => setFramerOpen(false)}
          />
        )}
        {photo && <img className="photo-preview" src={photoPreview} alt="The new photo" />}
        {/* Buttons like the pantry's photo (PantryPhotoField), not the
            browser's bare "Choose File". */}
        <div className="store-buttons">
          {canTakePhoto && (
            <label className="button small file-button">
              <span className="button-mark" aria-hidden="true">📷</span> Take a photo
              <input type="file" accept="image/*" capture="environment" onChange={pickPhoto} />
            </label>
          )}
          <label className="button small file-button">
            {photo || (existing?.image && !removePhoto) ? "Choose another photo" : "Choose a photo"}
            <input type="file" accept="image/*" onChange={pickPhoto} />
          </label>
          {photo && (
            <button type="button" className="button ghost small" onClick={() => setPhoto(null)}>
              Don't use this one
            </button>
          )}
        </div>
        {existing?.image && !photo && (
          <label className="inline">
            <input type="checkbox" checked={removePhoto} onChange={(e) => setRemovePhoto(e.target.checked)} />
            Remove current photo
          </label>
        )}
      </fieldset>

      {error && <p className="error">{error}</p>}
      <div className="actions">
        <Link to={existing ? `/recipes/${existing.id}` : "/"} className="button ghost">
          Cancel
        </Link>
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
