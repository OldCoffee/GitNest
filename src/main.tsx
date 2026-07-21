import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { api } from "./lib/api";
import {
  buildPerfReport,
  clearMeasuredEntries,
  endMeasure,
  measuredEntries,
  persistPerfReport,
  startMeasure,
} from "./lib/performance";
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

declare global {
  interface Window {
    __gitnestPerf?: () => Record<string, number>;
    __gitnestPerfClear?: () => void;
    __gitnestPerfReport?: () => string;
  }
}

window.__gitnestPerf = measuredEntries;
window.__gitnestPerfClear = clearMeasuredEntries;
window.__gitnestPerfReport = () => {
  const report = buildPerfReport();
  persistPerfReport(report);
  console.info(report.markdown);
  return report.markdown;
};

void api
  .getSettings()
  .then((settings) => {
    applyTheme((settings.ui_theme as UiTheme) || "dark");
    applyLanguage((settings.ui_language as UiLanguage) || "en");
  })
  .catch(() => {
    // keep defaults until PreferencesProvider loads settings
  });
