import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import PhoneStartup from "./PhoneStartup";
import { isPhoneMode } from "./phoneMode";
import { setUpBackGesture } from "./androidBack";
import "./styles.css";
import { applyTheme, savedTheme } from "./theme";

setUpBackGesture();
// Light or dark as chosen in Settings, before anything is drawn.
applyTheme(savedTheme());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
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
