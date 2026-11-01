import { useEffect, useState } from "react";
import { isAndroidApp, type Recipe } from "./pb";
import { PrintIcon, ShareIcon } from "./icons";
import { recipeAsText } from "./recipeText";
import { shareText } from "./shareReceiver";

// Share (and, in a browser, Print) beside a recipe's title. Share sends the
// recipe as text (recipeText.ts) at the size it's scaled to: Android's share
// sheet in the app, the browser's where there is one, or else it's copied.
// Print uses the page's print layout (styles.css, @media print). The app's
// web view can't print, so it only has Share.
export default function ShareButton({ recipe, scale }: { recipe: Recipe; scale: number }) {
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);

  async function share() {
    try {
      const result = await shareText(recipe.title, recipeAsText(recipe, scale));
      if (result === "copied") setMessage("Copied the recipe, ready to paste into a message or email.");
    } catch {
      setMessage("Couldn't share it from here. Try again, or select the text and copy it.");
    }
  }

  return (
    <>
      <button className="button small icon-only" onClick={() => void share()} aria-label="Share" title="Share">
        <ShareIcon />
      </button>
      {!isAndroidApp && (
        <button className="button small icon-only print-button" onClick={() => window.print()} aria-label="Print" title="Print">
          <PrintIcon />
        </button>
      )}
      {message && (
        <p className="toast" role="status">
          {message}
        </p>
      )}
    </>
  );
}
