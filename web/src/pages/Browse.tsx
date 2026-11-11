import { useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";
import { RECIPE_SITES, categoriesPath, hasCategories, normaliseSiteUrl, savedSiteSearchUrl, searchUrl, siteHost } from "../recipeSites";
import { hasBuiltInBrowser } from "../bentoBrowser";
import { SiteLink, useSiteOpener } from "../SiteOpener";
import { errorMessage, pb, savedSites, type SavedSite } from "../pb";
import { useLiveRecords } from "../useLiveRecords";
import { useUndo } from "../undo";
import { showError } from "../toast";
import { CloseIcon } from "../icons";
import { useUnsavedChanges } from "../unsavedChanges";
import { useSpell } from "../household";
import { remember, remembered } from "../phoneStorage";

// The last search stays until cleared (for this visit to Bento), so after
// saving a recipe found with it, coming back to Browse (Back, or the tab)
// still shows it, ready to look for more.
const SEARCH_KEY = "bento.browseSearch";

const rememberedSearch = () => remembered(SEARCH_KEY, { thisVisit: true }) ?? "";

const rememberSearch = (text: string) => remember(SEARCH_KEY, text || null, { thisVisit: true });

export default function Browse() {
  const spell = useSpell();
  const [text, setText] = useState(rememberedSearch);
  const [searched, setSearchedState] = useState(rememberedSearch);
  const searchBox = useRef<HTMLInputElement>(null);
  const setSearched = (value: string) => {
    setSearchedState(value);
    rememberSearch(value);
  };
  const { open: openInBento, status: openStatus } = useSiteOpener();
  const ours = useLiveRecords<SavedSite>("saved_sites");
  const undo = useUndo();
  const [addingSite, setAddingSite] = useState(false);
  const ourSites = [...(ours.items ?? [])]
    .filter((site) => !undo.hidden.has(site.id))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));

  // Gone at once, with Undo, rather than a question first.
  function removeSite(site: SavedSite) {
    undo.offer([site.id], `Removed “${site.name}”.`, async () => {
      ours.removeLocally(site.id);
      try {
        await savedSites().delete(site.id);
      } catch (err) {
        showError(errorMessage(err));
        ours.reload();
      }
    });
  }

  function search(event: FormEvent) {
    event.preventDefault();
    setSearched(text.trim());
  }

  return (
    <div className="stack narrow">
      <h1>Browse</h1>

      <form className="add-row joined" onSubmit={search} role="search">
        <div className="clearable">
          <input
            ref={searchBox}
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. lasagne"
            aria-label="Search recipe sites"
            enterKeyHint="search"
          />
          {/* Empties the box and the search, to start another. */}
          {(text || searched) && (
            <button
              type="button"
              className="clear-field"
              aria-label="Clear the search"
              title="Clear the search"
              onClick={() => {
                setText("");
                setSearched("");
                searchBox.current?.focus();
              }}
            >
              <CloseIcon />
            </button>
          )}
        </div>
        <button className="button primary" disabled={!text.trim()}>
          Search
        </button>
      </form>

      {openStatus}

      {searched && (
        <section className="stack tray-section" aria-live="polite">
          <h2>Search “{searched}” on…</h2>
          <ul className="site-list">
            {ourSites.map((site) => (
              <li key={site.id}>
                <SiteLink href={savedSiteSearchUrl(site.url, searched)} onOpen={openInBento}>
                  <span className="site-text">
                    <span className="site-name">{site.name}</span>
                    <span className="muted site-about">Searched with Google</span>
                  </span>
                </SiteLink>
              </li>
            ))}
            {RECIPE_SITES.map((site) => (
              <li key={site.name}>
                <SiteLink href={searchUrl(site, searched)} onOpen={openInBento}>
                  <span className="site-name">{site.name}</span>
                </SiteLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="stack tray-section">
        {/* "+ Add a site" on the heading's row; its form
            opens below, after the sites. */}
        <div className="section-head sites-head">
          <h2>Our sites</h2>
          {!addingSite && (
            <button className="button small" onClick={() => setAddingSite(true)}>
              + Add a site
            </button>
          )}
        </div>
        {ours.loadError && <p className="error">{ours.loadError}</p>}
        {ours.items && ourSites.length === 0 && <p className="muted">{spell("No regulars yet. Got a favourite haunt? Add it here.")}</p>}
        {ourSites.length > 0 && (
          <ul className="site-list">
            {ourSites.map((site) => (
              <li key={site.id} className="site-split site-saved">
                <SiteLink href={site.url} onOpen={openInBento}>
                  <span className="site-text">
                    <span className="site-name">{site.name}</span>
                    {site.name !== siteHost(site.url) && <span className="muted site-about">{siteHost(site.url)}</span>}
                  </span>
                </SiteLink>
                <CategoriesButton name={site.name} url={site.url} />
                <button
                  className="icon-button small site-remove"
                  onClick={() => removeSite(site)}
                  aria-label={`Remove ${site.name}`}
                  title="Remove"
                >
                  <CloseIcon />
                </button>
              </li>
            ))}
          </ul>
        )}
        {addingSite && <AddSiteForm onAdded={ours.upsert} onClose={() => setAddingSite(false)} />}
      </section>

      <section className="stack tray-section">
        <h2>Recipe sites</h2>
        <ul className="site-list">
          {RECIPE_SITES.map((site) => (
            <li key={site.name} className="site-split">
              <SiteLink href={site.home} onOpen={openInBento}>
                <span className="site-text">
                  <span className="site-name">{site.name}</span>
                  <span className="muted site-about">{site.about}</span>
                  {/* Bento's own browser reads the page itself, so blocking doesn't matter there. */}
                  {site.blocksImport && !hasBuiltInBrowser && (
                    <span className="site-note">Importing only works from the Android app (or add by hand)</span>
                  )}
                </span>
              </SiteLink>
              {hasCategories(site) && <CategoriesButton name={site.name} url={site.home} />}
            </li>
          ))}
        </ul>
      </section>

      <p className="muted">
        {hasBuiltInBrowser ? (
          <>
            Open a site, find a recipe you like (past the ads), then tap <strong>Save to Bentotachi</strong> at the top.
            Or tap a site's <strong>Categories</strong> to tick a whole bunch at once.
          </>
        ) : (
          <>
            Found one you like? Copy its link from the browser, then tap <strong>+</strong> at the top and paste it in.
            Or tap a site's <strong>Categories</strong> to tick a whole bunch at once.
          </>
        )}
      </p>
      {undo.toast}
    </div>
  );
}

// After "+ Add a site" (on the "Our sites" heading): the address and an
// optional name (it defaults to the site's address, like "example.com").
function AddSiteForm({ onAdded, onClose }: { onAdded: (site: SavedSite) => void; onClose: () => void }) {
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useUnsavedChanges(!!(address.trim() || name.trim()));

  async function add(event: FormEvent) {
    event.preventDefault();
    const url = normaliseSiteUrl(address);
    if (!url) {
      setError("That doesn't look like a web address. Try something like smittenkitchen.com");
      return;
    }
    setBusy(true);
    setError("");
    try {
      onAdded(
        await savedSites().create({ name: name.trim() || siteHost(url), url, added_by: pb.authStore.record?.id })
      );
      setAddress("");
      setName("");
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="card stack add-site" onSubmit={add}>
      <label>
        Address
        <input
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          placeholder="smittenkitchen.com"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          autoFocus
          required
        />
      </label>
      <label>
        <span className="label-text">
          Name <span className="optional">(optional)</span>
        </span>
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Smitten Kitchen" />
      </label>
      {error && <p className="error">{error}</p>}
      <div className="actions">
        <button type="button" className="button ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button className="button primary" disabled={busy || !address.trim()}>
          {busy ? "Adding…" : "Add site"}
        </button>
      </div>
    </form>
  );
}

// Beside a site: its categories as a plain list in Bentotachi
// (SiteCategories), to tick recipes from without the site's ads.
function CategoriesButton({ name, url }: { name: string; url: string }) {
  return (
    <Link className="button small site-categories" to={categoriesPath({ name, url })} aria-label={`${name} categories`}>
      Categories
    </Link>
  );
}
