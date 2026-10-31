import { registerPlugin } from "@capacitor/core";
import { isAndroidApp, pb } from "./pb";

// Bento's built-in browser (BrowserActivity.java in the Android project).
interface BentoBrowserPlugin {
  open(options: {
    url: string;
    mode?: "recipe" | "link" | "pantry";
  }): Promise<{ saved: boolean; url?: string; html?: string; name?: string }>;
}

const BentoBrowser = registerPlugin<BentoBrowserPlugin>("BentoBrowser");

// Only the Android app has it; in a web browser, links just open normally.
export const hasBuiltInBrowser = isAndroidApp;

// Opens the page in Bento's browser. After "Save to Bento" the server reads
// the recipe from the page the phone loaded and this returns the new
// recipe's id; if the browser was simply closed, it returns null.
export async function browseAndSave(url: string): Promise<string | null> {
  const result = await BentoBrowser.open({ url });
  if (!result.saved || !result.url || !result.html) return null;
  const { id } = await pb.send<{ id: string }>("/api/cookbook/import", {
    method: "POST",
    body: { url: result.url, html: result.html },
  });
  return id;
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
