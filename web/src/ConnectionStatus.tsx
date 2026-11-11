import { useState } from "react";
import { Link } from "react-router";
import { HelpBox, HelpButton, useHelp } from "./Help";
import { CloudOffIcon, CloudUploadIcon } from "./icons";
import { connection, heardWhen, useConnection } from "./connection";
import { useShoppingQueue } from "./shoppingQueue";
import { isAndroidApp, pb } from "./pb";
import { isPhoneMode } from "./phoneMode";
import { viaTailscale } from "./tailscale.ts";

// Beside ⋮ in the top bar, only when something's off: the server can't be
// reached (Bentotachi is showing what's saved on this phone), or shopping
// list changes are waiting to be sent. Nothing while all's well. Tapping it
// says what's going on, when the server last answered, and offers Try again.
export default function ConnectionStatus() {
  const { reachable, lastReached } = useConnection();
  const waiting = useShoppingQueue().length;
  const down = reachable === false;
  if (!down && waiting === 0) return null;
  // Its own component, so the bubble's open/closed starts afresh each time
  // it shows: one left "open" when it hid would be placed while hidden, and
  // open off the screen the next time.
  return <StatusButton down={down} lastReached={lastReached} waiting={waiting} />;
}

function StatusButton({ down, lastReached, waiting }: { down: boolean; lastReached: number | null; waiting: number }) {
  const help = useHelp();
  const [trying, setTrying] = useState(false);
  const address = isAndroidApp && !isPhoneMode() ? pb.baseURL.replace(/^https?:\/\//, "") : "";
  const tailscale = viaTailscale(isAndroidApp ? pb.baseURL : window.location.href);
  const changes = `${waiting} shopping list ${waiting === 1 ? "change" : "changes"}`;
  const label = down ? "Can't reach the server" : `${changes} waiting to send`;

  async function tryAgain() {
    setTrying(true);
    await connection.checkNow();
    setTrying(false);
  }

  return (
    <span className="connection-status">
      <HelpButton help={help} label={label} className={`icon-button connection-button${down ? " down" : ""}`}>
        {down ? <CloudOffIcon /> : <CloudUploadIcon />}
        {waiting > 0 && <span className="connection-count">{waiting}</span>}
      </HelpButton>
      <HelpBox help={help}>
        {down ? (
          <>
            <p>
              <strong>Can't reach your Bentotachi server.</strong> You're seeing what's saved on this phone
              {lastReached ? `, from when it last answered ${heardWhen(lastReached)}` : ""}.
            </p>
            {tailscale && <p>It goes through Tailscale, so check this phone's Tailscale is switched on.</p>}
            {address && <p className="muted">Server: {address}</p>}
            {waiting > 0 && <p>{changes} will be sent once it's back.</p>}
            <p>
              <button type="button" className="button small" onClick={() => void tryAgain()} disabled={trying}>
                {trying ? "Trying…" : "Try again"}
              </button>
            </p>
          </>
        ) : (
          <p>
            <strong>Back in touch.</strong> {changes} made offline go when the shopping list is open:{" "}
            <Link to="/shopping" onClick={() => help.setOpen(false)}>
              open it
            </Link>
            .
          </p>
        )}
      </HelpBox>
    </span>
  );
}
