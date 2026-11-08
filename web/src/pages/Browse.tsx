import { useRef, useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { RECIPE_SITES, normaliseSiteUrl, savedSiteSearchUrl, searchUrl, siteHost } from "../recipeSites";
import { browseAndSave, hasBuiltInBrowser, importBrowsedPage } from "../bentoBrowser";
import AlreadyHere from "../AlreadyHere";
import { errorMessage, pb, savedSites, type SavedSite } from "../pb";
import { useLiveRecords } from "../useLiveRecords";
import { CloseIcon } from "../icons";
import { useUnsavedChanges } from "../unsavedChanges";

// The last search stays until cleared (for this visit to Bento), so after
// saving a recipe found with it, coming back to Browse (Back, or the tab)
// still shows it, ready to look for more.
const SEARCH_KEY = "bento.browseSearch";

function rememberedSearch(): string {
  try {
    return sessionStorage.getItem(SEARCH_KEY) ?? "";
  } catch {
    return "";
  }
}

function rememberSearch(text: string) {
  try {
    if (text) sessionStorage.setItem(SEARCH_KEY, text);
    else sessionStorage.removeItem(SEARCH_KEY);
  } catch {
    // Storage blocked: the search just won't be kept.
  }
}

export default function Browse() {
  const navigate = useNavigate();
  const [text, setText] = useState(rememberedSearch);
  const [searched, setSearchedState] = useState(rememberedSearch);
  const searchBox = useRef<HTMLInputElement>(null);
  const setSearched = (value: string) => {
    setSearchedState(value);
    rememberSearch(value);
  };
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  // A recipe saved from the browser that's already here (AlreadyHere).
  const [duplicate, setDuplicate] = useState<{ id: string; title: string; page: { url: string; html: string } } | null>(null);
  const ours = useLiveRecords<SavedSite>("saved_sites");
  const [addingSite, setAddingSite] = useState(false);
  const ourSites = [...(ours.items ?? [])].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
  );

  async function removeSite(site: SavedSite) {
    if (!window.confirm(`Remove “${site.name}” from our sites?`)) return;
    setError("");
    ours.removeLocally(site.id);
    try {
      await savedSites().delete(site.id);
    } catch (err) {
      setError(errorMessage(err));
      ours.reload();
    }
  }

  function search(event: FormEvent) {
    event.preventDefault();
    setSearched(text.trim());
  }

  // In the Android app, open Bento's own browser; a recipe saved there opens
  // straight away. In a web browser the link opens in a new tab instead.
  async function openInBento(event: MouseEvent, url: string) {
    if (!hasBuiltInBrowser) return;
    event.preventDefault();
    setError("");
    setDuplicate(null);
    try {
      setSaving(true);
      const saved = await browseAndSave(url);
      if (!saved) return;
      if ("id" in saved.result) navigate(`/recipes/${saved.result.id}`);
      else setDuplicate({ ...saved.result.duplicate, page: saved.page });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  // "Add another copy" of a recipe already here.
  async function saveAgain() {
    if (!duplicate) return;
    setSaving(true);
    try {
      const result = await importBrowsedPage(duplicate.page, true);
      if ("id" in result) navigate(`/recipes/${result.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setDuplicate(null);
    } finally {
      setSaving(false);
    }
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

      {saving && (
        <p className="muted" role="status">
          Saving the recipe…
        </p>
      )}
      {error && <p className="error">{error}</p>}
      {duplicate && <AlreadyHere duplicate={duplicate} busy={saving} onAgain={() => void saveAgain()} />}

      {searched && (
        <section className="stack" aria-live="polite">
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

      <section className="stack">
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
        {ours.items?.length === 0 && <p className="muted">The recipe sites you keep going back to, one tap away.</p>}
        {ourSites.length > 0 && (
          <ul className="site-list">
            {ourSites.map((site) => (
              <li key={site.id} className="site-saved">
                <SiteLink href={site.url} onOpen={openInBento}>
                  <span className="site-text">
                    <span className="site-name">{site.name}</span>
                    {site.name !== siteHost(site.url) && <span className="muted site-about">{siteHost(site.url)}</span>}
                  </span>
                </SiteLink>
                <button
                  className="icon-button small site-remove"
                  onClick={() => void removeSite(site)}
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

      <section className="stack">
        <h2>Recipe sites</h2>
        <ul className="site-list">
          {RECIPE_SITES.map((site) => (
            <li key={site.name}>
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
            </li>
          ))}
        </ul>
      </section>

      <p className="muted">
        {hasBuiltInBrowser ? (
          <>
            Open a site, find a recipe you like, then tap <strong>Save to Bentotachi</strong> at the top.
          </>
        ) : (
          <>
            Found one you like? Copy its link from the browser, then tap <strong>+</strong> at the top and paste it in.
          </>
        )}
      </p>
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

function SiteLink({
  href,
  onOpen,
  children,
}: {
  href: string;
  onOpen: (event: MouseEvent, url: string) => void;
  children: ReactNode;
}) {
  return (
    <a href={href} className="site-row" target="_blank" rel="noopener noreferrer" onClick={(event) => onOpen(event, href)}>
      {children}
      <span className="site-go" aria-hidden="true">
        {hasBuiltInBrowser ? "›" : "↗"}
      </span>
    </a>
  );
}
