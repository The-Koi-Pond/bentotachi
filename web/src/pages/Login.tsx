import { useEffect, useState, type FormEvent } from "react";
import { BentoLogo, BentoTitle } from "../Brand";
import { errorMessage, isAndroidApp, normaliseServerUrl, pb, savedServerUrl, setServerUrl } from "../pb";

// The login screen. On a brand-new server (no accounts yet) it becomes
// "Set up your Bento" instead, to make the first account.
export default function Login() {
  const [server, setServer] = useState(savedServerUrl);
  // Whether the server needs setting up: null until we know (or can't tell).
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);

  // Asks the server whether it has any accounts yet. In the app this waits
  // for a server address.
  function checkSetup() {
    if (isAndroidApp) {
      if (!server.trim()) return;
      setServerUrl(normaliseServerUrl(server));
    }
    pb.send<{ needsSetup: boolean }>("/api/cookbook/setup", {})
      .then((answer) => setNeedsSetup(answer.needsSetup))
      .catch(() => setNeedsSetup(null));
  }

  useEffect(() => {
    checkSetup();
    // Once, on opening; in the app, again when the address box is left.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="login">
      <div className="card stack login-card">
        <div className="login-brand">
          <BentoLogo className="login-logo" />
          <h1>
            <BentoTitle className="login-title" />
          </h1>
          <p className="login-tagline">Recipes · Plan · Pantry · Together</p>
        </div>
        {isAndroidApp && (
          <label>
            Server address
            <span className="hint">The address you were given, like 100.64.12.34:8090</span>
            {/* Plain text (with the web address keyboard): a type="url" box
                refuses addresses without http://, like the example above. */}
            <input
              inputMode="url"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              value={server}
              onChange={(e) => setServer(e.target.value)}
              onBlur={checkSetup}
              placeholder="100.64.12.34:8090"
              required
            />
          </label>
        )}
        {needsSetup ? <SetupForm server={server} /> : <LoginForm server={server} />}
      </div>
    </main>
  );
}

function LoginForm({ server }: { server: string }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isAndroidApp && !server.trim()) {
      setError("Type the server address first.");
      return;
    }
    setBusy(true);
    setError("");
    if (isAndroidApp) setServerUrl(normaliseServerUrl(server));
    // Usernames are stored in lowercase, so "Xel" works too. (An email
    // still works as well, for older accounts.)
    const identity = username.trim().includes("@") ? username.trim() : username.trim().toLowerCase();
    try {
      await pb.collection("users").authWithPassword(identity, password);
    } catch (err) {
      setError((err as { status?: number }).status === 400 ? "Wrong username or password." : errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <label>
        Username
        <input
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. xel"
          required
        />
      </label>
      <label>
        Password
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="button primary" disabled={busy}>
        {busy ? "Logging in…" : "Log in"}
      </button>
    </form>
  );
}

// Usernames: lowercase letters, numbers, dots, dashes and underscores.
const cleanUsername = (text: string) => text.toLowerCase().replace(/[^a-z0-9._-]/g, "");

// First-time setup on a new server: your account (and, with the same
// password, the server's admin account for its admin page).
function SetupForm({ server }: { server: string }) {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [again, setAgain] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (username.length < 2) return setError("Usernames need at least 2 characters.");
    if (password.length < 8) return setError("The password needs at least 8 characters.");
    if (password !== again) return setError("The two passwords don't match.");
    setBusy(true);
    setError("");
    if (isAndroidApp) setServerUrl(normaliseServerUrl(server));
    try {
      await pb.send("/api/cookbook/setup", { method: "POST", body: { name: name.trim(), username, password } });
      await pb.collection("users").authWithPassword(username, password);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="setup-intro">
        <h2>Set up your Bento</h2>
        <p className="muted">
          This Bento is brand new. Make your account first; you can add the rest of your household after, from the ⋮
          menu.
        </p>
      </div>
      <label>
        Your name
        <span className="hint">Your name around Bento, like on ratings.</span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Sam" required />
      </label>
      <label>
        Username
        <span className="hint">What you log in with. Lowercase letters, numbers, dots, dashes and underscores.</span>
        <input
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          value={username}
          onChange={(e) => setUsername(cleanUsername(e.target.value))}
          maxLength={30}
          placeholder="e.g. sam"
          required
        />
      </label>
      <label>
        Password
        <span className="hint">At least 8 characters.</span>
        <input
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      <label>
        Password again
        <input type="password" autoComplete="new-password" value={again} onChange={(e) => setAgain(e.target.value)} required />
      </label>
      <p className="muted small-note">
        This also makes you the server's admin. If you ever need its admin page ({isAndroidApp ? "the server address" : window.location.host}
        /_/), log in there with <strong>{username || "yourname"}@bento.local</strong> and this password.
      </p>
      {error && <p className="error">{error}</p>}
      <button className="button primary" disabled={busy}>
        {busy ? "Setting up…" : "Set up Bento"}
      </button>
    </form>
  );
}
