// Shown when Bento can't reach the server and is showing the recipes saved
// on this phone instead.
export default function OfflineNote() {
  return (
    <p className="offline-note" role="status">
      <span>
        <strong>Offline.</strong> Showing the recipes saved on this phone, without photos. Changes need a connection.
      </span>
      <button className="button small" onClick={() => window.location.reload()}>
        Try again
      </button>
    </p>
  );
}
