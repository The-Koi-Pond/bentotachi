import { useState, type FormEvent } from "react";
import { Navigate } from "react-router";
import { displayName, errorMessage, isAndroidApp, pb, personStyle, useCurrentUser, users, type User } from "../pb";
import { useLiveRecords } from "../useLiveRecords";
import Avatar from "../Avatar";
import { refreshHousehold } from "../household";
import { isPhoneMode } from "../phoneMode";
import { useUnsavedChanges } from "../unsavedChanges";

// Opened on the server computer itself ("localhost"), whose address phones
// can't use.
const onServerComputer = /^(localhost|127\.|\[::1\])/.test(window.location.hostname);

// Usernames: lowercase letters, numbers, dots, dashes and underscores.
const cleanUsername = (text: string) => text.toLowerCase().replace(/[^a-z0-9._-]/g, "");

// Everyone with an account on this Bento, and a way to add someone. Anyone
// in the household can add people; changing or removing accounts is done on
// the server's admin page (see the setup guide). The household's settings
// (country, spoons, meals) are in Settings (HouseholdSettings.tsx). In
// phone-only mode nobody else can join, so there's no page: an old link
// goes to Settings.
export default function Household() {
  if (isPhoneMode()) return <Navigate to="/settings" replace />;
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
