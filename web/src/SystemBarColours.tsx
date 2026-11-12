import { useEffect } from "react";
import { registerPlugin, SystemBars, SystemBarsStyle } from "@capacitor/core";
import { isAndroidApp } from "./pb";
import { useDarkMode } from "./theme";

// Android's own bars match the app's Light or Dark, not just the phone's:
// their icons light on dark (Capacitor's SystemBars, every Android), and
// where the window shows through them (Android 14 and older) their colour
// too, the top bar's above and the tab bar's below (BentoBarsPlugin.java),
// or Dark leaves light strips there. SystemBars first: it resets what's
// behind the bars, which paint() then covers.
const BentoBars = registerPlugin<{ paint(options: { top: string; bottom: string }): Promise<void> }>("BentoBars");

export function SystemBarColours() {
  const dark = useDarkMode();
  useEffect(() => {
    if (!isAndroidApp) return;
    const style = getComputedStyle(document.documentElement);
    const top = style.getPropertyValue("--surface").trim();
    const bottom = style.getPropertyValue("--rim").trim();
    void (async () => {
      try {
        await SystemBars.setStyle({ style: dark ? SystemBarsStyle.Dark : SystemBarsStyle.Light });
        if (top && bottom) await BentoBars.paint({ top, bottom });
      } catch (err) {
        // The bars keep the phone's own look: nothing else depends on it.
        console.warn("Couldn't paint Android's bars", err);
      }
    })();
  }, [dark]);
  return null;
}
