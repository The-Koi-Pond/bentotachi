import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import PhoneStartup from "./PhoneStartup";
import { isPhoneMode } from "./phoneMode";
import { setUpBackGesture } from "./androidBack";
// The stylesheets, in the order they must load: when two rules tie, the later
// file wins (docs/shared-systems.md, "Styles").
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/fridge.css";
import "./styles/browse.css";
import "./styles/shopping.css";
import "./styles/plan.css";
import "./styles/pantry.css";
import "./styles/recipe-list.css";
import "./styles/recipe.css";
import "./styles/dates.css";
import "./styles/settings.css";
import "./styles/print.css";
import { applyTheme, savedTheme } from "./theme";
import { SystemBarColours } from "./SystemBarColours";
import { followTextZoom } from "./textZoom";

setUpBackGesture();
// Light or dark as chosen in Settings, before anything is drawn.
applyTheme(savedTheme());
followTextZoom();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SystemBarColours />
    {/* Phone-only mode starts Bento's own server first (see phoneMode.ts). */}
    {isPhoneMode() ? (
      <PhoneStartup>
        <App />
      </PhoneStartup>
    ) : (
      <App />
    )}
  </StrictMode>
);
