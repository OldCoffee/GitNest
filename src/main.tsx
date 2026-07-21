import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { api } from "./lib/api";
import { endMeasure, startMeasure } from "./lib/performance";
import { applyLanguage, applyTheme } from "./lib/theme";
import type { UiLanguage, UiTheme } from "./lib/types";
import "./index.css";

applyTheme("dark");
startMeasure("app.bootstrap");

// Render immediately so the window never sits blank while the backend warms up.
// PreferencesProvider re-applies the persisted theme/language once settings load.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

requestAnimationFrame(() => {
  endMeasure("app.bootstrap");
});

void api
  .getSettings()
  .then((settings) => {
    applyTheme((settings.ui_theme as UiTheme) || "dark");
    applyLanguage((settings.ui_language as UiLanguage) || "en");
  })
  .catch(() => {
    // keep defaults until PreferencesProvider loads settings
  });
