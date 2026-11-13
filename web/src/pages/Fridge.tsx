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
  useCurrentUser,
  type Note,
  type User,
} from "../pb";
import { useLiveRecords } from "../useLiveRecords";
import { notesCopy } from "../offline";
import OfflineNote from "../OfflineNote";
import { useUndo } from "../undo";
import { showError } from "../toast";
import { usePlanMeals, useSingleUser } from "../household";
import { isPhoneMode } from "../phoneMode";
import { addDays, localToday, serverDate, toStoredDate } from "../dates";
import {
  happenings,
  magnetOf,
  newestCreated,
  noteAge,
  noteWear,
  planSummary,
  randomSplash,
  shortList,
  type Happening,
  type MagnetKind,
} from "../fridgeDoor";
import { markFridgeSeen } from "../fridgeSeen";
import { CheckIcon } from "../icons";
import { lessMotion } from "../motion";
import { BenMood } from "../Brand";
import { useUnsavedChanges } from "../unsavedChanges";

// The fridge door: the title opens it (App.tsx). A splash line, notes the
// household leaves for each other, and what's been happening lately. On your
// own (phone-only, or the only account) it's notes to yourself, without the
// "Lately" part, which would only be about you.
export default function Fridge() {
  const [splash] = useState(() => randomSplash());
  const singleUser = useSingleUser();
  const solo = isPhoneMode() || singleUser;
  const list = useLiveRecords<Note>("notes", { expand: "added_by", copy: notesCopy });
  const undo = useUndo();

  // Opening the page (and staying on it while notes arrive) reads them.
  useEffect(() => {
    if (list.items) markFridgeSeen(newestCreated(list.items));
  }, [list.items]);

  const shown = [...(list.items ?? [])].filter((note) => !undo.hidden.has(note.id)).sort((a, b) => b.created.localeCompare(a.created));
  // A note being peeled off (Done), for the moment before it's gone.
  const [peeling, setPeeling] = useState<string | null>(null);
  const now = new Date();

  // Done: the note peels off, then is taken down (with Undo). Straight away
  // for anyone who has the phone set to reduce motion.
  function peel(note: Note) {
    if (lessMotion()) return takeDown(note);
    setPeeling(note.id);
    window.setTimeout(() => {
      setPeeling(null);
      takeDown(note);
    }, 320);
  }

  function takeDown(note: Note) {
    undo.offer([note.id], "Note's down, magnet's free.", async () => {
      list.removeLocally(note.id);
      try {
        await notesCollection().delete(note.id);
      } catch (err) {
        showError(errorMessage(err));
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

      {list.loadError && <p className="error">{list.loadError}</p>}
      {list.offline && <OfflineNote>Showing the notes saved on this phone. Writing or taking down notes needs a connection.</OfflineNote>}
      {/* The door itself (docs/VISION.md, "The fridge door"): an enamel
          panel with a handle, a blank note to write on, the notes stuck on
          it. */}
      <div className="fridge-door">
        <NoteForm solo={solo} onPosted={list.upsert} />
        {list.items &&
          (shown.length === 0 ? (
            <div className="fridge-empty">
              <span className="fridge-spare-magnets" aria-hidden="true">
                <Magnet kind="plum" />
                <Magnet kind="leaf" />
                <Magnet kind="onigiri" />
              </span>
              <BenMood mood="ready" small />
              <p className="muted">Nothing on the fridge yet. Suspiciously tidy.</p>
            </div>
          ) : (
            <ul className="fridge-notes">
              {shown.map((note) => {
                // The note is on paper in its writer's colour; someone
                // without one gets one of three papers.
                const paper = personStyle(note.expand?.added_by);
                return (
                <li
                  key={note.id}
                  className={`fridge-note ${paper ? "person-paper" : `paper-${paperOf(note.id)}`} wear-${noteWear(note.created, now)} ${peeling === note.id ? "peeling" : ""}`}
                  style={paper}
                >
                  <Magnet kind={magnetOf(note.id)} />
                  <p className="fridge-note-text">{note.text}</p>
                  <div className="fridge-note-meta">
                    <span className="muted">
                      {!solo && note.expand?.added_by && (
                        <>
                          <Person user={note.expand.added_by} />
                          {" · "}
                        </>
                      )}
                      {noteAge(note.created, now)}
                    </span>
                    {/* Offline (the notes saved on this phone), taking one
                        down would fail, and look done. */}
                    {!list.offline && (
                      <button
                        className="button small ghost"
                        onClick={() => peel(note)}
                        disabled={peeling === note.id}
                        aria-label={`Take down “${note.text.slice(0, 40)}”`}
                      >
                        <CheckIcon /> Done
                      </button>
                    )}
                  </div>
                </li>
                );
              })}
            </ul>
          ))}
      </div>

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

// A fridge magnet: a plum, a leaf, an onigiri, or a tiny Ben. Always in its
// own colours: the note under it is in its writer's.
function Magnet({ kind }: { kind: MagnetKind }) {
  return (
    <svg className={`fridge-magnet magnet-${kind}`} viewBox="0 0 24 24" aria-hidden="true">
      {kind === "plum" && (
        <>
          <circle cx="12" cy="12" r="8" fill="#a82d4a" />
          <ellipse cx="9.5" cy="9" rx="2.4" ry="1.6" fill="#fff" opacity="0.35" />
        </>
      )}
      {kind === "leaf" && (
        <>
          <path d="M4 18C4 9 10 4 20 4c0 10-5 16-14 16z" fill="#5a9a8a" />
          <path d="M6 18L16 8" stroke="#fff" strokeOpacity="0.4" strokeWidth="1.2" />
        </>
      )}
      {(kind === "onigiri" || kind === "ben") && (
        <>
          <path d="M12 3c2 0 9 11 9 14s-3 4-9 4-9-1-9-4 7-14 9-14z" fill="#fffdf6" stroke="#3a2f28" strokeWidth="1.2" />
          <rect x="8" y="14" width="8" height="7" rx="1" fill="#24312d" />
          {kind === "ben" && (
            <>
              <circle cx="9.5" cy="11" r="1" fill="#3a2f28" />
              <circle cx="14.5" cy="11" r="1" fill="#3a2f28" />
              <ellipse cx="12" cy="16" rx="2" ry="1.6" fill="#3a2f28" />
            </>
          )}
        </>
      )}
    </svg>
  );
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
  // A note written but not stuck up yet: leaving asks first, as the other
  // add boxes do.
  useUnsavedChanges(text.trim() !== "");
  // The blank note is your next one, so it's on your paper.
  const paper = personStyle(useCurrentUser() ?? undefined);

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
    // A fresh note waiting for words, the button under it (docs/VISION.md).
    <form className={paper ? "fridge-form person-paper" : "fridge-form"} style={paper} onSubmit={post}>
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
      {error && <p className="error" role="alert">{error}</p>}
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
    const since = serverDate(new Date(Date.now() - 7 * 86_400_000));
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
      {error && <p className="error" role="alert">{error}</p>}
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
