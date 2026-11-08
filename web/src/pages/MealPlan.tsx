import { Fragment, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { errorMessage, mealPlan, pb, type CookedEntry, type MealPlanEntry, type Recipe } from "../pb";
import RecipePhoto from "../RecipePhoto";
import { lastHadByRecipe } from "../cookHistory";
import {
  addDays,
  addMonths,
  datePart,
  dayNumber,
  firstDayFor,
  formatDay,
  localToday,
  monthStart,
  toStoredDate,
  weekStart,
  type FirstDay,
} from "../dates";
import { CartIcon, CloseIcon, GripIcon } from "../icons";
import { useLiveRecords } from "../useLiveRecords";
import RecipeChooser from "../RecipeChooser";
import WeekShoppingSheet from "../WeekShoppingSheet";
import { useUndo } from "../undo";
import { useCountry, usePlanMeals } from "../household";
import {
  MEALS,
  MEAL_NAMES,
  dishesBySlot,
  dropSwaps,
  mealOf,
  mealWord,
  mealsForDay,
  parseSlot,
  planTitle,
  slotKey,
  type Meal,
} from "../meals";

// How many days are shown at once: two weeks, from yesterday.
const DAYS_SHOWN = 14;

// One meal on one day.
interface Slot {
  date: string;
  meal: Meal;
}

// A meal lands on the place under your finger (or mouse). With the
// keyboard there is no pointer, so it goes to the nearest one instead.
const dropTarget: CollisionDetection = (args) => {
  const underPointer = pointerWithin(args);
  return underPointer.length > 0 ? underPointer : closestCenter(args);
};

type View = "list" | "month";
const VIEW_KEY = "bento.planView";

function savedView(): View {
  try {
    return localStorage.getItem(VIEW_KEY) === "month" ? "month" : "list";
  } catch {
    return "list";
  }
}

// The meal plan, as a two-week list (one row per day) or a month grid. Each
// day has a place for each of the household's meals (just dinner, unless
// breakfast or lunch are turned on under Household). In both views, meals
// can be dragged to another place; if that place already has one, they swap.
export default function MealPlan() {
  const plan = useLiveRecords<MealPlanEntry>("meal_plan", "recipe");
  const cooked = useLiveRecords<CookedEntry>("cooked");
  const [meals] = usePlanMeals();
  // Weeks start on Sunday in the US, Monday elsewhere.
  const firstDay = firstDayFor(useCountry()[0]);
  const today = localToday();
  const [view, setView] = useState<View>(savedView);
  // The list's first day, or null for yesterday: the list opens with today
  // near the top, yesterday just above it (Xel, 2026-11-08; it used to open
  // at the week's first day and scroll to today, which late in the week
  // looked like the bottom of the page to a tester).
  const [chosenStart, setStart] = useState<string | null>(null);
  const start = chosenStart ?? addDays(today, -1);
  const [month, setMonth] = useState(() => monthStart(today));
  // Month view: the day whose details show under the grid.
  const [selected, setSelected] = useState(today);
  const [picking, setPicking] = useState<Slot | null>(null);
  const [dragging, setDragging] = useState<MealPlanEntry | null>(null);
  const [shoppingOpen, setShoppingOpen] = useState(false);
  const [error, setError] = useState("");
  // Removing a night shows "Undo" for a moment before it really happens.
  const undo = useUndo();

  function changeView(next: View) {
    setView(next);
    setPicking(null);
    try {
      localStorage.setItem(VIEW_KEY, next);
    } catch {
      // Not remembered; it'll start on the list next time.
    }
  }

  // Drag from the handle with a mouse or finger (after moving a few pixels,
  // so a tap isn't a drag), or with the keyboard (Space, arrows, Space).
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor)
  );

  // Opens at the top, title and all, with today second in the list (a page
  // scrolled down before would otherwise leave it scrolled); so does
  // "Today". Once per opening, so it never jumps while you're scrolling.
  const showTop = useRef(true);
  const loaded = !!plan.items;
  useEffect(() => {
    if (!loaded || !showTop.current) return;
    showTop.current = false;
    window.scrollTo({ top: 0 });
  });

  if (!plan.items) return plan.loadError ? <p className="error">{plan.loadError}</p> : <p className="muted">Loading the plan…</p>;

  // Each place's dishes ("2026-11-02|lunch": a main and its sides, in the
  // order added), and each day's in plan order (for the month grid).
  const shown = plan.items.filter((entry) => !undo.hidden.has(entry.id));
  const bySlot = dishesBySlot(shown);
  const byDate = new Map<string, MealPlanEntry[]>();
  for (const meal of MEALS) {
    for (const [key, dishes] of bySlot) {
      const place = parseSlot(key);
      if (place.meal === meal) byDate.set(place.date, [...(byDate.get(place.date) ?? []), ...dishes]);
    }
  }
  const mealsOn = (date: string) => mealsForDay(meals, (meal) => bySlot.has(slotKey(date, meal)));
  const dishesAt = (date: string, meal: Meal) => bySlot.get(slotKey(date, meal)) ?? [];
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDays(start, i));
  const word = mealWord(meals);

  // For the chooser: which recipes are already planned from today on, and when.
  const upcoming = new Map<string, string[]>();
  for (const [date, entries] of [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    for (const entry of entries)
      if (date >= today && entry.recipe) upcoming.set(entry.recipe, [...(upcoming.get(entry.recipe) ?? []), date]);
  }
  // And when each recipe was last had: on the plan before today, or marked
  // "We cooked this" (see cookHistory.ts).
  const lastHad = lastHadByRecipe(plan.items, cooked.items ?? [], today);

  // Plans a meal: a recipe, or a note like "Take-away night" instead.
  async function add({ date, meal }: Slot, what: { recipe: Recipe } | { note: string }) {
    setPicking(null);
    setError("");
    try {
      // A dish just removed goes first, so Undo can't bring it back beside.
      await undo.settle();
      plan.upsert(
        await mealPlan().create(
          {
            date: toStoredDate(date),
            meal,
            recipe: "recipe" in what ? what.recipe.id : "",
            note: "note" in what ? what.note : "",
            added_by: pb.authStore.record?.id,
          },
          { expand: "recipe" }
        )
      );
    } catch (err) {
      // A server from before several dishes per meal refuses a second one.
      const fields = (err as { response?: { data?: Record<string, { code?: string }> } }).response?.data ?? {};
      const notUnique = Object.values(fields).some((field) => field?.code === "validation_not_unique");
      setError(
        notUnique
          ? `This Bentotachi server holds one dish per ${meal}. Once it's updated, sides can go with the main.`
          : errorMessage(err)
      );
    }
  }

  function remove(entry: MealPlanEntry) {
    setError("");
    const what = entry.expand?.recipe?.title ?? entry.note;
    undo.offer([entry.id], what ? `Removed “${what}” from the plan.` : "Removed from the plan.", async () => {
      plan.removeLocally(entry.id);
      try {
        await mealPlan().delete(entry.id);
      } catch (err) {
        setError(errorMessage(err));
        plan.reload();
      }
    });
  }

  // Moves a dish to another place (another day, or another meal). A lone
  // dish onto a place with one other swaps with it (dropSwaps in meals.ts):
  // a swap trades the two entries' contents (recipe and note), so each
  // place keeps its own entry. Otherwise it joins the dishes there.
  async function move(entryId: string, to: string) {
    const moving = shown.find((entry) => entry.id === entryId);
    if (!moving) return;
    const from = slotKey(datePart(moving.date), mealOf(moving));
    if (from === to) return;
    const others = bySlot.get(to) ?? [];
    const there = dropSwaps((bySlot.get(from) ?? []).length, others.length) ? others[0] : undefined;
    const target = parseSlot(to);
    setError("");
    // Onto a place whose meal was just removed: that one goes first.
    await undo.settle();
    if (there) {
      plan.upsert({ ...moving, recipe: there.recipe, note: there.note, expand: there.expand });
      plan.upsert({ ...there, recipe: moving.recipe, note: moving.note, expand: moving.expand });
    } else {
      plan.upsert({ ...moving, date: toStoredDate(target.date), meal: target.meal });
    }
    try {
      if (there) {
        // One request, so both are saved or neither (pb_hooks/meal_plan.pb.js).
        try {
          await pb.send("/api/cookbook/meal-plan/swap", { method: "POST", body: { a: moving.id, b: there.id } });
        } catch (err) {
          // A server older than that route (a friend's own): two saves.
          if ((err as { status?: number }).status !== 404) throw err;
          await mealPlan().update(moving.id, { recipe: there.recipe, note: there.note });
          await mealPlan().update(there.id, { recipe: moving.recipe, note: moving.note });
        }
      } else {
        await mealPlan().update(moving.id, { date: toStoredDate(target.date), meal: target.meal });
      }
    } catch (err) {
      setError(errorMessage(err));
      plan.reload();
    }
  }

  // What's dragged is a dish (its entry's id).
  function onDragStart(event: DragStartEvent) {
    setDragging(shown.find((entry) => entry.id === String(event.active.id)) ?? null);
  }

  // The list's places are meals ("2026-11-02|lunch"); the month grid's are
  // days, where a dish stays the same meal ("2026-11-02").
  function onDragEnd(event: DragEndEvent) {
    setDragging(null);
    if (!event.over) return;
    const id = String(event.active.id);
    const entry = shown.find((e) => e.id === id);
    const over = String(event.over.id);
    if (entry) void move(id, over.includes("|") ? over : slotKey(over, mealOf(entry)));
  }

  const isList = view === "list";
  const thisWeek = weekStart(today, firstDay);
  const atToday = isList ? chosenStart === null : month === monthStart(today);
  // The month view says which month; the list needs no label, as its week
  // headings say which weeks they are (Xel, 2026-11-06).
  const monthLabel = formatDay(month, { month: "long", year: "numeric" });

  // The heading over each week in the list.
  function weekLabel(first: string): string {
    const weeksAway = Math.round((dayNumber(first) - dayNumber(thisWeek)) / 7);
    if (weeksAway === 0) return "This week";
    if (weeksAway === 1) return "Next week";
    if (weeksAway === -1) return "Last week";
    return `Week of ${formatDay(first, { day: "numeric", month: "short" })}`;
  }

  function step(direction: 1 | -1) {
    setPicking(null);
    if (isList) {
      // Back where it opens: "Today" again (so the Today button rests).
      const next = addDays(start, 7 * direction);
      setStart(next === addDays(today, -1) ? null : next);
    } else {
      setMonth(addMonths(month, direction));
    }
  }

  function goToToday() {
    setPicking(null);
    setStart(null);
    setMonth(monthStart(today));
    setSelected(today);
    showTop.current = true;
  }

  return (
    <div className="stack narrow">
      <div className="section-head">
        <h1>{planTitle(meals)}</h1>
        <div className="view-switch" role="group" aria-label="View">
          <button aria-pressed={isList} onClick={() => changeView("list")}>
            List
          </button>
          <button aria-pressed={!isList} onClick={() => changeView("month")}>
            Month
          </button>
        </div>
      </div>

      <div className={`plan-toolbar ${isList ? "centred" : ""}`}>
        {!isList && <strong className="plan-range">{monthLabel}</strong>}
        <div className="week-nav">
          <button
            className="icon-button small"
            onClick={() => step(-1)}
            aria-label={isList ? "Previous week" : "Previous month"}
          >
            ‹
          </button>
          <button className="button small" onClick={goToToday} disabled={atToday}>
            Today
          </button>
          <button className="icon-button small" onClick={() => step(1)} aria-label={isList ? "Next week" : "Next month"}>
            ›
          </button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}

      <DndContext
        sensors={sensors}
        collisionDetection={dropTarget}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
      >
        {isList ? (
          <ol className="plan-days">
            {days.map((date, i) => (
              <Fragment key={date}>
                {/* "This week", "Next week": over the first day shown and
                    each week's first day (the list starts at yesterday, so
                    rarely on one). */}
                {(i === 0 || date === weekStart(date, firstDay)) && (
                  <li className="plan-week">
                    <h2>{weekLabel(weekStart(date, firstDay))}</h2>
                  </li>
                )}
                <DayRow
                  date={date}
                  today={today}
                  meals={mealsOn(date)}
                  labelled={meals.length > 1}
                  dishesAt={(meal) => dishesAt(date, meal)}
                  onAdd={(meal) => setPicking({ date, meal })}
                  onRemove={remove}
                />
              </Fragment>
            ))}
          </ol>
        ) : (
          <>
            <MonthGrid
              month={month}
              firstDay={firstDay}
              today={today}
              selected={selected}
              byDate={byDate}
              onSelect={(date) => {
                setSelected(date);
                setPicking(null);
              }}
            />
            <SelectedDay
              date={selected}
              meals={mealsOn(selected)}
              labelled={meals.length > 1}
              dishesAt={(meal) => dishesAt(selected, meal)}
              onAdd={(meal) => setPicking({ date: selected, meal })}
              onRemove={remove}
            />
          </>
        )}
        {/* How to move things, once there's something planned to move: one
            short line after the plan, so the top stays clear (2026-11-06). */}
        {(shown.length > 0 || !isList) && (
          <p className="muted plan-hint">
            {isList ? (
              <>
                Drag <GripIcon /> to move a {word}, or onto another to swap.
              </>
            ) : shown.length > 0 ? (
              `Tap a day to see or add its ${meals.length === 1 ? word : "meals"}. Drag a picture to move it.`
            ) : (
              `Tap a day to see or add its ${meals.length === 1 ? word : "meals"}.`
            )}
          </p>
        )}
        {/* The copy of a dinner that follows your finger while dragging. */}
        <DragOverlay>
          {dragging && (isList ? <DinnerCard entry={dragging} lifted /> : <CellThumb entry={dragging} lifted />)}
        </DragOverlay>
      </DndContext>

      {/* After the plan, like "Add to shopping list" under a recipe's
          ingredients (it sat at the top until 2026-11-06). Only with recipes
          planned from today on: that's what it shops for. */}
      {shown.some((entry) => entry.recipe && datePart(entry.date) >= today) && (
        <button className="button add-to-list" onClick={() => setShoppingOpen(true)}>
          <CartIcon size={18} />
          Add these to the shopping list
        </button>
      )}

      {picking && (
        <RecipeChooser
          date={picking.date}
          meal={picking.meal}
          upcoming={upcoming}
          lastHad={lastHad}
          onPick={(recipe) => void add(picking, { recipe })}
          onNote={(note) => void add(picking, { note })}
          onClose={() => setPicking(null)}
        />
      )}
      {shoppingOpen && (
        <WeekShoppingSheet entries={plan.items} today={today} word={word} onClose={() => setShoppingOpen(false)} />
      )}
      {undo.toast}
    </div>
  );
}

// A month as a Monday-to-Sunday grid (Sunday-to-Saturday in the US). Each
// day shows its number and, if a meal is planned, a small picture of it
// that can be dragged (its dinner, or its first meal), with "+1" when it
// has more.
function MonthGrid({
  month,
  firstDay,
  today,
  selected,
  byDate,
  onSelect,
}: {
  month: string;
  firstDay: FirstDay;
  today: string;
  selected: string;
  // Each day's meals, in plan order.
  byDate: Map<string, MealPlanEntry[]>;
  onSelect: (date: string) => void;
}) {
  const gridStart = weekStart(month, firstDay);
  const weeks = Math.ceil((dayNumber(addMonths(month, 1)) - dayNumber(gridStart)) / 7);
  const cells = Array.from({ length: weeks * 7 }, (_, i) => addDays(gridStart, i));

  return (
    <div className="month-grid">
      {cells.slice(0, 7).map((date) => (
        <span key={`head-${date}`} className="month-weekday" aria-hidden="true">
          {formatDay(date, { weekday: "narrow" })}
        </span>
      ))}
      {cells.map((date) => (
        <MonthCell
          key={date}
          date={date}
          inMonth={monthStart(date) === month}
          isToday={date === today}
          isSelected={date === selected}
          entries={byDate.get(date) ?? []}
          onSelect={onSelect}
        />
      ))}
    </div>
  );
}

function MonthCell({
  date,
  inMonth,
  isToday,
  isSelected,
  entries,
  onSelect,
}: {
  date: string;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  entries: MealPlanEntry[];
  onSelect: (date: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: date });
  const shown = entries.find((entry) => mealOf(entry) === "dinner") ?? entries[0];
  // "Lunch: Soup, Dinner: Curry", or just "Curry" for a lone dinner.
  const described = entries
    .map((entry) => (entries.length > 1 || mealOf(entry) !== "dinner" ? `${MEAL_NAMES[mealOf(entry)]}: ` : "") + entryLabel(entry))
    .join(", ");
  const classes = ["month-cell", inMonth ? "" : "other-month", isToday ? "today" : "", isSelected ? "selected" : "", isOver ? "drop-here" : ""];

  return (
    <div ref={setNodeRef} className={classes.join(" ")}>
      <button
        className="month-cell-button"
        onClick={() => onSelect(date)}
        aria-pressed={isSelected}
        aria-label={`${formatDay(date, { weekday: "long", day: "numeric", month: "long" })}${described ? `: ${described}` : ""}`}
      >
        <span className="month-day">
          {Number(date.slice(8))}
          {entries.length > 1 && <span className="month-more">+{entries.length - 1}</span>}
        </span>
        {shown && <DraggableThumb entry={shown} />}
      </button>
    </div>
  );
}

// A meal's picture in a month cell; dragging it moves the meal. (A tap
// still selects the day, because a drag only starts after moving a little.)
function DraggableThumb({ entry }: { entry: MealPlanEntry }) {
  const { setNodeRef, listeners, isDragging } = useDraggable({ id: entry.id });
  return (
    <span ref={setNodeRef} className={`cell-thumb-wrap ${isDragging ? "dragging" : ""}`} {...listeners}>
      <CellThumb entry={entry} />
    </span>
  );
}

function CellThumb({ entry, lifted = false }: { entry: MealPlanEntry; lifted?: boolean }) {
  const recipe = entry.expand?.recipe;
  if (recipe?.image) {
    return <RecipePhoto recipe={recipe} size="card" className={`cell-thumb ${lifted ? "lifted" : ""}`} />;
  }
  return (
    <span className={`cell-thumb dinner-no-photo ${recipe ? "" : "note"} ${lifted ? "lifted" : ""}`} aria-hidden="true">
      {recipe ? "🍲" : "📝"}
    </span>
  );
}

// What one day's places show: the meals, whether each is labelled
// ("Breakfast", only when the plan has more than dinner), what's planned,
// and what tapping "+ Add" or ✕ does.
interface DayProps {
  date: string;
  meals: Meal[];
  labelled: boolean;
  // A meal's recipes (or notes), in the order added: it can hold more than
  // one (Lilly, 2026-11-08).
  dishesAt: (meal: Meal) => MealPlanEntry[];
  onAdd: (meal: Meal) => void;
  onRemove: (entry: MealPlanEntry) => void;
}

// Under the month grid: the chosen day's meals, or a way to add each.
function SelectedDay({ date, meals, labelled, dishesAt, onAdd, onRemove }: DayProps) {
  return (
    <section className="selected-day" aria-label={`${labelled ? "Meals" : MEAL_NAMES[meals[0]]} on ${formatDay(date)}`}>
      <h2>{formatDay(date, { weekday: "long", day: "numeric", month: "long" })}</h2>
      {meals.map((meal) => {
        const dishes = dishesAt(meal);
        return (
          <div key={meal} className="plan-meal">
            {labelled && <span className="meal-label">{MEAL_NAMES[meal]}</span>}
            {dishes.map((entry) => (
              <div key={entry.id} className="dinner-slot">
                <DinnerCard entry={entry} />
                <button
                  className="icon-button small"
                  onClick={() => onRemove(entry)}
                  aria-label={`Take ${entryLabel(entry)} off the plan`}
                >
                  <CloseIcon />
                </button>
              </div>
            ))}
            <AddButton meal={meal} another={dishes.length > 0} onAdd={onAdd} />
          </div>
        );
      })}
    </section>
  );
}

// "+ Add dinner", or "+ Add another" under what's planned.
function AddButton({ meal, another, onAdd }: { meal: Meal; another: boolean; onAdd: (meal: Meal) => void }) {
  return (
    <button className={`plan-add ${another ? "another" : ""}`} onClick={() => onAdd(meal)}>
      {another ? "+ Add another" : `+ Add ${meal}`}
    </button>
  );
}

function DayRow({ today, ...day }: DayProps & { today: string }) {
  const { date } = day;
  const when = date === today ? "today" : date < today ? "past" : "";
  // Planning several meals a day: the planned ones as cards, the empty ones
  // as small "+ Breakfast" chips in one row, so a week of mostly empty
  // breakfasts and lunches doesn't take several screens (2026-11-06).
  const empty = day.labelled ? day.meals.filter((meal) => day.dishesAt(meal).length === 0) : [];
  const full = day.meals.filter((meal) => !empty.includes(meal));
  // Adding another recipe to a planned meal is a chip in the same row as
  // the empty meals' ("+ Dinner + Breakfast"), not a row under each meal
  // (Xel's pick, 2026-11-08).
  const planned = full.filter((meal) => day.dishesAt(meal).length > 0);
  return (
    <li className={`plan-day ${when}`}>
      <div className="plan-date">
        <strong>{date === today ? "Today" : formatDay(date, { weekday: "short" })}</strong>
        <span>{formatDay(date, { day: "numeric", month: "short" })}</span>
      </div>
      <div className="plan-meals">
        {full.map((meal) => (
          <MealPlace key={meal} meal={meal} {...day} />
        ))}
        {planned.length + empty.length > 0 && (
          <div className="plan-empty-meals">
            {planned.map((meal) => (
              <div key={meal} className="plan-meal compact">
                <button className="plan-add" onClick={() => day.onAdd(meal)} aria-label={`Add another recipe to ${meal}`}>
                  + {MEAL_NAMES[meal]}
                </button>
              </div>
            ))}
            {empty.map((meal) => (
              <MealPlace key={meal} meal={meal} {...day} compact />
            ))}
          </div>
        )}
      </div>
    </li>
  );
}

// One meal's place in a day row: a dinner (or breakfast, or lunch) that can
// be dragged, or "+ Add" (a small chip when compact). Meals dragged here
// land in it.
function MealPlace({ date, meal, labelled, dishesAt, onAdd, onRemove, compact = false }: DayProps & { meal: Meal; compact?: boolean }) {
  const { setNodeRef, isOver } = useDroppable({ id: slotKey(date, meal) });
  const dishes = dishesAt(meal);
  if (compact) {
    return (
      <div ref={setNodeRef} className={`plan-meal compact ${isOver ? "drop-here" : ""}`}>
        <button className="plan-add" onClick={() => onAdd(meal)} aria-label={`Add ${meal}`}>
          + {MEAL_NAMES[meal]}
        </button>
      </div>
    );
  }
  return (
    <div ref={setNodeRef} className={`plan-meal ${isOver ? "drop-here" : ""}`}>
      {labelled && <span className="meal-label">{MEAL_NAMES[meal]}</span>}
      {dishes.map((entry) => (
        <DraggableDinner key={entry.id} entry={entry} onRemove={onRemove} />
      ))}
      {/* Another recipe for it: the "+ Dinner" chip under the day's meals. */}
      {dishes.length === 0 && (
        <button className="plan-add" onClick={() => onAdd(meal)}>
          + Add {meal}
        </button>
      )}
    </div>
  );
}

function DraggableDinner({ entry, onRemove }: { entry: MealPlanEntry; onRemove: (entry: MealPlanEntry) => void }) {
  const { setNodeRef, attributes, listeners, isDragging } = useDraggable({ id: entry.id });
  return (
    <div ref={setNodeRef} className={`dinner-slot ${isDragging ? "dragging" : ""}`}>
      <button
        className="drag-handle"
        aria-label={`Move ${entryLabel(entry)} to another day or meal`}
        {...attributes}
        {...listeners}
      >
        <GripIcon />
      </button>
      <DinnerCard entry={entry} />
      <button
        className="icon-button small"
        onClick={() => onRemove(entry)}
        aria-label={`Take ${entryLabel(entry)} off the plan`}
      >
        <CloseIcon />
      </button>
    </div>
  );
}

// What a meal holds, in words: the recipe's name, or the note.
function entryLabel(entry: MealPlanEntry): string {
  return entry.expand?.recipe?.title || entry.note || `this ${mealOf(entry)}`;
}

function DinnerCard({ entry, lifted = false }: { entry: MealPlanEntry; lifted?: boolean }) {
  const recipe = entry.expand?.recipe;
  // A note night ("Take-away night") isn't a link; there's no recipe to open.
  if (!recipe) {
    return (
      <span className={`dinner-card note-card ${lifted ? "lifted" : ""}`}>
        <span className="dinner-no-photo note" aria-hidden="true">
          📝
        </span>
        <span className="dinner-title">{entry.note || "A recipe that's been deleted"}</span>
      </span>
    );
  }
  const content = (
    <>
      {recipe.image ? (
        <RecipePhoto recipe={recipe} size="card" />
      ) : (
        <span className="dinner-no-photo" aria-hidden="true">
          🍲
        </span>
      )}
      <span className="dinner-title">{recipe.title}</span>
    </>
  );
  return lifted ? (
    <span className="dinner-card lifted">{content}</span>
  ) : (
    <Link to={`/recipes/${recipe.id}`} className="dinner-card">
      {content}
    </Link>
  );
}
