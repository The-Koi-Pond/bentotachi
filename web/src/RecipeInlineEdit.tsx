import { useState, type FormEvent } from "react";
import { errorMessage, type Recipe } from "./pb";
import { PencilIcon } from "./icons";
import ExtraTimesEditor, { fromRows, toRows } from "./ExtraTimesEditor";
import FormatTextarea from "./FormatTextarea";
import { confirmDiscard, useUnsavedChanges } from "./unsavedChanges";

// Editing one part of a recipe right on its page, instead of the Edit page:
// a ✎ beside the part's heading opens a box for just that part, with Save
// and Cancel.

export function EditButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button className="icon-button small section-edit" onClick={onClick} aria-label={label} title={label}>
      <PencilIcon />
    </button>
  );
}

function useSaving(onSave: () => Promise<void>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await onSave();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }
  return { busy, error, submit };
}

function SaveButtons({ busy, error, onCancel }: { busy: boolean; error: string; onCancel: () => void }) {
  return (
    <>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="button" className="button ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </button>
        <button className="button primary" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </>
  );
}

// A text box for one part (ingredients, method, notes), filled with it.
export function TextEditor({
  label,
  hint,
  initial,
  rows,
  onSave,
  onCancel,
}: {
  label: string;
  hint?: string;
  initial: string;
  rows: number;
  onSave: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  const dirty = text !== initial;
  useUnsavedChanges(dirty);
  const { busy, error, submit } = useSaving(() => onSave(text));
  return (
    <form className="stack inline-editor" onSubmit={submit}>
      {hint && <p className="hint">{hint}</p>}
      <FormatTextarea
        rows={rows}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && confirmDiscard(dirty) && onCancel()}
        aria-label={label}
        autoFocus
      />
      <SaveButtons busy={busy} error={error} onCancel={onCancel} />
    </form>
  );
}

// The recipe's name, description, servings and times.
export function DetailsEditor({
  recipe,
  onSave,
  onCancel,
}: {
  recipe: Recipe;
  onSave: (changes: Partial<Recipe>) => Promise<void>;
  onCancel: () => void;
}) {
  const minutes = (n: number) => (n ? String(n) : "");
  const [title, setTitle] = useState(recipe.title);
  const [description, setDescription] = useState(recipe.description);
  const [servings, setServings] = useState(recipe.servings);
  const [prep, setPrep] = useState(minutes(recipe.prep_minutes));
  const [cook, setCook] = useState(minutes(recipe.cook_minutes));
  const [total, setTotal] = useState(minutes(recipe.total_minutes));
  const [extras, setExtras] = useState(() => toRows(recipe));
  // Changed from how it opened?
  const now = JSON.stringify([title, description, servings, prep, cook, total, extras]);
  const [opened] = useState(now);
  const dirty = now !== opened;
  useUnsavedChanges(dirty);
  const { busy, error, submit } = useSaving(() =>
    onSave({
      title: title.trim(),
      description: description.trim(),
      servings: servings.trim(),
      prep_minutes: Number(prep) || 0,
      cook_minutes: Number(cook) || 0,
      total_minutes: Number(total) || 0,
      extra_times: fromRows(extras),
    }),
  );
  return (
    <form
      className="card stack inline-editor"
      onSubmit={submit}
      onKeyDown={(e) => e.key === "Escape" && confirmDiscard(dirty) && onCancel()}
    >
      <label>
        Name
        <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
      </label>
      <label>
        <span className="label-text">
          Short description <span className="optional">(optional)</span>
        </span>
        <FormatTextarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="row">
        <label>
          Makes
          <input placeholder="4 servings" value={servings} onChange={(e) => setServings(e.target.value)} />
        </label>
        <label>
          Prep (min)
          <input type="number" min={0} inputMode="numeric" value={prep} onChange={(e) => setPrep(e.target.value)} />
        </label>
        <label>
          Cook (min)
          <input type="number" min={0} inputMode="numeric" value={cook} onChange={(e) => setCook(e.target.value)} />
        </label>
        <label>
          Total (min)
          <input type="number" min={0} inputMode="numeric" value={total} onChange={(e) => setTotal(e.target.value)} />
        </label>
      </div>
      <ExtraTimesEditor rows={extras} onChange={setExtras} />
      <SaveButtons busy={busy} error={error} onCancel={onCancel} />
    </form>
  );
}
