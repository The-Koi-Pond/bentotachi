import type { ReactNode } from "react";

// Shown when Bento can't reach the server and is showing what's saved on
// this phone instead (recipes, unless a page says otherwise). Try again
// reloads the page, unless it has its own way to retry. A page with its own
// heading gets it on a line of its own, above the explanation.
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
      <button className="button small" onClick={onRetry ?? (() => window.location.reload())}>
        Try again
      </button>
    </p>
  );
}
