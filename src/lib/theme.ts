import type { UiLanguage, UiTheme } from "./types";

export function applyTheme(theme: UiTheme) {
  document.documentElement.dataset.theme = theme;
}

export function applyLanguage(locale: UiLanguage) {
  document.documentElement.lang = locale === "zh" ? "zh-CN" : "en";
}

export function shikiThemeForUi(theme: UiTheme): "github-dark" | "github-light" {
  return theme === "light" ? "github-light" : "github-dark";
}
