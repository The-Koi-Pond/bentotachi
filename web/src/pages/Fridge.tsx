import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";
import {
  cookedLog,
  displayName,
  errorMessage,
  mealPlan,
  notes as notesCollection,
  pantryItems,
  pb,
  personStyle,
  recipes,
  type Note,
  type User,
} from "../pb";
import { useLiveRecords } from "../useLiveRecords";
import { useUndo } from "../undo";
import { usePlanMeals, useSingleUser } from "../household";
import { isPhoneMode } from "../phoneMode";
import { addDays, localToday, toStoredDate } from "../dates";
import { happenings, newestCreated, noteAge, planSummary, randomSplash, shortList, type Happening } from "../fridgeDoor";
import { markFridgeSeen } from "../fridgeSeen";
import { CheckIcon } from "../icons";

// The fridge door: the title opens it (App.tsx). A splash line, notes the
// household leaves for each other, and what's been happening lately. On your
// own (phone-only, or the only account) it's notes to yourself, without the
// "Lately" part, which would only be about you.
export default function Fridge() {
  const [splash] = useState(() => randomSplash());
  const singleUser = useSingleUser();
  const solo = isPhoneMode() || singleUser;
  const list = useLiveRecords<Note>("notes", "added_by");
  const undo = useUndo();
  const [error, setError] = useState("");

  // Opening the page (and staying on it while notes arrive) reads them.
  useEffect(() => {
    if (list.items) markFridgeSeen(newestCreated(list.items));
  }, [list.items]);

  const shown = [...(list.items ?? [])].filter((note) => !undo.hidden.has(note.id)).sort((a, b) => b.created.localeCompare(a.created));

  function takeDown(note: Note) {
    setError("");
    undo.offer([note.id], "Took the note down.", async () => {
      list.removeLocally(note.id);
      try {
        await notesCollection().delete(note.id);
      } catch (err) {
        setError(errorMessage(err));
        list.reload();
      }
    });
  }

  return (
    <div className="stack narrow">
      <div className="fridge-heading">
        <h1>The fridge door</h1>
        <p className="fridge-splash">{splash}</p>
      </div>

      <NoteForm solo={solo} onPosted={list.upsert} />

      {list.loadError && <p className="error">{list.loadError}</p>}
      {error && <p className="error">{error}</p>}
      {list.items && shown.length === 0 && (
        // A dashed outline where the notes would go, so it doesn't float.
        // The note box just above says what to do.
        <p className="muted fridge-empty">Nothing here yet.</p>
      )}
      {shown.length > 0 && (
        <ul className="fridge-notes">
          {shown.map((note) => (
            <li
              key={note.id}
              className={`fridge-note paper-${paperOf(note.id)}`}
              // The magnet in their colour (wood on your own).
              style={solo ? undefined : personStyle(note.expand?.added_by)}
            >
              <p className="fridge-note-text">{note.text}</p>
              <div className="fridge-note-meta">
                <span className="muted">
                  {!solo && note.expand?.added_by && (
                    <>
                      <Person user={note.expand.added_by} />
                      {" · "}
                    </>
                  )}
                  {noteAge(note.created, new Date())}
                </span>
                <button className="button small ghost" onClick={() => takeDown(note)} aria-label={`Take down “${note.text.slice(0, 40)}”`}>
                  <CheckIcon /> Done
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!solo && <Lately />}
      {undo.toast}
    </div>
  );
}

// Which of the three papers a note is on: from its id, so it keeps its
// colour when another note is taken down.
function paperOf(id: string): number {
  let sum = 0;
  for (const char of id) sum += char.charCodeAt(0);
  return sum % 3;
}

function Person({ user }: { user: User }) {
  return (
    <span className="person-name" style={personStyle(user)}>
      {displayName(user)}
    </span>
  );
}

function NoteForm({ solo, onPosted }: { solo: boolean; onPosted: (note: Note) => void }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function post(event: FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    setError("");
    try {
      onPosted(await notesCollection().create({ text: text.trim(), added_by: pb.authStore.record?.id }, { expand: "added_by" }));
      setText("");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack fridge-form" onSubmit={post}>
      {/* No heading: the box says who it's for in its placeholder; the
          label stays for screen readers. */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        maxLength={500}
        rows={2}
        aria-label={solo ? "A note to yourself" : "A note for everyone"}
        placeholder={
          solo ? "A note to yourself, like “Defrost the chicken tonight”" : "A note for everyone, like “Don't buy eggs, I got two dozen”"
        }
      />
      {error && <p className="error">{error}</p>}
      <button className="button primary end-button" disabled={busy || !text.trim()}>
        {busy ? "Sticking it up…" : "Stick it on the fridge"}
      </button>
    </form>
  );
}

// What's been happening: the week's plan, what's run out, and recipes added
// or cooked in the last 7 days. Loaded once when the page opens.
function Lately() {
  const [meals] = usePlanMeals();
  // A new list each render, so the effect below follows its contents.
  const mealsKey = meals.join(",");
  const [data, setData] = useState<{ plan: string; out: string[]; items: Happening[]; people: Map<string, User> } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const today = localToday();
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString().replace("T", " ");
    Promise.all([
      recipes().getList(1, 8, { filter: pb.filter("created >= {:since}", { since }), sort: "-created", expand: "added_by" }),
      cookedLog().getList(1, 8, { filter: pb.filter("created >= {:since}", { since }), sort: "-created", expand: "recipe,cooked_by" }),
      mealPlan().getFullList({
        filter: pb.filter("date >= {:from} && date < {:to}", { from: toStoredDate(today), to: toStoredDate(addDays(today, 7)) }),
      }),
      pantryItems().getFullList({ filter: 'status = "out"', fields: "id,name" }),
    ])
      .then(([added, cooked, plan, out]) => {
        const people = new Map<string, User>();
        for (const r of added.items) if (r.expand?.added_by) people.set(r.added_by, r.expand.added_by);
        for (const c of cooked.items) {
          const who = (c.expand as { cooked_by?: User } | undefined)?.cooked_by;
          if (who) people.set(c.cooked_by, who);
        }
        setData({
          plan: planSummary(plan, today, meals),
          out: out.map((item) => item.name),
          items: happenings(
            added.items.map((r) => ({ id: r.id, created: r.created, added_by: r.added_by, title: r.title })),
            cooked.items
              .map((c) => ({ ...c, title: (c.expand as { recipe?: { title: string } } | undefined)?.recipe?.title ?? "" }))
              .filter((c) => c.title)
          ),
          people,
        });
      })
      .catch((err) => setError(errorMessage(err)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mealsKey]);

  return (
    <section className="card stack">
      <h2>Lately</h2>
      {error && <p className="error">{error}</p>}
      {!data && !error && <p className="muted">Having a look…</p>}
      {data && (
        <ul className="fridge-lately">
          <li>
            <Link to="/plan" className="fridge-lately-link">
              {data.plan}
            </Link>
          </li>
          {data.out.length > 0 && (
            <li>
              Run out:{" "}
              <Link to="/pantry" className="fridge-lately-link">
                {shortList(data.out)}
              </Link>
            </li>
          )}
          {data.items.map((item) => {
            const who = data.people.get(item.who);
            return (
              <li key={`${item.kind}-${item.id}`}>
                {who ? <Person user={who} /> : "Someone"} {item.kind === "added" ? "added" : "cooked"}{" "}
                <Link to={`/recipes/${item.recipeId}`}>{item.title}</Link>
                <span className="muted"> · {noteAge(item.when, new Date())}</span>
              </li>
            );
          })}
          {data.items.length === 0 && <li className="muted">No recipes added or cooked this week. Suspiciously quiet.</li>}
        </ul>
      )}
    </section>
  );
}
