import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { setUpBackGesture } from "./androidBack";
import "./styles.css";

setUpBackGesture();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
