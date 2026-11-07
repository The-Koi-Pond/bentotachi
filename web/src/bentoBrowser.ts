import { useEffect } from "react";
import { useNavigate } from "react-router";
import { App } from "@capacitor/app";
import { registerPlugin } from "@capacitor/core";
import { isAndroidApp, pb } from "./pb";
import { noteRestoredBackup } from "./phoneMode";

type BrowserResult = { saved: boolean; url?: string; html?: string; name?: string };
type SavedPage = { url: string; html: string };

// Bento's built-in browser (BrowserActivity.java in the Android project).
interface BentoBrowserPlugin {
  open(options: { url: string; mode?: "recipe" | "link" | "pantry" }): Promise<BrowserResult>;
}

const BentoBrowser = registerPlugin<BentoBrowserPlugin>("BentoBrowser");

// Only the Android app has it; in a web browser, links just open normally.
export const hasBuiltInBrowser = isAndroidApp;

// Has the server read the recipe from a page the phone loaded; returns the
// new recipe's id.
export async function importBrowsedPage(page: SavedPage): Promise<string> {
  const { id } = await pb.send<{ id: string }>("/api/cookbook/import", {
    method: "POST",
    body: { url: page.url, html: page.html },
  });
  return id;
}

// Opens the page in Bento's browser. After "Save to Bento" this returns the
// new recipe's id; if the browser was simply closed, it returns null.
export async function browseAndSave(url: string): Promise<string | null> {
  const result = await BentoBrowser.open({ url });
  if (!result.saved || !result.url || !result.html) return null;
  return importBrowsedPage({ url: result.url, html: result.html });
}

// Android sometimes closes Bento in the background while its browser is open
// (to free memory). Bento then starts afresh when the browser closes, with
// no screen waiting for the page saved there, so Capacitor hands it over at
// start-up as "appRestoredResult" (kept until something listens). It goes to
// Add recipe, which imports it (takeRestoredPage). Only recipe saves: a
// "Link this item" page belonged to an item the fresh start knows nothing of.
let restoredPage: SavedPage | null = null;

export function takeRestoredPage(): SavedPage | null {
  const page = restoredPage;
  restoredPage = null;
  return page;
}

function useRestoredSave() {
  const navigate = useNavigate();
  useEffect(() => {
    if (!isAndroidApp) return;
    const listening = App.addListener("appRestoredResult", (event) => {
      // A backup saved while Android had closed Bento (see phoneMode.ts).
      // Heard here because Capacitor hands a result kept for later only to
      // the first listener, so this one listener serves both.
      if (event.pluginId === "BentoLocalServer" && event.methodName === "backup") {
        const saved = event.success && !!(event.data as { saved?: boolean } | undefined)?.saved;
        // Saving cancelled: nothing to say.
        if (event.success && !saved) return;
        noteRestoredBackup(saved, event.error?.message);
        navigate("/backups?result=1");
        return;
      }
      const data = event.data as BrowserResult | undefined;
      if (event.pluginId !== "BentoBrowser" || !event.success || !data?.saved || !data.url || !data.html) return;
      restoredPage = { url: data.url, html: data.html };
      navigate("/add?restored=1");
    });
    return () => void listening.then((handle) => handle.remove());
  }, [navigate]);
}

// Placed inside the router in App.tsx (so only once someone is logged in).
export function RestoredSaveReceiver() {
  useRestoredSave();
  return null;
}

// Opens a page (like a store's search) in Bento's browser with a "Link this
// item" (or, for "pantry", "Add to pantry") button, and returns the address
// and product name of the page that was open when it was tapped, or null if
// the browser was just closed.
export async function pickPageLink(
  url: string,
  mode: "link" | "pantry" = "link"
): Promise<{ url: string; name: string } | null> {
  const result = await BentoBrowser.open({ url, mode });
  return result.saved && result.url ? { url: result.url, name: result.name ?? "" } : null;
}
