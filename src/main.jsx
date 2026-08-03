import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import App from "./App.jsx";
import { applyFrameBootPolicy } from "./frameGuard.js";
import "./styles.css";

if (applyFrameBootPolicy(window, document)) {
  createRoot(document.getElementById("root")).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
