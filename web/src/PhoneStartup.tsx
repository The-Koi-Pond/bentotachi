import { useEffect, useState, type ReactNode } from "react";
import { BentoLogo } from "./Brand";
import { errorMessage, pb } from "./pb";
import { leavePhoneMode, logInOnPhone, startPhoneServer } from "./phoneMode";

// In phone-only mode, Bento's server has to be running before anything else
// loads: this starts it (a moment the first time, as it sets up its
// database), logs in with the phone's account, then shows the app.
export default function PhoneStartup({ children }: { children: ReactNode }) {
  const [state, setState] = useState<"starting" | "ready" | { error: string }>("starting");

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
            Starting Bento…
          </p>
        ) : (
          <>
            <p className="error">{state.error}</p>
            <button className="button primary" onClick={() => void start()}>
              Try again
            </button>
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
