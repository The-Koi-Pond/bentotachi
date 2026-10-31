import { useState, type FormEvent, type MouseEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { RECIPE_SITES, normaliseSiteUrl, savedSiteSearchUrl, searchUrl, siteHost } from "../recipeSites";
import { browseAndSave, hasBuiltInBrowser } from "../bentoBrowser";
import { errorMessage, pb, savedSites, type SavedSite } from "../pb";
import { useLiveRecords } from "../useLiveRecords";
import { CloseIcon } from "../icons";
import { useUnsavedChanges } from "../unsavedChanges";

export default function Browse() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const [searched, setSearched] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const ours = useLiveRecords<SavedSite>("saved_sites");
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
    try {
      setSaving(true);
      const id = await browseAndSave(url);
      if (id) navigate(`/recipes/${id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="stack narrow">
      <h1>Browse</h1>

      <form className="add-row" onSubmit={search} role="search">
        <input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="e.g. lasagne"
          aria-label="Search recipe sites"
          enterKeyHint="search"
        />
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
        <h2>Our sites</h2>
        {ours.loadError && <p className="error">{ours.loadError}</p>}
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
        <AddSiteForm onAdded={ours.upsert} />
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

// "+ Add a site": a closed button until tapped, then the address and an
// optional name (it defaults to the site's address, like "example.com").
function AddSiteForm({ onAdded }: { onAdded: (site: SavedSite) => void }) {
  const [open, setOpen] = useState(false);
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useUnsavedChanges(open && !!(address.trim() || name.trim()));

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
      setOpen(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button className="button small add-site-button" onClick={() => setOpen(true)}>
        + Add a site
      </button>
    );
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
        <button type="button" className="button ghost" onClick={() => setOpen(false)} disabled={busy}>
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
