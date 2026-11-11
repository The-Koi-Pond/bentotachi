import type { ReactNode } from "react";
import { connection } from "./connection";
import { showError } from "./toast";

async function tryAgain() {
  await connection.checkNow();
  if (connection.get().reachable === false) showError("Still can't reach the server.");
}

// Shown when Bento can't reach the server and is showing what's saved on
// this phone instead (recipes, unless a page says otherwise): what this page
// can and can't do now. Why the server can't be reached (Tailscale, when it
// was last heard from) is in the indicator beside ⋮ (ConnectionStatus.tsx).
// Try again asks the server, and every open list (and recipe) loads again
// if it answers, unless the page has its own way to retry: never by
// reloading the page, which in a browser with the server away would swap
// the app for the browser's error page. A page with its own heading gets
// it on a line of its own, above the explanation.
export default function OfflineNote({
  children,
  heading,
  onRetry,
}: {
  children?: ReactNode;
  heading?: string;
  onRetry?: () => void;
}) {
  return (
    <p className="offline-note" role="status">
      <span>
        {heading ? <strong className="offline-heading">{heading}</strong> : <strong>Offline.</strong>}{" "}
        {children ?? "Showing the recipes saved on this phone, without photos. Changes need a connection."}
      </span>
      <button className="button small" onClick={onRetry ?? tryAgain}>
        Try again
      </button>
    </p>
  );
}
