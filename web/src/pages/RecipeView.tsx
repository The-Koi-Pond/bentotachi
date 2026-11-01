import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import {
  cookedLog,
  displayName,
  errorMessage,
  pb,
  personStyle,
  recipes,
  useQuickMinutes,
  type CookedEntry,
  type MealPlanEntry,
  type PantryItem,
  type Recipe,
} from "../pb";
import { daysHad, nextPlanned } from "../cookHistory";
import NoteList from "../NoteList";
import { continuesNumbering, extraTimes, formatMinutes, headingOf, isQuick, linesToText, textToLines, totalMinutes } from "../format";
import { CartIcon, LinkIcon, PencilIcon, TimerIcon } from "../icons";
import { linkFor, linkKey, type IngredientLink } from "../pantryLinks";
import PantryLinkSheet from "../PantryLinkSheet";
import { useLiveRecords } from "../useLiveRecords";
import { addToShoppingList, addedMessage } from "../shoppingAdd";
import RecipeReactions, { FavoriteHeart, useRecipeRatings } from "../RecipeReactions";
import QuickBadge from "../QuickBadge";
import PlanButton from "../PlanButton";
import { datePart, formatDay, localToday, timeAgo, toStoredDate } from "../dates";
import { isOffline, saveRecipe, savedRecipes } from "../offline";
import OfflineNote from "../OfflineNote";
import { useCountry, useSingleUser, useTablespoon } from "../household";
import { withRegionalHint } from "../regionalNames";
import { withWeightHint } from "../weights";
import { recipeMeasures, withVolumeHint, type RecipeMeasures } from "../volumes";
import { withTemperatureHint } from "../temperatures";
import { withLengthHint } from "../lengths";
import QuickTags from "../QuickTags";
import { DetailsEditor, EditButton, TextEditor } from "../RecipeInlineEdit";
import SoftText from "../SoftText";
import { withoutSoftMarks } from "../softMarks";
import RecipePhoto from "../RecipePhoto";
import PhotoFramer from "../PhotoFramer";
import RecipeTimer from "../RecipeTimer";
import ScaleControl, { scaledServings } from "../ScaleControl";
import { scaleLine } from "../scaling";
import { stepTimes } from "../stepTimers";
import { startTimer, useStepTimers } from "../StepTimerTray";

// An ingredient or method line with soft hints for the household: weights,
// temperatures, lengths and liquids in its units ("1½ lbs (680 g)", "350°F
// (180°C)", "1-inch (2.5 cm)", "1 cup (240 ml)"), tablespoons in its spoons
// ("2 tbsp (your 1 tbsp + 2 tsp)") and its names ("bell pepper
// (capsicum)"). Only for showing: the saved line, its pantry link and the
// shopping list keep the original text.
interface Hints {
  country: string;
  measures: RecipeMeasures;
  tablespoon: number;
}

// The recipe's spoons and cups are guessed from its website (volumes.ts).
function useHints(sourceUrl: string): Hints {
  const [country] = useCountry();
  const [tablespoon] = useTablespoon();
  return { country, measures: recipeMeasures(sourceUrl), tablespoon };
}

const withHints = (line: string, { country, measures, tablespoon }: Hints) =>
  withRegionalHint(
    withLengthHint(
      withTemperatureHint(withWeightHint(withVolumeHint(line, country, measures, tablespoon), country), country),
      country,
    ),
    country,
  );

// Shown with the ingredient and method boxes.
const SOFT_HINT = " Select words and press B, I or U to make them bold, soft grey italics or underlined.";

// The parts of a recipe that can be changed right on its page.
type Part = "details" | "ingredients" | "steps" | "author_notes" | "notes";

export default function RecipeView() {
  const { id = "" } = useParams();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState("");
  const singleUser = useSingleUser();
  // For hints like "1 red bell pepper (capsicum)" in the household's words
  // and units.
  const hints = useHints(recipe?.source_url ?? "");
  // Ticked-off ingredients and steps, only for this cooking session.
  const [done, setDone] = useState<Set<string>>(new Set());
  const ratings = useRecipeRatings(id);
  // "We cooked this" days, shared by the history line and the timer.
  const cooked = useLiveRecords<CookedEntry>("cooked");
  const [cookError, setCookError] = useState("");
  const quickMinutes = useQuickMinutes();
  // Showing the phone's saved copy because the server can't be reached.
  const [offline, setOffline] = useState(false);
  // The part being changed right here, if any (one at a time).
  const [editing, setEditing] = useState<Part | null>(null);
  // The photo framer, opened by double-tapping (or double-clicking) the photo.
  const [framing, setFraming] = useState(false);
  // How much bigger or smaller the ingredients are shown (1 = as written),
  // only while this recipe is open.
  const [scale, setScale] = useState(1);
  // Countdowns started from steps (StepTimerTray.tsx), to show which run.
  const timers = useStepTimers();

  useEffect(() => {
    setScale(1);
    recipes()
      .getOne(id, { expand: "added_by" })
      .then((found) => {
        setRecipe(found);
        setOffline(false);
        saveRecipe(found);
      })
      .catch((err) => {
        if (!isOffline(err)) return setError(errorMessage(err));
        const saved = savedRecipes()?.find((r) => r.id === id);
        if (saved) {
          setRecipe(saved);
          setOffline(true);
        } else setError("You're offline, and this recipe isn't saved on this phone yet.");
      });
  }, [id]);

  function toggle(key: string) {
    setDone((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  if (error) return <p className="error">{error}</p>;
  if (!recipe) return <p className="muted">Loading…</p>;

  const current = recipe;
  // Saves changes to this recipe, showing them straight away and undoing
  // them if the server says no (the editor then shows why).
  async function save(changes: Partial<Recipe>) {
    setRecipe({ ...current, ...changes });
    try {
      const saved = await recipes().update(current.id, changes, { expand: "added_by" });
      setRecipe(saved);
      saveRecipe(saved);
      setEditing(null);
    } catch (err) {
      setRecipe(current);
      throw err;
    }
  }

  // "We cooked this" (or finishing the timer): today, by whoever's logged
  // in. Once a day is enough.
  const cookedToday = (cooked.items ?? []).some((entry) => entry.recipe === current.id && datePart(entry.date) === localToday());
  async function markCooked() {
    if (cookedToday) return;
    setCookError("");
    try {
      cooked.upsert(await cookedLog().create({ date: toStoredDate(localToday()), recipe: current.id, cooked_by: pb.authStore.record?.id }));
    } catch (err) {
      setCookError(`Couldn't mark it as cooked: ${errorMessage(err)}`);
    }
  }
  async function undoCooked(entries: CookedEntry[]) {
    setCookError("");
    try {
      for (const entry of entries) {
        await cookedLog().delete(entry.id);
        cooked.removeLocally(entry.id);
      }
    } catch (err) {
      setCookError(`Couldn't undo it: ${errorMessage(err)}`);
    }
  }

  // Each part's ✎, while nothing else is being changed (so no draft is lost).
  const editButton = (part: Part, label: string) =>
    !offline && editing === null ? <EditButton label={label} onClick={() => setEditing(part)} /> : null;
  const stopEditing = () => setEditing(null);

  // Prep, Cook, then any extra ones like "Cool", then Total.
  const times = [
    ["Prep", recipe.prep_minutes],
    ["Cook", recipe.cook_minutes],
    ...extraTimes(recipe).map((time) => [time.label, time.minutes]),
    ["Total", totalMinutes(recipe)],
  ].filter(([, minutes]) => minutes) as [string, number][];
  let stepNumber = 0;

  return (
    <article className="recipe stack">
      {offline && <OfflineNote />}
      {recipe.image && !offline && (
        <div className="hero-wrap">
          {/* Clips a zoomed photo to its box; the heart hangs over the edge. */}
          <span className="hero-clip">
            <RecipePhoto
              recipe={recipe}
              size="full"
              className="hero"
              title="Double-tap to adjust the photo"
              onDoubleClick={() => setFraming(true)}
            />
          </span>
          {isQuick(recipe, quickMinutes) && <QuickBadge size={20} />}
          <FavoriteHeart state={ratings} onPhoto />
        </div>
      )}
      {framing && (
        <PhotoFramer recipe={recipe} onSave={(image_framing) => save({ image_framing })} onClose={() => setFraming(false)} />
      )}
      {editing === "details" ? (
        <DetailsEditor recipe={recipe} onSave={save} onCancel={stopEditing} />
      ) : (
        <>
          <div className="title-row">
            <h1>{recipe.title}</h1>
            {!offline && (
              <span className="title-actions">
                <PlanButton recipe={recipe} />
                <Link to={`/recipes/${recipe.id}/edit`} className="button small">
                  <PencilIcon />
                  Edit
                </Link>
              </span>
            )}
          </div>
          {recipe.description && <DescriptionPreview key={recipe.id} text={recipe.description} />}

          <div className="facts-row">
            <dl className="facts">
              {recipe.servings && (
                <div>
                  <dt>Makes</dt>
                  <dd>{scaledServings(recipe.servings, scale)}</dd>
                </div>
              )}
              {times.map(([label, minutes], index) => (
                <div key={index}>
                  <dt>{label}</dt>
                  <dd>{formatMinutes(minutes)}</dd>
                </div>
              ))}
            </dl>
            {editButton("details", "Change the name, description, servings and times")}
          </div>
        </>
      )}
      {/* Timing it while cooking, to save how long it really takes. */}
      {!offline && editing !== "details" && <RecipeTimer recipe={recipe} onSave={save} onFinished={() => void markCooked()} />}

      <QuickTags
        tags={recipe.tags ?? []}
        content={[recipe.title, recipe.description, ...(recipe.ingredients ?? [])].join("\n")}
        canEdit={!offline}
        onSave={(tags) => save({ tags })}
      />

      {!offline && (
        <>
          <RecipeReactions state={ratings} showHeart={!recipe.image} />
          <CookHistory
            recipeId={recipe.id}
            cooked={cooked.items ?? []}
            onCooked={() => void markCooked()}
            onUndo={(entries) => void undoCooked(entries)}
          />
          {cookError && <p className="error">{cookError}</p>}
        </>
      )}

      {editing === "ingredients" ? (
        <section>
          <h2>Ingredients</h2>
          <TextEditor
            label="Ingredients"
            hint={"One per line. Start a line with # for a heading, like “# For the sauce”." + SOFT_HINT}
            initial={linesToText(recipe.ingredients)}
            rows={12}
            onSave={(text) => save({ ingredients: textToLines(text) })}
            onCancel={stopEditing}
          />
        </section>
      ) : (
        <IngredientsSection
          recipe={recipe}
          offline={offline}
          done={done}
          onToggleDone={toggle}
          onRecipeChange={setRecipe}
          editButton={editButton("ingredients", "Change the ingredients")}
          scale={scale}
          onScale={setScale}
        />
      )}

      <section>
        <div className="section-head">
          <h2>Method</h2>
          {editButton("steps", "Change the method")}
        </div>
        {editing === "steps" ? (
          <TextEditor
            label="Method"
            hint={
              "One step per line. A # heading starts the step numbers again at 1 (a separate part, like a sauce); a ## heading carries on counting." +
              SOFT_HINT
            }
            initial={linesToText(recipe.steps)}
            rows={12}
            onSave={(text) => save({ steps: textToLines(text) })}
            onCancel={stopEditing}
          />
        ) : (
          <ol className="steps">
            {(recipe.steps ?? []).map((line, i) => {
              const heading = headingOf(line);
              if (heading !== null) {
                // A # heading's steps count from 1 again, like recipe sites;
                // a ## heading's carry on from the steps before.
                if (!continuesNumbering(line)) stepNumber = 0;
                return (
                  <li key={i} className="list-heading">
                    <SoftText text={heading} />
                  </li>
                );
              }
              const key = `s${i}`;
              stepNumber += 1;
              const number = stepNumber;
              const times = stepTimes(withoutSoftMarks(line));
              return (
                <li key={i}>
                  <button className={`step ${done.has(key) ? "done" : ""}`} onClick={() => toggle(key)} aria-pressed={done.has(key)}>
                    <span className="step-number">{number}</span>
                    <span>
                      <SoftText text={withHints(line, hints)} />
                    </span>
                  </button>
                  {/* Beside the step, not inside it: the step itself is a button. */}
                  {times.length > 0 && (
                    <div className="step-timers">
                      {times.map((time) => {
                        const running = timers.some(
                          (t) => t.recipeId === recipe.id && t.step === number && t.label === time.label && !t.rang
                        );
                        return (
                          <button
                            key={time.label}
                            className="timer-chip"
                            onClick={() => startTimer(recipe.id, recipe.title, number, time)}
                            disabled={running}
                            aria-label={running ? `Step ${number}'s ${time.label} timer is running` : `Start a ${time.label} timer for step ${number}`}
                          >
                            <TimerIcon size={14} />
                            {running ? `${time.label}, running` : time.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {(recipe.author_notes || editing === "author_notes") && (
        <section>
          <div className="section-head">
            <h2>Author's notes</h2>
            {editButton("author_notes", "Change the author's notes")}
          </div>
          {editing === "author_notes" ? (
            <TextEditor
              label="Author's notes"
              hint="Tips from the recipe's writer, like swaps, storage or making ahead."
              initial={recipe.author_notes ?? ""}
              rows={6}
              onSave={(text) => save({ author_notes: text.trim() })}
              onCancel={stopEditing}
            />
          ) : (
            <NoteList text={recipe.author_notes} />
          )}
        </section>
      )}
      {(recipe.notes || editing === "notes") && (
        <section>
          <div className="section-head">
            <h2>Our notes</h2>
            {editButton("notes", "Change our notes")}
          </div>
          {editing === "notes" ? (
            <TextEditor
              label="Our notes"
              hint="Changes you made, what worked, what to try next time."
              initial={recipe.notes}
              rows={5}
              onSave={(text) => save({ notes: text.trim() })}
              onCancel={stopEditing}
            />
          ) : (
            <NoteList text={recipe.notes} />
          )}
        </section>
      )}
      {!offline && editing === null && (!recipe.notes || !recipe.author_notes) && (
        <p className="add-notes">
          {/* In the same order as the sections they add. */}
          {!recipe.author_notes && (
            <button className="link-button" onClick={() => setEditing("author_notes")}>
              + Add author's notes
            </button>
          )}
          {!recipe.notes && (
            <button className="link-button" onClick={() => setEditing("notes")}>
              + Add our notes
            </button>
          )}
        </p>
      )}

      {(recipe.source_url || (recipe.expand?.added_by && !singleUser)) && (
        <footer className="muted small-print">
          {recipe.source_url && (
            <p>
              From{" "}
              <a href={recipe.source_url} target="_blank" rel="noreferrer">
                {new URL(recipe.source_url).hostname.replace(/^www\./, "")}
              </a>
            </p>
          )}
          {recipe.expand?.added_by && !singleUser && (
            <p>
              Added by{" "}
              {/* Opens the recipe list showing everything they added. */}
              <Link
                to={`/?by=${recipe.added_by}`}
                className="person-name"
                style={personStyle(recipe.expand.added_by)}
                aria-label={`Recipes added by ${displayName(recipe.expand.added_by)}`}
              >
                {displayName(recipe.expand.added_by)}
              </Link>
            </p>
          )}
        </footer>
      )}
    </article>
  );
}

// Ingredients, with two modes: normally the boxes are for ticking things off
// while cooking; "Add to list" switches them to picking what to buy. Each
// line also shows its pantry item's status (Have / Low / Out), linked by a
// guess or by someone's choice; tapping it changes the link.
function IngredientsSection({
  recipe,
  offline,
  done,
  onToggleDone,
  onRecipeChange,
  editButton,
  scale,
  onScale,
}: {
  recipe: Recipe;
  // Offline, the pantry and shopping list can't be reached: just the list.
  offline: boolean;
  done: Set<string>;
  onToggleDone: (key: string) => void;
  onRecipeChange: (recipe: Recipe) => void;
  // The ✎ that changes the ingredients right here.
  editButton: ReactNode;
  // Amounts shown this many times as written (ScaleControl).
  scale: number;
  onScale: (scale: number) => void;
}) {
  const pantry = useLiveRecords<PantryItem>("pantry_items");
  const pantryList = pantry.items ?? [];
  const hints = useHints(recipe.source_url ?? "");
  const lines = recipe.ingredients ?? [];
  const pickable = lines.flatMap((line, i) => (headingOf(line) === null ? [i] : []));
  const [picking, setPicking] = useState(false);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);
  // The line whose pantry link is being changed.
  const [linking, setLinking] = useState<string | null>(null);

  const linkOf = (line: string) => linkFor(line, recipe.ingredient_links, pantryList);
  // Lines whose pantry item is low or out: "what we need".
  const needed = pickable.filter((i) => {
    const status = linkOf(lines[i]).item?.status;
    return status === "low" || status === "out";
  });

  function startPicking() {
    setPicking(true);
    setPicked(new Set());
    setStatus(null);
  }

  function togglePicked(index: number) {
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  // Saves someone's choice for a line (a pantry item id, or "" for "not a
  // pantry item"), showing it straight away. `added` is a pantry item just
  // made in the panel: it's added to this page's pantry list at once rather
  // than waiting for the live update (which may never come on a weak
  // connection), or the line would look unlinked.
  async function chooseLink(line: string, pantryItemId: string, added?: PantryItem) {
    setLinking(null);
    setStatus(null);
    if (added) pantry.upsert(added);
    const key = linkKey(line);
    const links = { ...(recipe.ingredient_links ?? {}), [key]: pantryItemId };
    const before = recipe;
    onRecipeChange({ ...recipe, ingredient_links: links });
    try {
      const saved = await recipes().update(recipe.id, { ingredient_links: links }, { expand: "added_by" });
      // A server that hasn't been restarted since links were added to Bento
      // says "saved" but quietly drops them.
      if (saved.ingredient_links?.[key] !== pantryItemId) {
        onRecipeChange(before);
        setStatus({
          text: "The server didn't keep that link. It needs restarting: close the Bento server window and open Start Bento.bat again.",
          isError: true,
        });
        return;
      }
      onRecipeChange(saved);
    } catch (err) {
      onRecipeChange(before);
      setStatus({ text: errorMessage(err), isError: true });
    }
  }

  async function addPicked() {
    setBusy(true);
    setStatus(null);
    try {
      const things = [...picked]
        .sort((a, b) => a - b)
        .map((index) => {
          const { item } = linkOf(lines[index]);
          // Linked lines go on the list as the pantry item ("Onion", not
          // "2 onions, diced"), linked so buying it marks it as Have again.
          return {
            text: item ? item.name : withoutSoftMarks(scaleLine(lines[index], scale)),
            pantryItem: item?.id ?? "",
            recipe: recipe.id,
          };
        });
      setStatus({ text: addedMessage(await addToShoppingList(things)), isError: false });
      setPicking(false);
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
    } finally {
      setBusy(false);
    }
  }

  const allPicked = picked.size === pickable.length;

  return (
    <section>
      <div className="section-head">
        <h2>Ingredients</h2>
        {!picking && editButton}
      </div>
      {picking ? (
        <p className="muted">Tick what you need to buy.</p>
      ) : (
        pickable.length > 0 && <ScaleControl servings={recipe.servings ?? ""} factor={scale} onChange={onScale} />
      )}

      <ul className={`checklist ${picking ? "picking" : ""}`}>
        {lines.map((line, i) => {
          const heading = headingOf(line);
          if (heading !== null)
            return (
              <li key={i} className="list-heading">
                <SoftText text={heading} />
              </li>
            );
          const key = `i${i}`;
          return (
            <li key={i} className="ingredient-row">
              {picking ? (
                <label>
                  <input type="checkbox" checked={picked.has(i)} onChange={() => togglePicked(i)} />
                  <SoftText text={withHints(scaleLine(line, scale), hints)} />
                </label>
              ) : (
                <label className={done.has(key) ? "done" : ""}>
                  <input type="checkbox" checked={done.has(key)} onChange={() => onToggleDone(key)} />
                  <SoftText text={withHints(scaleLine(line, scale), hints)} />
                </label>
              )}
              {pantry.items && <PantryChip line={line} link={linkOf(line)} onClick={() => setLinking(line)} />}
            </li>
          );
        })}
      </ul>

      {/* Under the list, where picking's own buttons then appear. */}
      {!picking && !offline && pickable.length > 0 && (
        <button className="button add-to-list" onClick={startPicking}>
          <CartIcon size={18} />
          Add to shopping list
        </button>
      )}
      {picking && (
        <div className="actions">
          {needed.length > 0 && (
            <button className="button" onClick={() => setPicked(new Set(needed))}>
              Select what we need ({needed.length})
            </button>
          )}
          <button className="button" onClick={() => setPicked(new Set(allPicked ? [] : pickable))}>
            {allPicked ? "Select none" : "Select all"}
          </button>
          <button className="button ghost" onClick={() => setPicking(false)} disabled={busy}>
            Cancel
          </button>
          <button className="button primary" disabled={picked.size === 0 || busy} onClick={addPicked}>
            {busy ? "Adding…" : picked.size ? `Add ${picked.size} to shopping list` : "Add to shopping list"}
          </button>
        </div>
      )}
      {status && (
        <p className={status.isError ? "error" : "success"} role="status">
          {status.text} {!status.isError && <Link to="/shopping">Open the list</Link>}
        </p>
      )}

      {linking !== null && (
        <PantryLinkSheet
          line={linking}
          current={linkOf(linking)}
          items={pantryList}
          onChoose={(id, added) => void chooseLink(linking, id, added)}
          onClose={() => setLinking(null)}
        />
      )}
    </section>
  );
}

const STATUS_WORDS = { have: "Have", low: "Low", out: "Out" } as const;

// The pantry status beside an ingredient: "● Have" / "● Low" / "● Out" when
// it's linked (a dotted outline means Bento guessed), or a faint link button
// when it isn't. Tapping either changes the link.
function PantryChip({ line, link, onClick }: { line: string; link: IngredientLink; onClick: () => void }) {
  if (!link.item) {
    return (
      <button
        className="pantry-link-button"
        onClick={onClick}
        aria-label={`Link “${line}” to the pantry`}
        title={link.kind === "notPantry" ? "Not a pantry item (tap to change)" : "Link to the pantry"}
      >
        <LinkIcon />
      </button>
    );
  }
  const status = link.item.status;
  const description = `${link.item.name}: ${STATUS_WORDS[status]}${link.kind === "guessed" ? " (guessed)" : ""}. Tap to change.`;
  return (
    <button
      className={`pantry-chip status-${status} ${link.kind === "guessed" ? "guessed" : ""}`}
      onClick={onClick}
      aria-label={`Pantry: ${description}`}
      title={description}
    >
      <span className={`status-dot status-${status}`} aria-hidden="true" />
      {STATUS_WORDS[status]}
    </button>
  );
}

// The description, cut to a few lines. Tapping the box (or "Show more")
// opens the full text; the button only appears when there's more to show.
function DescriptionPreview({ text }: { text: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const textRef = useRef<HTMLParagraphElement>(null);

  // Measure while it's cut short, and again if the screen size changes.
  useLayoutEffect(() => {
    const element = textRef.current;
    if (!element || expanded) return;
    const measure = () => setOverflows(element.scrollHeight > element.clientHeight + 1);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [text, expanded]);

  function toggle() {
    // Don't snap shut while someone is selecting text to copy it.
    if (window.getSelection()?.toString()) return;
    setExpanded((value) => !value);
  }

  return (
    <div className={`description-box ${overflows ? "expandable" : ""}`} onClick={overflows ? toggle : undefined}>
      <p ref={textRef} className={expanded ? "description" : "description clamped"}>
        <SoftText text={text} />
      </p>
      {overflows && (
        <button
          type="button"
          className="link-button"
          aria-expanded={expanded}
          onClick={(event) => {
            event.stopPropagation();
            setExpanded((value) => !value);
          }}
        >
          {expanded ? "Show less" : "Show more"}
        </button>
      )}
    </div>
  );
}

// When we last had this, going by past nights on the dinner plan, and when
// it's next planned: "Last had 2 weeks ago (Tue, Oct 14) · 3 times · Next: Mon, Nov 2".
// Counted from past nights on the dinner plan and "We cooked this" (see
// cookHistory.ts). The button records today; once it has, it offers Undo.
function CookHistory({
  recipeId,
  cooked,
  onCooked,
  onUndo,
}: {
  recipeId: string;
  cooked: CookedEntry[];
  onCooked: () => void;
  onUndo: (entries: CookedEntry[]) => void;
}) {
  const plan = useLiveRecords<MealPlanEntry>("meal_plan");
  const planned = plan.items ?? [];
  const today = localToday();
  const days = daysHad(recipeId, planned, cooked, today);
  const next = nextPlanned(recipeId, planned, cooked, today);
  const last = days[days.length - 1];
  const cookedToday = cooked.filter((entry) => entry.recipe === recipeId && datePart(entry.date) === today);
  return (
    <div className="cook-history">
      <p className="muted plan-history">
        {last && (
          <>
            {last === today ? "Had today" : `Last had ${timeAgo(last, today)} (${formatDay(last)})`}
            {days.length > 1 && ` · ${days.length} times`}
          </>
        )}
        {last && next && " · "}
        {next && (
          <>
            Next: <Link to="/plan">{next === today ? "today" : formatDay(next)}</Link>
          </>
        )}
        {!last && !next && "Not cooked yet"}
      </p>
      {cookedToday.length ? (
        <button className="link-button cooked-undo" onClick={() => onUndo(cookedToday)}>
          Undo “cooked today”
        </button>
      ) : (
        <button className="button small cooked-button" onClick={onCooked}>
          <span className="button-mark" aria-hidden="true">✓</span> We cooked this
        </button>
      )}
    </div>
  );
}
