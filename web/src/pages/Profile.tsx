import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router";
import { displayName, errorMessage, logOut, PERSON_COLORS, useCurrentUser, users, type User } from "../pb";
import Avatar from "../Avatar";
import { cleanUsername, MIN_PASSWORD } from "../accounts";
import { squarePicture } from "../avatarImage";
import { useUnsavedChanges } from "../unsavedChanges";
import { askFirst } from "../askFirst";
import { erasePhone, isPhoneMode, switchToServer } from "../phoneMode";
import { BenMood } from "../Brand";
import { CameraIcon, ChevronIcon, CloseIcon, LogOutIcon } from "../icons";
import { HelpBox, HelpButton, useHelp } from "../Help";
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
      <WhoSection user={user} phone={phone} />
      {!phone && <LoggingInSection user={user} />}
      {!phone && <HouseholdLink />}
      <LeaveButton phone={phone} />
      <DeleteSection user={user} />
    </div>
  );
}

// Who's in the household, and adding someone (its country, spoons and
// meals are in Settings). Not on a phone-only Bento, which nobody can join.
function HouseholdLink() {
  const singleUser = useSingleUser();
  return (
    <ul className="settings-list profile-links">
      <li>
        <Link to="/household" className="setting-row">
          <span className="menu-item-text">
            {singleUser ? "Share Bentotachi" : "Household"}
            <span className="menu-item-detail">
              {singleUser ? "Add someone to use it with you" : "Who has an account; add someone"}
            </span>
          </span>
          <ChevronIcon />
        </Link>
      </li>
    </ul>
  );
}

// The way out, an action rather than a setting, so a button of its own in
// the middle: Log out, or on a phone-only Bento, which logs itself in, the
// way to the household's server instead (where people look for a way out).
function LeaveButton({ phone }: { phone: boolean }) {
  return (
    <div className="profile-action">
      {phone ? (
        <button type="button" className="button" onClick={() => void switchToServer()}>
          <LogOutIcon /> Join a household
        </button>
      ) : (
        <button
          type="button"
          className="button"
          onClick={() => logOut()}
        >
          <LogOutIcon /> Log out
        </button>
      )}
    </div>
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
        logOut();
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
      <div className="profile-action">
        <button className="button danger small" onClick={() => void remove()} disabled={busy}>
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

// You, at the top, in one box: your picture beside your display name, and
// your colour under them. Tapping the picture changes it; the small round
// button in its corner takes it off (✕), or with no picture yet, says it
// can be added (📷).
function WhoSection({ user, phone }: { user: User; phone: boolean }) {
  const nameHelp = useHelp();
  const input = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(user.name);
  const [busy, setBusy] = useState<"" | "picture" | "name">("");
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);
  const changed = name.trim() !== user.name;
  useUnsavedChanges(changed);

  async function upload(file: File | undefined) {
    if (!file) return;
    setBusy("picture");
    setStatus(null);
    try {
      await users().update(user.id, { avatar: await squarePicture(file) });
      setStatus({ text: "Picture saved.", isError: false });
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
    } finally {
      setBusy("");
      if (input.current) input.current.value = "";
    }
  }

  async function removePicture() {
    setBusy("picture");
    setStatus(null);
    try {
      await users().update(user.id, { avatar: null });
      setStatus({ text: "Picture removed.", isError: false });
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
    } finally {
      setBusy("");
    }
  }

  async function saveName(event: FormEvent) {
    event.preventDefault();
    setBusy("name");
    setStatus(null);
    try {
      await users().update(user.id, { name: name.trim() });
      setStatus({ text: "Saved.", isError: false });
    } catch (err) {
      setStatus({ text: errorMessage(err), isError: true });
    } finally {
      setBusy("");
    }
  }

  const pictureLabel = user.avatar ? "Change picture" : "Add a picture";
  return (
    <section className="card profile-who">
      <div className="profile-avatar">
        <button
          type="button"
          className="avatar-change"
          onClick={() => input.current?.click()}
          disabled={!!busy}
          aria-label={pictureLabel}
          title={pictureLabel}
        >
          <Avatar user={user} size={88} />
        </button>
        {user.avatar ? (
          <button
            type="button"
            className="avatar-corner"
            onClick={() => void removePicture()}
            disabled={!!busy}
            aria-label="Remove picture"
            title="Remove picture"
          >
            <CloseIcon />
          </button>
        ) : (
          // Says the picture can be added; the circle itself does it.
          <span className="avatar-corner" aria-hidden="true">
            <CameraIcon size={14} />
          </span>
        )}
        <input
          ref={input}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => void upload(e.target.files?.[0])}
          aria-label="Choose a profile picture"
        />
      </div>
      <form className="stack profile-name-form" onSubmit={saveName}>
        <div className="field-with-help">
          <span>
            <label htmlFor="profile-name">Display name</label>
            <HelpButton help={nameHelp} label="Where my name shows" />
          </span>
          <HelpBox help={nameHelp}>
            <p>Your name around Bentotachi, like on ratings, the dinner plan and fridge notes.</p>
          </HelpBox>
          {/* Save on the box's own row, so it takes no row of its own. */}
          <div className="inline-save">
            <input
              id="profile-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={40}
              placeholder={phone ? "Your name" : user.username}
            />
            {/* On a phone on its own, the username is made up ("testcook"),
                so an empty name would show that around the app. */}
            <button className="button primary small" disabled={!!busy || !changed || (phone && !name.trim())}>
              {busy === "name" ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
        {busy === "picture" && <p className="muted small-note">Saving the picture…</p>}
        <Status status={status} />
      </form>
      <hr className="profile-divider" />
      <ColorPicker user={user} />
    </section>
  );
}

// What you log in with, in one box: the username (saved on its own), then
// the password.
function LoggingInSection({ user }: { user: User }) {
  return (
    <Section title="Logging in">
      <UsernameForm user={user} />
      <hr className="profile-divider" />
      <PasswordForm user={user} />
    </Section>
  );
}

function UsernameForm({ user }: { user: User }) {
  const help = useHelp();
  const [username, setUsername] = useState(user.username);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);
  const changed = username !== user.username;
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
      await users().update(user.id, { username });
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
    <form className="stack" onSubmit={save}>
      <div className="field-with-help">
        <span>
          <label htmlFor="profile-username">Username</label>
          <HelpButton help={help} label="What a username can be" />
        </span>
        <HelpBox help={help}>
          <p>What you log in with: lowercase letters, numbers, dots, dashes and underscores.</p>
        </HelpBox>
        <div className="inline-save">
          <input
            id="profile-username"
            value={username}
            onChange={(e) => setUsername(cleanUsername(e.target.value))}
            maxLength={30}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            autoComplete="username"
            required
          />
          <button className="button primary small" disabled={busy || !changed}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
      <Status status={status} />
    </form>
  );
}

// My color: marks your name and thumbs up around the app. Eight ready-made
// ones, or any at all from the device's picker (the rainbow). Tap the chosen
// one again for Bentotachi's usual plum (the accent).
function ColorPicker({ user }: { user: User }) {
  const spell = useSpell();
  const help = useHelp();
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
    <div className="stack profile-color">
      <span className="field-head">
        <strong>{spell("My colour")}</strong>
        <span className="muted">{current?.name ?? (custom ? spell("Your own colour") : "None (the app's plum)")}</span>
        <HelpButton help={help} label={spell("What my colour does")} />
      </span>
      <HelpBox help={help}>
        <p>It marks your name and thumbs up around the app, and the paper of your notes on the fridge door.</p>
      </HelpBox>
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
      <Status status={status} />
    </div>
  );
}

function PasswordForm({ user }: { user: User }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [again, setAgain] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ text: string; isError: boolean } | null>(null);
  useUnsavedChanges(!!(current || next || again));

  async function change(event: FormEvent) {
    event.preventDefault();
    if (next.length < MIN_PASSWORD) return setStatus({ text: `The new password needs at least ${MIN_PASSWORD} characters.`, isError: true });
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
    <form className="stack" onSubmit={change}>
      <label>
        Current password
        <input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" required />
      </label>
      <label>
        New password
        <span className="hint">At least {MIN_PASSWORD} characters.</span>
        <input type="password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" required />
      </label>
      <label>
        New password again
        <input type="password" value={again} onChange={(e) => setAgain(e.target.value)} autoComplete="new-password" required />
      </label>
      <div className="actions">
        <button className="button primary small" disabled={busy || !current || !next || !again}>
          {busy ? "Changing…" : "Change password"}
        </button>
      </div>
      <Status status={status} />
    </form>
  );
}
