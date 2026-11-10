import { useState, type ReactNode } from "react";
import { errorMessage } from "./pb";
import { useCountry, usePlanMeals, useTablespoon } from "./household";
import { MEALS, MEAL_NAMES, type Meal } from "./meals";
import { COUNTRIES, OTHER_COUNTRY } from "./country";
import { storesIn } from "./stores";
import StoreLogo from "./StoreLogo";
import { HelpBox, HelpButton, useHelp } from "./Help";

// Settings → Household: the household's country, tablespoon and meals on
// the plan, one setting each for everyone here, saved as soon as changed.
// A tray in Settings (pages/Settings.tsx), each setting a compartment.
export default function HouseholdSettings() {
  return (
    <section className="stack tray-section">
      <h2>Household</h2>
      <ul className="settings-list">
        <li>
          <CountrySetting />
        </li>
        <li>
          <TablespoonSetting />
        </li>
        <li>
          <PlanMealsSetting />
        </li>
      </ul>
    </section>
  );
}

// Saves a change, keeping its error (if any) to show under the setting.
function useSave() {
  const [error, setError] = useState("");
  async function save(change: () => Promise<unknown>) {
    setError("");
    try {
      await change();
    } catch (err) {
      setError(errorMessage(err));
    }
  }
  return { error, save };
}

function Detail({ error, children }: { error: string; children?: ReactNode }) {
  if (error) return <span className="menu-item-detail error">{error}</span>;
  return children ? <span className="menu-item-detail">{children}</span> : null;
}

// The country decides the grocery stores the Pantry offers, and the units
// recipes give hints in.
function CountrySetting() {
  const help = useHelp();
  const [country, setCountry] = useCountry();
  const { error, save } = useSave();
  const stores = storesIn(country);

  return (
    <div className="setting-block">
      <div className="setting-row">
        <span className="menu-item-text">
          <span>
            <label htmlFor="household-country">Country</label>
            <HelpButton help={help} label="What the country changes" />
          </span>
          <Detail error={error} />
        </span>
        <select id="household-country" value={country} onChange={(e) => void save(() => setCountry(e.target.value))}>
          {COUNTRIES.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
          <option value={OTHER_COUNTRY}>Somewhere else</option>
        </select>
      </div>
      <HelpBox help={help}>
        <p>
          It decides the grocery stores Bentotachi offers in the Pantry, and the units recipes give hints in, for
          everyone here. Store names and logos belong to their owners; Bentotachi isn't connected with any store.
        </p>
      </HelpBox>
      <p className="muted setting-note country-stores">
        {stores.length ? (
          <>
            Stores:{" "}
            {stores.map((store) => (
              <StoreLogo key={store.name} store={store} />
            ))}
          </>
        ) : (
          "Bentotachi doesn't know stores there yet, so store search is hidden. You can still paste any shop's product link into a pantry item."
        )}
      </p>
    </div>
  );
}

// What the household's tablespoon holds. Recipes written for the other size
// (Australian sites use 20 ml, nearly everyone else 15 ml) get a hint in
// these spoons (see volumes.ts).
function TablespoonSetting() {
  const help = useHelp();
  const [tablespoon, setTablespoon] = useTablespoon();
  const { error, save } = useSave();

  return (
    <div className="setting-block">
      <div className="setting-row">
        <span className="menu-item-text">
          <span>
            <label htmlFor="household-tablespoon">Our tablespoon</label>
            <HelpButton help={help} label="Not sure which?" />
          </span>
          <Detail error={error} />
        </span>
        <select
          id="household-tablespoon"
          value={tablespoon}
          onChange={(e) => void save(() => setTablespoon(Number(e.target.value)))}
        >
          <option value={15}>15 ml</option>
          <option value={20}>20 ml</option>
        </select>
      </div>
      <HelpBox help={help}>
        <p>
          Count how many teaspoons fill your tablespoon: 3 means 15 ml (most spoons), 4 means 20 ml (the Australian
          standard). Recipes written for the other size get a hint, like “2 tbsp (your 1 tbsp + 2 tsp)”.
        </p>
      </HelpBox>
    </div>
  );
}

// Which meals the plan has a place for. Dinner only until someone turns on
// breakfast or lunch; at least one stays on.
function PlanMealsSetting() {
  const [meals, setMeals] = usePlanMeals();
  const { error, save } = useSave();

  // Made to the meals as they are by then (a tap a moment ago included).
  function toggle(meal: Meal) {
    if (meals.length === 1 && meals[0] === meal) return;
    void save(() =>
      setMeals((now) => {
        const next = now.includes(meal) ? now.filter((m) => m !== meal) : [...now, meal];
        return next.length ? MEALS.filter((m) => next.includes(m)) : now;
      })
    );
  }

  return (
    <div className="setting-block">
      <div className="setting-row">
        <span className="menu-item-text">
          Meals on the plan
          <Detail error={error}>Each day gets a place for these</Detail>
        </span>
      </div>
      <div className="filter-chips setting-note" role="group" aria-label="Meals on the plan">
        {MEALS.map((meal) => (
          <button
            key={meal}
            aria-pressed={meals.includes(meal)}
            disabled={meals.length === 1 && meals[0] === meal}
            onClick={() => toggle(meal)}
          >
            {MEAL_NAMES[meal]}
          </button>
        ))}
      </div>
    </div>
  );
}
