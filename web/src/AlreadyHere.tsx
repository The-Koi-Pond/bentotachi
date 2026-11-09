import { Link } from "react-router";

// "You already have this one": shown instead of saving a second copy of a
// recipe page that's already here (recipeImport.ts).
// Open it, or add another copy anyway (to change one, say).
export default function AlreadyHere({
  duplicate,
  busy,
  onAgain,
}: {
  duplicate: { id: string; title: string };
  busy: boolean;
  onAgain: () => void;
}) {
  return (
    <div className="card stack already-here" role="status">
      <p>
        Déjà vu: you already have <Link to={`/recipes/${duplicate.id}`}>“{duplicate.title || "this recipe"}”</Link> from that link.
      </p>
      <div className="actions">
        <button className="button" onClick={onAgain} disabled={busy}>
          {busy ? "Adding…" : "Add another copy"}
        </button>
        <Link className="button primary" to={`/recipes/${duplicate.id}`}>
          Open it
        </Link>
      </div>
    </div>
  );
}
