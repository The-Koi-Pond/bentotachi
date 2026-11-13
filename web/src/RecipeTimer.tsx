import { useEffect, useState } from "react";
import { errorMessage, type Recipe } from "./pb";
import { formatMinutes, totalMinutes } from "./format";
import { PauseIcon, PlayIcon, StopIcon } from "./icons";
import {
  clock,
  elapsed,
  finished,
  paused,
  recipeMinutes,
  resumed,
  startCooking,
  startTimer,
  timedTotal,
  type TimerState,
} from "./cookTiming";
import { remember, rememberedJson } from "./phoneStorage";
import { askFirst } from "./askFirst";
import { useKeepAwake } from "./useWakeLock";

// "⏱ Time it" on a recipe: a prep-then-cook stopwatch to find out how long
// the recipe really takes, then an offer to save that as its times. Kept on
// this device per recipe, so it carries on if the page is left or the
// phone locks (see cookTiming.ts).

const key = (recipeId: string) => `bento.timer.${recipeId}`;

function load(recipeId: string): TimerState | null {
  const saved = rememberedJson(key(recipeId)) as Partial<TimerState> | null;
  return saved && typeof saved.stage === "string" ? (saved as TimerState) : null;
}

function store(recipeId: string, state: TimerState | null) {
  remember(key(recipeId), state && JSON.stringify(state));
}

// The recipe's other "Cooked it": the timing is over too, rather than
// running on (and keeping the screen on). Done on the stored timing, so it
// works while the timer is hidden (the details being edited) as well.
export function finishTiming(recipeId: string, at: number) {
  const current = load(recipeId);
  if (current && current.stage !== "done") store(recipeId, finished(current, at));
}

export default function RecipeTimer({
  recipe,
  onSave,
  onFinished,
  cookedAt,
}: {
  recipe: Recipe;
  onSave: (changes: Partial<Recipe>) => Promise<void>;
  // Finishing means it was cooked: the recipe page marks it cooked today.
  onFinished: () => void;
  // When the page's other "Cooked it" was pressed (0: not yet), after
  // finishTiming: shows the finished timing.
  cookedAt: number;
}) {
  const [state, setStateRaw] = useState<TimerState | null>(() => load(recipe.id));
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const setState = (next: TimerState | null) => {
    setStateRaw(next);
    store(recipe.id, next);
    setNow(Date.now());
  };

  // Tick once a second while a stage is running.
  const running = !!state && state.stage !== "done" && state.runningSince !== null;
  // The screen stays on while it runs, like a step timer.
  useKeepAwake(running);

  useEffect(() => {
    if (!cookedAt) return;
    setStateRaw(load(recipe.id));
    setNow(Date.now());
  }, [cookedAt, recipe.id]);
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [running]);

  if (!state) {
    // A footer row: what it's for on the left, the button at the right
    // (where the running timer then takes over).
    return (
      <div className="timer-start-row">
        <span className="muted">How long does it really take?</span>
        <button className="button small timer-start" onClick={() => setState(startTimer(Date.now()))}>
          ⏱ Time it
        </button>
      </div>
    );
  }

  const time = elapsed(state, now);
  // Each button reads the clock when it's tapped: while paused nothing
  // re-renders, so a time taken at render would be from when it paused.
  const act = (change: (current: TimerState, at: number) => TimerState) => setState(change(state, Date.now()));

  // Stop part-way asks first (it can't be undone); Discard on the result
  // doesn't, as that's what it says.
  function forget() {
    setState(null);
    setError("");
  }

  async function stop() {
    if (
      time.prep + time.cook > 60_000 &&
      !(await askFirst("Stop timing and forget it?", { yes: "Stop and forget", no: "Keep timing" }))
    )
      return;
    forget();
  }

  async function save() {
    const prep = recipeMinutes(time.prep);
    const cook = recipeMinutes(time.cook);
    setBusy(true);
    setError("");
    try {
      await onSave({ prep_minutes: prep, cook_minutes: cook, total_minutes: timedTotal(recipe, prep, cook) });
      setState(null);
    } catch (err) {
      setError(errorMessage(err));
    }
    setBusy(false);
  }

  if (state.stage === "done") {
    const prep = recipeMinutes(time.prep);
    const cook = recipeMinutes(time.cook);
    const said = [
      recipe.prep_minutes ? `prep ${formatMinutes(recipe.prep_minutes)}` : "",
      recipe.cook_minutes ? `cook ${formatMinutes(recipe.cook_minutes)}` : "",
    ].filter(Boolean);
    const recipeTotal = totalMinutes(recipe);
    return (
      <section className="card stack recipe-timer" aria-label="Recipe timer">
        <h2 className="timer-title">⏱ You took {formatMinutes(prep + cook) || "under a minute"}</h2>
        <p className="timer-result">
          Prep {prep ? formatMinutes(prep) : "none"}, cook {formatMinutes(cook) || "none"}.
          {(prep >= 10 || cook >= 10) && <span className="muted timer-rounding"> (Rounded to 5 minutes, like recipes.)</span>}
        </p>
        <p className="muted">
          {said.length
            ? `The recipe says ${said.join(", ")}${recipeTotal && said.length > 1 ? ` (${formatMinutes(recipeTotal)})` : ""}.`
            : recipeTotal
              ? `The recipe says ${formatMinutes(recipeTotal)} in all.`
              : "The recipe never said how long it takes. Now you know."}
        </p>
        <p className="muted">
          <span aria-hidden="true">✓</span> Marked as cooked today.
        </p>
        {error && <p className="error">{error}</p>}
        <div className="actions">
          <button className="button ghost" onClick={forget} disabled={busy}>
            Discard
          </button>
          <button className="button primary" onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save these times"}
          </button>
        </div>
      </section>
    );
  }

  const isPaused = state.runningSince === null;
  const cooking = state.stage === "cook";
  return (
    <section className="card stack recipe-timer" aria-label="Recipe timer">
      <div className="timer-stages">
        <div className={`timer-stage ${cooking ? "done-stage" : "current"}`}>
          <span className="timer-label">Prep</span>
          <span className="timer-clock">{cooking && time.prep < 1000 ? "none" : clock(time.prep)}</span>
        </div>
        <div className={`timer-stage ${cooking ? "current" : "later"}`}>
          <span className="timer-label">Cook</span>
          <span className="timer-clock">{cooking ? clock(time.cook) : "–"}</span>
        </div>
      </div>
      {isPaused && <p className="muted timer-paused">Paused</p>}
      <div className="actions">
        <button className="button push-left" onClick={stop}>
          <StopIcon /> Stop
        </button>
        <button className="button" onClick={() => act(isPaused ? resumed : paused)}>
          {isPaused ? (
            <>
              <PlayIcon /> Resume
            </>
          ) : (
            <>
              <PauseIcon /> Pause
            </>
          )}
        </button>
        {cooking ? (
          <button
            className="button primary"
            onClick={() => {
              act(finished);
              onFinished();
            }}
          >
            <span className="button-mark" aria-hidden="true">✓</span> Cooked it
          </button>
        ) : (
          <button className="button primary" onClick={() => act(startCooking)}>
            {time.prep < 60_000 ? "No prep, start cooking" : "Prep done, start cooking"}
          </button>
        )}
      </div>
    </section>
  );
}
