import { createContext, useContext, useEffect, useMemo, type ReactNode } from "react";
import { useSettings } from "../hooks/useRepo";
import { createT, type TranslateFn } from "../lib/i18n";
import { applyLanguage, applyTheme } from "../lib/theme";
import type { UiLanguage, UiTheme } from "../lib/types";

interface PreferencesContextValue {
  theme: UiTheme;
  locale: UiLanguage;
  t: TranslateFn;
}

const PreferencesContext = createContext<PreferencesContextValue>({
  theme: "dark",
  locale: "en",
  t: createT("en"),
});

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const { data: settings } = useSettings();
  const theme: UiTheme = settings?.ui_theme ?? "dark";
  const locale: UiLanguage = settings?.ui_language ?? "en";

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    applyLanguage(locale);
  }, [locale]);

  const value = useMemo(
    () => ({
      theme,
      locale,
      t: createT(locale),
    }),
    [theme, locale],
  );

  return (
    <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>
  );
}

export function usePreferences() {
  return useContext(PreferencesContext);
}

export function useT() {
  return useContext(PreferencesContext).t;
}
