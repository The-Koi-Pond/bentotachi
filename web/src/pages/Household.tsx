import { useState, type FormEvent } from "react";
import { displayName, errorMessage, isAndroidApp, pb, personStyle, useCurrentUser, users, type User } from "../pb";
import { useLiveRecords } from "../useLiveRecords";
import Avatar from "../Avatar";
import { refreshHousehold, useCountry, usePlanMeals, useTablespoon } from "../household";
import { MEALS, MEAL_NAMES, type Meal } from "../meals";
import { isPhoneMode } from "../phoneMode";
import { COUNTRIES, OTHER_COUNTRY } from "../country";
import { storesIn } from "../stores";
import StoreLogo from "../StoreLogo";
import { useUnsavedChanges } from "../unsavedChanges";
import { HelpBox, HelpButton, useHelp } from "../Help";


// Opened on the server computer itself ("localhost"), whose address phones
// can't use.
const onServerComputer = /^(localhost|127\.|\[::1\])/.test(window.location.hostname);

// Usernames: lowercase letters, numbers, dots, dashes and underscores.
const cleanUsername = (text: string) => text.toLowerCase().replace(/[^a-z0-9._-]/g, "");

// Everyone with an account on this Bento, and a way to add someone. Anyone
// in the household can add people; changing or removing accounts is done on
// the server's admin page (see the setup guide).
// In phone-only mode nobody else can join, so it's just the settings.
export default function Household() {
  if (isPhoneMode())
    return (
      <div className="stack narrow">
        <h1>Country, spoons & meals</h1>
        <CountrySetting />
        <TablespoonSetting />
        <PlanMealsSetting />
      </div>
    );
  return <People />;
}

function People() {
  const me = useCurrentUser();
  const people = useLiveRecords<User>("users");
  const list = [...(people.items ?? [])].sort((a, b) => displayName(a).localeCompare(displayName(b)));

  return (
    <div className="stack narrow">
      <h1>Household</h1>
      {people.loadError && <p className="error">{people.loadError}</p>}
      {!people.items && !people.loadError && <p className="muted">Loading…</p>}
      {list.length > 0 && (
        <ul className="card household-list">
          {list.map((person) => (
            <li key={person.id}>
              <Avatar user={person} size={40} />
              <span className="household-text">
                <span className="person-name" style={personStyle(person)}>
                  {displayName(person)}
                  {person.id === me?.id && <span className="muted"> (you)</span>}
                </span>
                <span className="muted household-username">{person.username}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <AddPerson onAdded={people.upsert} />
      <CountrySetting />
      <TablespoonSetting />
      <PlanMealsSetting />
      <p className="muted small-note">
        To reset someone's forgotten password or remove an account, use the server's admin page. The{" "}
        <a href="guide.html#admin" target="_blank" rel="noreferrer">
          setup guide
        </a>{" "}
        explains how.
      </p>
    </div>
  );
}

// The household's country, which decides the grocery stores the Pantry
// offers. One setting for everyone; it saves as soon as it's changed.
function CountrySetting() {
  const [country, setCountry] = useCountry();
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);
  const stores = storesIn(country);

  async function change(next: string) {
    setStatus(null);
    try {
      await setCountry(next);
      setStatus({ text: "Saved.", isError: false });
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
    }
  }

  return (
    <section className="card stack">
      <h2>Country</h2>
      <label>
        <span className="hint">
          Decides the grocery stores Bentotachi offers in the Pantry, and the units recipes give hints in, for everyone
          here.
        </span>
        <select value={country} onChange={(e) => void change(e.target.value)} aria-label="Country">
          {COUNTRIES.map((option) => (
            <option key={option.code} value={option.code}>
              {option.name}
            </option>
          ))}
          <option value={OTHER_COUNTRY}>Somewhere else</option>
        </select>
      </label>
      <p className="muted country-stores">
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
      {stores.length > 0 && (
        <p className="muted small-note">
          Store names and logos belong to their owners. Bentotachi isn't connected with any store.
        </p>
      )}
      {status && (
        <p className={status.isError ? "error" : "success"} role="status">
          {status.text}
        </p>
      )}
    </section>
  );
}

// What the household's tablespoon holds. Recipes written for the other size
// (Australian sites use 20 ml, nearly everyone else 15 ml) get a hint in
// these spoons (see volumes.ts). Saves as soon as it's changed.
function TablespoonSetting() {
  const help = useHelp();
  const [tablespoon, setTablespoon] = useTablespoon();
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);

  async function change(next: number) {
    setStatus(null);
    try {
      await setTablespoon(next);
      setStatus({ text: "Saved.", isError: false });
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
    }
  }

  return (
    <section className="card stack">
      <h2>
        Our tablespoon
        <HelpButton help={help} label="Not sure which?" />
      </h2>
      <HelpBox help={help}>
        <p>Count how many teaspoons fill your tablespoon: 3 means 15 ml, 4 means 20 ml.</p>
      </HelpBox>
      <label>
        <span className="hint">Recipes written for the other size get a hint, like “2 tbsp (your 1 tbsp + 2 tsp)”.</span>
        <select value={tablespoon} onChange={(e) => void change(Number(e.target.value))} aria-label="Our tablespoon">
          <option value={15}>15 ml (most spoons)</option>
          <option value={20}>20 ml (the Australian standard)</option>
        </select>
      </label>
      {status && (
        <p className={status.isError ? "error" : "success"} role="status">
          {status.text}
        </p>
      )}
    </section>
  );
}

// Which meals the plan has a place for. Dinner only until someone turns on
// breakfast or lunch; at least one stays on. Saves as soon as it's changed.
function PlanMealsSetting() {
  const [meals, setMeals] = usePlanMeals();
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);

  async function toggle(meal: Meal) {
    const next = meals.includes(meal) ? meals.filter((m) => m !== meal) : [...meals, meal];
    if (next.length === 0) return;
    setStatus(null);
    try {
      await setMeals(MEALS.filter((m) => next.includes(m)));
      setStatus({ text: "Saved.", isError: false });
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
    }
  }

  return (
    <section className="card stack">
      <h2>Meals on the plan</h2>
      <span className="hint">Each day on the plan gets a place for these.</span>
      <div className="filter-chips" role="group" aria-label="Meals on the plan">
        {MEALS.map((meal) => (
          <button
            key={meal}
            aria-pressed={meals.includes(meal)}
            disabled={meals.length === 1 && meals[0] === meal}
            onClick={() => void toggle(meal)}
          >
            {MEAL_NAMES[meal]}
          </button>
        ))}
      </div>
      {status && (
        <p className={status.isError ? "error" : "success"} role="status">
          {status.text}
        </p>
      )}
    </section>
  );
}

// "Add someone": their name, a username and a starting password, which you
// pass on to them. They can change it under Profile.
function AddPerson({ onAdded }: { onAdded: (user: User) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // What to tell the person just added.
  const [added, setAdded] = useState<{ name: string; username: string; password: string } | null>(null);
  useUnsavedChanges(open && !!(name.trim() || username || password));

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (username.length < 2) return setError("Usernames need at least 2 characters.");
    if (password.length < 8) return setError("The password needs at least 8 characters.");
    setBusy(true);
    setError("");
    try {
      const user = await users().create({ name: name.trim(), username, password, passwordConfirm: password });
      onAdded(user);
      setAdded({ name: displayName(user), username, password });
      // Bento stops being single-user: who added what shows again.
      refreshHousehold();
      setName("");
      setUsername("");
      setPassword("");
      setOpen(false);
    } catch (err) {
      const message = errorMessage(err);
      setError(/username.*unique|unique.*username/i.test(message) ? `“${username}” is taken. Try another username.` : message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {added && (
        <div className="card stack added-person" role="status">
          <strong>{added.name} can log in now.</strong>
          <p className="muted">Tell them:</p>
          <dl className="login-details">
            {!isAndroidApp && (
              <div>
                <dt>App</dt>
                <dd>
                  {onServerComputer ? (
                    <>
                      On their Android phone, open <strong>http://YOUR-SERVER-ADDRESS/api/cookbook/app/download</strong>{" "}
                      to get the app. Step 5 of the{" "}
                      <a href="guide.html#phones" target="_blank" rel="noreferrer">
                        setup guide
                      </a>{" "}
                      shows how to find the address.
                    </>
                  ) : (
                    <>
                      On their Android phone, open <strong>http://{window.location.host}/api/cookbook/app/download</strong>{" "}
                      to get the app.
                    </>
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt>Server address</dt>
              <dd>{isAndroidApp ? pb.baseURL.replace(/^https?:\/\//, "") : "the same one you use on your phone"}</dd>
            </div>
            <div>
              <dt>Username</dt>
              <dd>{added.username}</dd>
            </div>
            <div>
              <dt>Password</dt>
              <dd>{added.password}</dd>
            </div>
          </dl>
          <p className="muted small-note">They can change their password under Profile in the ⋮ menu.</p>
          <button className="button small ghost" onClick={() => setAdded(null)}>
            Done
          </button>
        </div>
      )}
      {!open ? (
        <button className="button primary" onClick={() => setOpen(true)}>
          + Add someone
        </button>
      ) : (
        <form className="card stack" onSubmit={submit}>
          <h2>Add someone</h2>
          <label>
            Their name
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Alex" required autoFocus />
          </label>
          <label>
            Username
            <span className="hint">What they'll log in with. Lowercase letters, numbers, dots, dashes and underscores.</span>
            <input
              value={username}
              onChange={(e) => setUsername(cleanUsername(e.target.value))}
              maxLength={30}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="e.g. alex"
              required
            />
          </label>
          <label>
            Starting password
            <span className="hint">At least 8 characters. Tell them it; they can change it after.</span>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              autoComplete="off"
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <div className="actions">
            <button type="button" className="button ghost" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </button>
            <button className="button primary" disabled={busy}>
              {busy ? "Adding…" : "Add to the household"}
            </button>
          </div>
        </form>
      )}
    </>
  );
}
