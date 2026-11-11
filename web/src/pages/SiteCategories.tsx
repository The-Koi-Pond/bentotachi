import { useEffect, useLayoutEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router";
import { pageScroller, pageScrollTarget } from "../pageScroll";
import { errorMessage } from "../pb";
import { siteCategories, type RecipeList, type SiteCategory } from "../recipeImport";
import { categoriesPath } from "../recipeSites";
import RecipePicker from "../RecipePicker";
import { SiteLink, useSiteOpener } from "../SiteOpener";
import { CloseIcon } from "../icons";

type Found = { categories: SiteCategory[]; list: RecipeList | null };

// Lists of categories already read this visit, so Back from a category
// shows the menu at once instead of reading the site again. Not a page with
// recipes on it: those carry which recipes are already here, which adding
// some changes.
const readBefore = new Map<string, Found>();
const keyOf = (url: string, inside: boolean) => `${inside ? "inside" : "site"} ${url}`;

// How far down each level was scrolled, by its place in the history
// (location.key), so Back lands where it was. The screen scrolls inside
// .page-scroll, which the browser doesn't restore by itself.
const scrolledTo = new Map<string, number>();

// Browse's "Categories": a site's categories, read from its own menu by the
// server, as a plain list; inside one, its recipes to tick and add
// (RecipePicker), and any categories it holds itself. The filter is kept
// in the address too, so Back brings it back. Each level is drawn afresh
// (the key), so nothing of one level shows on the next.
export default function SiteCategories() {
  const [searchParams] = useSearchParams();
  const url = searchParams.get("url") ?? "";
  const inside = searchParams.get("inside") === "1";
  return <CategoriesLevel key={keyOf(url, inside)} url={url} inside={inside} />;
}

function CategoriesLevel({ url, inside }: { url: string; inside: boolean }) {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const name = searchParams.get("name") ?? "";
  const key = keyOf(url, inside);
  // The box's own text, so typing in the middle of it keeps the cursor
  // there; the address follows it.
  const [filter, setFilterText] = useState(() => searchParams.get("find") ?? "");
  // Read while drawing, so the first frame after Back is already the whole
  // list, at full height for its scroll to come back to.
  const [found, setFound] = useState<Found | null>(() => readBefore.get(key) ?? null);
  const [error, setError] = useState("");
  const { open, status } = useSiteOpener();

  useEffect(() => {
    if (readBefore.has(key)) return;
    let current = true;
    siteCategories(url, { inside })
      .then((answer) => {
        if (!answer.list) readBefore.set(key, answer);
        if (current) setFound(answer);
      })
      .catch((err) => current && setError(errorMessage(err)));
    return () => {
      current = false;
    };
  }, [key, url, inside]);

  // Where this level was scrolled to comes back once, as it opens: typing in
  // the filter replaces the address (a new location.key) but stays put.
  useLayoutEffect(() => {
    pageScroller().scrollTop = scrolledTo.get(location.key) ?? 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A layout effect too, so the level being left stops listening before the
  // next one moves the scroll.
  useLayoutEffect(() => {
    const page = pageScroller();
    const remember = () => scrolledTo.set(location.key, page.scrollTop);
    remember();
    const target = pageScrollTarget();
    target.addEventListener("scroll", remember, { passive: true });
    return () => target.removeEventListener("scroll", remember);
  }, [location.key]);

  function setFilter(text: string) {
    setFilterText(text);
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (text) next.set("find", text);
        else next.delete("find");
        return next;
      },
      { replace: true }
    );
  }

  const words = filter.trim().toLowerCase();
  const shown = (found?.categories ?? []).filter((category) => category.title.toLowerCase().includes(words));

  return (
    <div className="stack narrow">
      <h1 className={inside ? "category-title" : undefined}>{name}</h1>
      {status}
      {!found && !error && (
        <p className="muted" role="status">
          {inside ? "Reading the page…" : "Reading the site's menu…"}
        </p>
      )}
      {error && (
        <>
          <p className="error">{error}</p>
          <ul className="site-list">
            <li>
              <SiteLink href={url} onOpen={open}>
                <span className="site-name">{inside ? `Open “${name}” on the site` : `Open ${name}`}</span>
              </SiteLink>
            </li>
          </ul>
        </>
      )}

      {found && found.categories.length > 0 && (
        <section className="stack">
          {found.list && <h2>Categories</h2>}
          {!inside && <p className="muted">From the site's own menu. Open one to tick the recipes you want.</p>}
          {/* A big site's menu runs to dozens. */}
          {found.categories.length > 12 && (
            <div className="clearable">
              <input
                type="search"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                placeholder="Find a category"
                aria-label="Find a category"
              />
              {filter && (
                <button type="button" className="clear-field" aria-label="Clear" title="Clear" onClick={() => setFilter("")}>
                  <CloseIcon />
                </button>
              )}
            </div>
          )}
          {shown.length > 0 ? (
            <ul className="site-list">
              {shown.map((category) => (
                <li key={category.url}>
                  <Link className="site-row" to={categoriesPath({ name: category.title, url: category.url, inside: true })}>
                    <span className="site-name">{category.title}</span>
                    <span className="site-go" aria-hidden="true">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No category called that.</p>
          )}
        </section>
      )}

      {/* The page's own title names it already. */}
      {found?.list && <RecipePicker key={url} list={found.list} showTitle={false} />}
    </div>
  );
}
