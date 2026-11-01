import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { errorMessage, pb } from "../pb";
import { browseAndSave, hasBuiltInBrowser } from "../bentoBrowser";
import { CloseIcon } from "../icons";
import { savedPageLink, trimSavedPage } from "../savedPage";
import { BenMood } from "../Brand";

// An import error, with its "add it by hand" turned into the link to the
// add-by-hand form. Errors that don't say it get "You can still add it by
// hand." on the end, so there's always a way on. The onigiri screams beside it.
function ImportError({ error, handLink }: { error: string; handLink: string }) {
  const match = error.match(/^([\s\S]*?)(add (?:it|the recipe) by hand)(\.?)\s*$/i);
  return (
    <div className="with-ben">
      <BenMood mood="scream" small />
      {match ? (
        <p className="error">
          {match[1]}
          <Link to={handLink}>{match[2]}</Link>
          {match[3]}
        </p>
      ) : (
        <p className="error">
          {error} You can still <Link to={handLink}>add it by hand</Link>.
        </p>
      )}
    </div>
  );
}

export default function AddRecipe() {
  const navigate = useNavigate();
  // A link shared to Bento from another app arrives as "#/add?url=…".
  const [searchParams, setSearchParams] = useSearchParams();
  const sharedUrl = searchParams.get("url") ?? "";
  const sharedWithoutLink = searchParams.get("shared") === "nolink";
  const [url, setUrl] = useState(sharedUrl);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const importedShare = useRef("");
  const linkBox = useRef<HTMLInputElement>(null);
  const pagePicker = useRef<HTMLInputElement>(null);
  const [pageError, setPageError] = useState("");

  async function importLink(link: string, replace = false) {
    setBusy(true);
    setError("");
    try {
      const result = await pb.send<{ id: string }>("/api/cookbook/import", {
        method: "POST",
        body: { url: link.trim() },
      });
      navigate(`/recipes/${result.id}`, { replace });
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  // Import a shared link straight away (once, even if React runs this twice),
  // and take it out of the address so going back doesn't import it again.
  useEffect(() => {
    if (!sharedUrl || importedShare.current === sharedUrl) return;
    importedShare.current = sharedUrl;
    setUrl(sharedUrl);
    setSearchParams({}, { replace: true });
    void importLink(sharedUrl, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedUrl]);

  function submit(event: FormEvent) {
    event.preventDefault();
    void importLink(url);
  }

  // Android app only: open the page in Bento's browser and save it from
  // there, which works even when the site blocks the server.
  async function openInBrowser() {
    setBusy(true);
    setError("");
    try {
      const id = await browseAndSave(url.trim());
      if (id) navigate(`/recipes/${id}`);
      else setBusy(false);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  // Browsers without Bento's own: a page saved with Ctrl+S, sent like the
  // app's browser sends pages, which works even when the site blocks the
  // server. The link (for the photo and Original link) comes from the
  // page, else from the link box.
  async function importSavedPage(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setPageError("");
    try {
      const html = await file.text();
      const link = savedPageLink(html) || url.trim();
      if (!/^https?:\/\/\S+$/i.test(link)) {
        throw new Error("Couldn't tell which site that page is from. Paste its link in the box above, then pick the file again.");
      }
      const result = await pb.send<{ id: string }>("/api/cookbook/import", {
        method: "POST",
        body: { url: link, html: trimSavedPage(html) },
      });
      navigate(`/recipes/${result.id}`);
    } catch (err) {
      setPageError(errorMessage(err));
      setBusy(false);
    }
  }

  // "Add by hand" (both the button and the link in an error) brings the
  // link along when the box holds one, for the form's Original link.
  const typedLink = url.trim();
  const handLink = /^https?:\/\/\S+$/i.test(typedLink) ? `/new?source=${encodeURIComponent(typedLink)}` : "/new";

  return (
    <div className="stack narrow">
      <form className="card stack" onSubmit={submit}>
        <h2>Import from a link</h2>
        {sharedWithoutLink && !url && (
          <p className="muted">That share didn’t include a link. Paste the recipe’s link here instead.</p>
        )}
        <div className="clearable">
          <label>
            Recipe page link
            <input
              ref={linkBox}
              type="url"
              inputMode="url"
              placeholder="https://…"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
            />
          </label>
          {/* Empties the box (and its error) to try another link. Outside
              the label, so it isn't read out as part of the box's name. */}
          {url && (
            <button
              type="button"
              className="clear-field"
              aria-label="Clear the link"
              title="Clear the link"
              disabled={busy}
              onClick={() => {
                setUrl("");
                setError("");
                linkBox.current?.focus();
              }}
            >
              <CloseIcon />
            </button>
          )}
        </div>
        {error && <ImportError error={error} handLink={handLink} />}
        {error && hasBuiltInBrowser && /^https?:\/\//i.test(url.trim()) && (
          <button type="button" className="button" onClick={openInBrowser} disabled={busy}>
            Open it in Bentotachi's browser
          </button>
        )}
        <button className="button primary" disabled={busy}>
          {busy ? "Importing…" : "Import"}
        </button>
      </form>

      {!hasBuiltInBrowser && (
        <div className="card stack">
          <h2>Import a saved page</h2>
          <p className="muted">
            For sites that block importing: open the recipe in your browser, press Ctrl+S to save the page, then
            pick the saved file here.
          </p>
          {pageError && <ImportError error={pageError} handLink={handLink} />}
          <button type="button" className="button" onClick={() => pagePicker.current?.click()} disabled={busy}>
            {busy ? "Importing…" : "Pick the saved page"}
          </button>
          <input
            ref={pagePicker}
            type="file"
            accept=".html,.htm,text/html"
            hidden
            aria-label="Choose a saved web page"
            onChange={(e) => {
              void importSavedPage(e.target.files?.[0]);
              // So picking the same file again (after an error) still counts.
              e.target.value = "";
            }}
          />
        </div>
      )}

      <div className="card stack">
        <h2>Type or paste it in</h2>
        <p className="muted">For family recipes, cookbooks, or anything that won’t import.</p>
        <Link to={handLink} className="button">
          Add by hand
        </Link>
      </div>
    </div>
  );
}
