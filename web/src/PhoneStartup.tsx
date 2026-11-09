import { useEffect, useState, type ReactNode } from "react";
import { BentoLogo } from "./Brand";
import { errorMessage, pb } from "./pb";
import { leavePhoneMode, logInOnPhone, rescuePhone, startPhoneServer } from "./phoneMode";

// In phone-only mode, Bento's server has to be running before anything else
// loads: this starts it (a moment the first time, as it sets up its
// database), logs in with the phone's account, then shows the app. If it
// won't start, "Save my data" still gets everything off the phone, as a
// backup file (see rescuePhone).
export default function PhoneStartup({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"starting" | "ready" | { error: string }>("starting");
  const [rescue, setRescue] = useState<{ text: string; isError: boolean } | null>(null);

  async function start() {
    setState("starting");
    try {
      await startPhoneServer();
      if (!pb.authStore.isValid) await logInOnPhone();
      setState("ready");
    } catch (err) {
      setState({ error: errorMessage(err) });
    }
  }

  async function saveData() {
    setRescue(null);
    try {
      if (await rescuePhone()) setRescue({ text: "Saved. Your data is safe in that file.", isError: false });
    } catch (err) {
      setRescue({ text: errorMessage(err), isError: true });
    }
  }

  useEffect(() => {
    void start();
  }, []);

  if (state === "ready") return children;
  return (
    <main className="login">
      <div className="card stack login-card phone-startup">
        <BentoLogo className="login-logo" />
        {state === "starting" ? (
          <p className="muted" role="status">
            Waking Bentotachi up…
          </p>
        ) : (
          <>
            <p className="error">{state.error}</p>
            <button className="button primary" onClick={() => void start()}>
              Try again
            </button>
            <p className="muted small-note">
              Your recipes are still on this phone. To keep them safe while this gets fixed, save them as a backup file
              (somewhere like Google Drive). It can be restored later.
            </p>
            <button className="button" onClick={() => void saveData()}>
              Save my data
            </button>
            {rescue && <p className={rescue.isError ? "error" : "success"}>{rescue.text}</p>}
            <button
              className="link-button"
              onClick={() => {
                leavePhoneMode();
                window.location.reload();
              }}
            >
              Connect to a server instead
            </button>
          </>
        )}
      </div>
    </main>
  );
}
