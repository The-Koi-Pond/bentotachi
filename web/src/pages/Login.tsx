import { useEffect, useState, type FormEvent } from "react";
import { BentoLogo, BentoTitle } from "../Brand";
import { errorMessage, isAndroidApp, normaliseServerUrl, pb, savedServerUrl, setServerUrl } from "../pb";
import { isPhoneMode, leavePhoneMode, phoneModeSupported, rememberPhoneAccount, setUpPhone } from "../phoneMode";

// The login screen. On a brand-new server (no accounts yet) it becomes
// "Set up your Bento" instead, to make the first account. In the app, with
// no server chosen yet, it starts with Bento on this phone (phone-only mode,
// see phoneMode.ts): just a name, nothing to set up. Connecting to a server
// is the smaller choice under it, for households sharing one. Phones that
// can't run phone-only mode go straight to the server.
export default function Login() {
  const phone = isPhoneMode();
  const firstRun = isAndroidApp && !phone && !savedServerUrl();
  const [step, setStep] = useState<"phone" | "server">(firstRun ? "phone" : "server");
  // Whether this phone can run phone-only mode: null until known.
  const [phoneOk, setPhoneOk] = useState<boolean | null>(isAndroidApp ? null : false);
  const [server, setServer] = useState(savedServerUrl);
  // Whether the server needs setting up: null until we know (or can't tell).
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  // In the app: the address typed couldn't be reached.
  const [unreachable, setUnreachable] = useState(false);

  useEffect(() => {
    void phoneModeSupported().then((ok) => {
      setPhoneOk(ok);
      if (!ok) setStep("server");
    });
  }, []);

  // Asks the server whether it has any accounts yet. In the app this waits
  // for a server address.
  function checkSetup() {
    if (phone) return;
    setUnreachable(false);
    if (isAndroidApp) {
      if (!server.trim()) return;
      setServerUrl(normaliseServerUrl(server));
    }
    pb.send<{ needsSetup: boolean }>("/api/cookbook/setup", {})
      .then((answer) => setNeedsSetup(answer.needsSetup))
      .catch((err) => {
        setNeedsSetup(null);
        if (isAndroidApp && (err as { status?: number }).status === 0) setUnreachable(true);
      });
  }

  useEffect(() => {
    checkSetup();
    // Once, on opening; in the app, again when the address box is left.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const brand = (
    <div className="login-brand">
      <BentoLogo className="login-logo" />
      <h1>
        <BentoTitle className="login-title" />
      </h1>
      <p className="login-tagline">Recipes · Plan · Pantry · Together</p>
    </div>
  );

  // Phone-only, but logged out: after restoring a backup made elsewhere,
  // log in with one of its accounts.
  if (phone)
    return (
      <main className="login">
        <div className="card stack login-card">
          {brand}
          <p className="muted">
            This Bento runs on this phone only. Log in with an account from the backup you restored.
          </p>
          <LoginForm server="" phone />
          <button
            className="link-button"
            onClick={() => {
              leavePhoneMode();
              window.location.reload();
            }}
          >
            Connect to a server instead
          </button>
        </div>
      </main>
    );

  // Still checking whether this phone can run it (a moment).
  if (step === "phone" && phoneOk === null)
    return (
      <main className="login">
        <div className="card stack login-card">{brand}</div>
      </main>
    );

  if (step === "phone")
    return (
      <main className="login">
        <div className="card stack login-card">
          {brand}
          <PhoneSetupForm />
          <div className="login-other">
            <p className="muted">Sharing with your household? A Bento server keeps everyone's phones in step.</p>
            <button className="button" onClick={() => setStep("server")}>
              Connect to a server
            </button>
          </div>
        </div>
      </main>
    );

  return (
    <main className="login">
      <div className="card stack login-card">
        {brand}
        {isAndroidApp && phoneOk === false && firstRun && (
          <p className="muted small-note">
            This phone can't run Bento by itself (it needs a newer, 64-bit phone), so it connects to a Bento server.
          </p>
        )}
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
        {unreachable && (
          <p className="error" role="status">
            Couldn't reach {normaliseServerUrl(server).replace(/^https?:\/\//, "")}. Check the address, that the server is
            on, and, if it uses Tailscale, that Tailscale is on on this phone too.
          </p>
        )}
        {needsSetup ? <SetupForm server={server} /> : <LoginForm server={server} />}
        {isAndroidApp && phoneOk && (
          <button className="link-button" onClick={() => setStep("phone")}>
            ← Or use Bento on this phone only
          </button>
        )}
      </div>
    </main>
  );
}

// "Just me, on this phone": only a name; Bento makes the account.
function PhoneSetupForm() {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await setUpPhone(name);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={submit}>
      <div className="setup-intro">
        <h2>Bento on this phone</h2>
        <p className="muted">
          Everything stays on this phone, so save a backup now and then (⋮ → Backups). You can move to a server later,
          to share with your household.
        </p>
      </div>
      <label>
        Your name
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Sam" required autoFocus />
      </label>
      {error && <p className="error">{error}</p>}
      <button className="button primary" disabled={busy}>
        {busy ? "Setting up… (a few seconds)" : "Start using Bento"}
      </button>
    </form>
  );
}

function LoginForm({ server, phone = false }: { server: string; phone?: boolean }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isAndroidApp && !phone && !server.trim()) {
      setError("Type the server address first.");
      return;
    }
    setBusy(true);
    setError("");
    if (isAndroidApp && !phone) setServerUrl(normaliseServerUrl(server));
    // Usernames are stored in lowercase, so "Xel" works too. (An email
    // still works as well, for older accounts.)
    const identity = username.trim().includes("@") ? username.trim() : username.trim().toLowerCase();
    try {
      await pb.collection("users").authWithPassword(identity, password);
      // Phone-only: log in by itself from now on.
      if (phone) rememberPhoneAccount({ username: identity, password });
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
