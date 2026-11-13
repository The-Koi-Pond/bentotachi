import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router";
import { errorMessage } from "../pb";
import { browseAndSave, hasBuiltInBrowser, importBrowsedPage, takeRestoredPage } from "../bentoBrowser";
import { importRecipe, type ImportResult, type RecipeList } from "../recipeImport";
import AlreadyHere from "../AlreadyHere";
import RecipePicker from "../RecipePicker";
import { HelpBox, HelpButton, useHelp } from "../Help";
import { readPastedRecipe } from "../pastedRecipe";
import { CloseIcon } from "../icons";
import { savedPageLink, trimSavedPage } from "../savedPage";
import { BenMood } from "../Brand";
import { normaliseSiteUrl, sharedLink } from "../recipeSites";

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
  // A recipe from that page already here: offered instead of a second copy,
  // with how to add one anyway (AlreadyHere).
  const [duplicate, setDuplicate] = useState<{ id: string; title: string; again: () => void } | null>(null);
  // A page listing recipes, to pick some from (RecipePicker); Browse sends
  // one saved in the app's browser here too.
  const location = useLocation();
  const linkHelp = useHelp();
  const [list, setList] = useState<RecipeList | null>((location.state as { list?: RecipeList } | null)?.list ?? null);

  // The import's result: open the new recipe, offer the one already here,
  // or show the page's recipes to pick from.
  function landed(result: ImportResult, again: () => void, replace = false) {
    if ("id" in result) {
      navigate(`/recipes/${result.id}`, { replace });
      return;
    }
    if ("list" in result) setList(result.list);
    else setDuplicate({ ...result.duplicate, again });
    setBusy(false);
  }

  async function importLink(link: string, replace = false, again = false) {
    setBusy(true);
    setError("");
    setDuplicate(null);
    setList(null);
    try {
      landed(await importRecipe({ url: link.trim(), again }), () => void importLink(link, replace, true), replace);
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

  // A page saved in Bento's browser while Android had closed Bento in the
  // background arrives as "#/add?restored=1" (see bentoBrowser.ts).
  const restored = searchParams.get("restored") === "1";
  useEffect(() => {
    if (!restored) return;
    setSearchParams({}, { replace: true });
    const page = takeRestoredPage();
    if (!page) return;
    setUrl(page.url);
    void importPage(page, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restored]);

  // A link typed without "https://" ("www.site.com/soup") gets it, rather
  // than the browser's own check stopping it without a word (the form has
  // noValidate).
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!url.trim()) {
      setError("Paste the recipe page's link first.");
      return;
    }
    // A shared message with the link in it ("Easy lasagne https://…") works too.
    const link = normaliseSiteUrl(url) ?? sharedLink(url);
    if (!link) {
      setError("That doesn't look like a link. Copy the recipe page's address, then paste it here.");
      return;
    }
    if (link !== url.trim()) setUrl(link);
    void importLink(link);
  }

  // A page the app's browser loaded (now, or before Android closed Bento).
  async function importPage(page: { url: string; html: string }, replace = false, again = false) {
    setBusy(true);
    setError("");
    setDuplicate(null);
    setList(null);
    try {
      landed(await importBrowsedPage(page, again), () => void importPage(page, replace, true), replace);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  // Android app only: open the page in Bento's browser and save it from
  // there, which works even when the site blocks the server.
  async function openInBrowser() {
    setBusy(true);
    setError("");
    setDuplicate(null);
    setList(null);
    try {
      const saved = await browseAndSave(url.trim());
      if (saved) landed(saved.result, () => void importPage(saved.page, false, true));
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
    setDuplicate(null);
    try {
      const html = await file.text();
      const link = savedPageLink(html) || url.trim();
      if (!/^https?:\/\/\S+$/i.test(link)) {
        throw new Error("Couldn't tell which site that page is from. Paste its link in the box above, then pick the file again.");
      }
      const page = { url: link, html: trimSavedPage(html) };
      const again = async () => {
        setBusy(true);
        try {
          landed(await importRecipe({ ...page, again: true }), () => {});
        } catch (err) {
          setPageError(errorMessage(err));
          setBusy(false);
        }
      };
      landed(await importRecipe(page), () => void again());
    } catch (err) {
      setPageError(errorMessage(err));
      setBusy(false);
    }
  }

  // A whole recipe pasted as text: sorted into the add-by-hand form
  // (pastedRecipe.ts), to check and save there.
  const [pasted, setPasted] = useState("");
  const [pasteError, setPasteError] = useState("");
  function fillFromPaste() {
    const recipe = readPastedRecipe(pasted);
    if (!recipe) {
      setPasteError("Couldn't find ingredients or steps in that. Check it's the whole recipe, or add it by hand.");
      return;
    }
    navigate("/new", { state: { pasted: recipe } });
  }

  // "Add by hand" (both the button and the link in an error) brings the
  // link along when the box holds one, for the form's Original link.
  const typedLink = url.trim();
  const handLink = /^https?:\/\/\S+$/i.test(typedLink) ? `/new?source=${encodeURIComponent(typedLink)}` : "/new";

  return (
    <div className="stack narrow">
      <h1>Add a recipe</h1>
      <form className="card stack" onSubmit={submit} noValidate>
        <h2>
          Import from a link
          <HelpButton help={linkHelp} label="What links work" />
        </h2>
        <HelpBox help={linkHelp}>
          <p>A recipe's page on any recipe website.</p>
          <p>
            A site's category or collection page works too, like RecipeTin Eats' “Quick and easy”: you get its recipes
            to tick, then add them all at once.
          </p>
        </HelpBox>
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
      {duplicate && <AlreadyHere duplicate={duplicate} busy={busy} onAgain={duplicate.again} />}
      {list && <RecipePicker key={list.recipes[0]?.url} list={list} />}

      {!hasBuiltInBrowser && (
        <div className="card stack">
          <h2>Import a saved page</h2>
          <p className="muted">
            For sites that block importing, on a computer: open the recipe in your browser, press Ctrl+S (⌘S on a
            Mac) to save the page, then pick the saved file here.
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
        <p className="muted">
          For Nan's recipe card, cookbooks, a recipe someone sent you, or a caption under a video. Paste the whole thing and
          Bentotachi sorts it into the form for you to check.
        </p>
        <label>
          Paste a recipe
          <textarea
            rows={5}
            value={pasted}
            onChange={(e) => {
              setPasted(e.target.value);
              setPasteError("");
            }}
            placeholder={"Name\nIngredients\n…\nMethod\n…"}
          />
        </label>
        {pasteError && <p className="error" role="alert">{pasteError}</p>}
        <div className="actions">
          <Link to={handLink} className="button">
            Add by hand
          </Link>
          <button className="button primary" onClick={fillFromPaste} disabled={!pasted.trim()}>
            Sort it out
          </button>
        </div>
      </div>
    </div>
  );
}
