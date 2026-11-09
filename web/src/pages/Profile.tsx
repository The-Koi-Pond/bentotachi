import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { displayName, errorMessage, PERSON_COLORS, pb, useCurrentUser, users, type User } from "../pb";
import Avatar from "../Avatar";
import { squarePicture } from "../avatarImage";
import { useUnsavedChanges } from "../unsavedChanges";
import { askFirst } from "../askFirst";
import { erasePhone, isPhoneMode, switchToServer } from "../phoneMode";
import { forgetOfflineCopy } from "../offline";
import { BenMood } from "../Brand";
import { ChevronIcon } from "../icons";
import { useSingleUser, useSpell } from "../household";


// Your own account: picture, name, username, color
// and password. Each part saves on its own. Saving your own account
// also updates the logged-in copy, so the rest of the app changes at once.
// Phone-only mode has no username or password to show (decided 2026-11-03):
// Bentotachi made them and logs in by itself, and the only time they're
// needed, moving to a server, Backups shows them.
export default function Profile() {
  const user = useCurrentUser();
  if (!user) return null;
  const phone = isPhoneMode();
  return (
    <div className="stack narrow profile">
      <h1>Profile</h1>
      <PictureSection user={user} />
      <NameSection user={user} showUsername={!phone} />
      <ColorSection user={user} />
      {!phone && <PasswordSection user={user} />}
      <HouseholdAndLeaving phone={phone} />
      <DeleteSection user={user} />
    </div>
  );
}

// The household (who's in it, or its country, spoons and meals on your own)
// and the way out: Log out, or on a phone-only Bento, which logs itself in,
// the way to the household's server instead (where people look for a way
// out). In the ⋮ menu before; here they're out of the way.
function HouseholdAndLeaving({ phone }: { phone: boolean }) {
  const singleUser = useSingleUser();
  return (
    <ul className="settings-list profile-links">
      <li>
        <Link to="/household" className="setting-row">
          <span className="menu-item-text">
            {phone ? "Country, spoons & meals" : singleUser ? "Share Bentotachi" : "Household"}
            <span className="menu-item-detail">
              {phone
                ? "For store search, recipe hints and the plan"
                : singleUser
                  ? "Add someone to use it with you; country, spoons, meals"
                  : "Who has an account; country, spoons, meals"}
            </span>
          </span>
          <ChevronIcon />
        </Link>
      </li>
      <li>
        {phone ? (
          <button type="button" className="setting-row" onClick={() => void switchToServer()}>
            <span className="menu-item-text">
              Join a household
              <span className="menu-item-detail">Use the Bentotachi someone at home runs</span>
            </span>
          </button>
        ) : (
          <button
            type="button"
            className="setting-row"
            onClick={() => {
              forgetOfflineCopy();
              pb.authStore.clear();
            }}
          >
            Log out
          </button>
        )}
      </li>
    </ul>
  );
}

// "Delete my account". On a server: the account, its picture and its
// ratings go; the recipes, list items and plan nights it added stay, as
// they're the household's. Phone-only: everything on this phone goes
// (it's the only account), and Bento starts again as new.
function DeleteSection({ user }: { user: User }) {
  const phone = isPhoneMode();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);

  async function remove() {
    const question = phone
      ? "Delete everything in Bentotachi on this phone: every recipe, photo, list and plan? This can't be undone. (To keep a copy, cancel and save a backup first: ⋮ → Settings → Backups.)"
      : `Delete your account, ${displayName(user)}? Your picture and ratings go with it. Recipes and list items you added stay for the household. This can't be undone.`;
    if (!(await askFirst(question, { yes: phone ? "Delete everything" : "Delete my account", danger: true }))) return;
    setBusy(true);
    setStatus(null);
    try {
      if (phone) await erasePhone();
      else {
        await users().delete(user.id);
        forgetOfflineCopy();
        pb.authStore.clear();
      }
      window.location.reload();
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
      setBusy(false);
    }
  }

  return (
    <Section title={phone ? "Delete Bentotachi's data" : "Delete my account"}>
      <div className="with-ben">
        <BenMood mood="bitten" small />
        <p className="muted small-note">
          {phone
            ? "Deletes everything Bentotachi keeps on this phone, and starts again as new."
            : "Deletes your account from this Bentotachi. What you added for the household stays."}
        </p>
      </div>
      <div className="actions">
        <button className="button danger small push-left" onClick={() => void remove()} disabled={busy}>
          {busy ? "Deleting…" : phone ? "Delete everything" : "Delete my account"}
        </button>
      </div>
      <Status status={status} />
    </Section>
  );
}

// "Saved." or an error, under a section.
function Status({ status }: { status: { text: string; isError: boolean } | null }) {
  if (!status) return null;
  return (
    <p className={status.isError ? "error" : "success"} role="status">
      {status.text}
    </p>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="card stack">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function PictureSection({ user }: { user: User }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setStatus(null);
    try {
      await users().update(user.id, { avatar: await squarePicture(file) });
      setStatus({ text: "Picture saved.", isError: false });
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setBusy(true);
    setStatus(null);
    try {
      await users().update(user.id, { avatar: null });
      setStatus({ text: "Picture removed.", isError: false });
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card profile-picture">
      <Avatar user={user} size={88} />
      <div className="stack profile-picture-side">
        <strong className="profile-name">{displayName(user)}</strong>
        <div className="actions">
          <button className="button small" onClick={() => input.current?.click()} disabled={busy}>
            {busy ? "Saving…" : user.avatar ? "Change picture" : "Add a picture"}
          </button>
          {user.avatar && (
            <button className="button small ghost" onClick={() => void remove()} disabled={busy}>
              Remove
            </button>
          )}
        </div>
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void upload(e.target.files?.[0])}
          aria-label="Choose a profile picture"
        />
        <Status status={status} />
      </div>
    </section>
  );
}

// Usernames: lowercase letters, numbers, dots, dashes and underscores.
const cleanUsername = (text: string) => text.toLowerCase().replace(/[^a-z0-9._-]/g, "");

function NameSection({ user, showUsername }: { user: User; showUsername: boolean }) {
  const [name, setName] = useState(user.name);
  const [username, setUsername] = useState(user.username);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);
  const changed = name.trim() !== user.name || username !== user.username;
  useUnsavedChanges(changed);

  async function save(event: FormEvent) {
    event.preventDefault();
    if (username.length < 2) {
      setStatus({ text: "Usernames need at least 2 characters.", isError: true });
      return;
    }
    setBusy(true);
    setStatus(null);
    try {
      await users().update(user.id, { name: name.trim(), username });
      setStatus({ text: "Saved.", isError: false });
    } catch (err) {
      const message = errorMessage(err);
      setStatus({
        text: /username.*unique|unique.*username/i.test(message) ? `“${username}” is taken. Try another username.` : message,
        isError: true,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Name">
      <form className="stack" onSubmit={save}>
        <label>
          Display name
          <span className="hint">Your name around Bentotachi, like on ratings and the dinner plan.</span>
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder={showUsername ? user.username : "Your name"} />
        </label>
        {showUsername && (
          <label>
            Username
            <span className="hint">What you log in with. Lowercase letters, numbers, dots, dashes and underscores.</span>
            <input
              value={username}
              onChange={(e) => setUsername(cleanUsername(e.target.value))}
              maxLength={30}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
            />
          </label>
        )}
        <div className="actions">
          <button className="button primary" disabled={busy || !changed}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
        <Status status={status} />
      </form>
    </Section>
  );
}

// My color: marks your name and thumbs up around the app. Eight ready-made
// ones, or any at all from the device's picker (the rainbow). Tap the chosen
// one again for Bentotachi's usual plum (the accent).
function ColorSection({ user }: { user: User }) {
  const spell = useSpell();
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);
  const current = PERSON_COLORS.find((color) => color.value === user.color);
  // Any colour at all: the rainbow swatch opens the device's own picker.
  const custom = !!user.color && !current;
  const picker = useRef<HTMLInputElement>(null);

  // Saved once the picker closes ("change"), not on every drag through it
  // (React's onChange would save each step).
  useEffect(() => {
    const input = picker.current;
    if (!input) return;
    const pick = () => void save({ color: input.value });
    input.addEventListener("change", pick);
    return () => input.removeEventListener("change", pick);
  });

  async function save(change: Partial<User>) {
    setStatus(null);
    try {
      await users().update(user.id, change);
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
    }
  }

  return (
    <Section title={spell("My colour")}>
      <div className="stack profile-color">
        <span className="muted">
          {current?.name ?? (custom ? spell("Your own colour") : "None (the app's plum)")}. It marks your name and thumbs up around the
          app.
        </span>
        <div className="swatches" role="group" aria-label={spell("Choose my colour")}>
          {PERSON_COLORS.map((color) => (
            <button
              key={color.value}
              type="button"
              className="swatch"
              style={{ background: color.value }}
              aria-label={color.name}
              aria-pressed={color.value === user.color}
              title={color.name}
              onClick={() => void save({ color: color.value === user.color ? "" : color.value })}
            />
          ))}
          <button
            type="button"
            className="swatch swatch-any"
            style={custom ? ({ "--pick": user.color } as CSSProperties) : undefined}
            aria-label={spell("Any colour")}
            aria-pressed={custom}
            title={spell("Any colour")}
            onClick={() => {
              const input = picker.current;
              if (!input) return;
              // showPicker where the browser has it; a click opens it elsewhere.
              if (typeof input.showPicker === "function") input.showPicker();
              else input.click();
            }}
          />
          <input ref={picker} type="color" className="swatch-picker" defaultValue={user.color || "#0c8599"} tabIndex={-1} aria-hidden="true" />
        </div>
      </div>
      <Status status={status} />
    </Section>
  );
}

function PasswordSection({ user }: { user: User }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);
  useUnsavedChanges(!!(current || next || again));

  async function change(event: FormEvent) {
    event.preventDefault();
    if (next.length < 8) return setStatus({ text: "The new password needs at least 8 characters.", isError: true });
    if (next !== again) return setStatus({ text: "The two new passwords don't match.", isError: true });
    setBusy(true);
    setStatus(null);
    try {
      await users().update(user.id, { oldPassword: current, password: next, passwordConfirm: again });
    } catch (err) {
      const message = errorMessage(err);
      setStatus({ text: /oldPassword/i.test(message) ? "Your current password isn't right." : message, isError: true });
      setBusy(false);
      return;
    }
    try {
      // A new password logs out every device, this one included, so log
      // straight back in with it.
      await users().authWithPassword(user.username, next);
      setCurrent("");
      setNext("");
      setAgain("");
      setStatus({ text: "Password changed. Your other devices will ask you to log in again.", isError: false });
    } catch (err) {
      setStatus({ text: `Password changed, but logging back in failed: ${errorMessage(err)}`, isError: true });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section title="Password">
      <form className="stack" onSubmit={change}>
        <label>
          Current password
          <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
        </label>
        <label>
          New password
          <span className="hint">At least 8 characters.</span>
          <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
        </label>
        <label>
          New password again
          <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required />
        </label>
        <div className="actions">
          <button className="button primary" disabled={busy || !current || !next || !again}>
            {busy ? "Changing…" : "Change password"}
          </button>
        </div>
        <Status status={status} />
      </form>
    </Section>
  );
}
