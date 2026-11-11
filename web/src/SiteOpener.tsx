import { useState, type MouseEvent, type ReactNode } from "react";
import { useNavigate } from "react-router";
import { browseAndSave, hasBuiltInBrowser, importBrowsedPage } from "./bentoBrowser";
import AlreadyHere from "./AlreadyHere";
import { errorMessage } from "./pb";
import { showError } from "./toast";

// Opening a recipe site from Browse or its categories. In the Android app
// it opens Bento's own browser, and a page saved there lands straight away:
// a recipe opens, a category's recipes go to Add to tick, one already here
// is offered (AlreadyHere). In a web browser the link opens in a new tab.
// `status` shows the saving and the "already here" offer: put it near the top.
export function useSiteOpener() {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  const [duplicate, setDuplicate] = useState<{ id: string; title: string; page: { url: string; html: string } } | null>(null);

  async function open(event: MouseEvent, url: string) {
    if (!hasBuiltInBrowser) return;
    event.preventDefault();
    setDuplicate(null);
    try {
      setSaving(true);
      const saved = await browseAndSave(url);
      if (!saved) return;
      if ("id" in saved.result) navigate(`/recipes/${saved.result.id}`);
      else if ("list" in saved.result) navigate("/add", { state: { list: saved.result.list } });
      else setDuplicate({ ...saved.result.duplicate, page: saved.page });
    } catch (err) {
      showError(errorMessage(err));
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
      showError(errorMessage(err));
      setDuplicate(null);
    } finally {
      setSaving(false);
    }
  }

  const status = (
    <>
      {saving && (
        <p className="muted" role="status">
          Saving the recipe, minus the life story…
        </p>
      )}
      {duplicate && <AlreadyHere duplicate={duplicate} busy={saving} onAgain={() => void saveAgain()} />}
    </>
  );
  return { open, status };
}

export function SiteLink({
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
