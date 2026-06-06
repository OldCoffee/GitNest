import type { UiLanguage } from "../types";
import { en, type Messages } from "./en";
import { zh } from "./zh";

const catalogs: Record<UiLanguage, Messages> = { en, zh };

function getNested(obj: unknown, path: string): string | undefined {
  const value = path.split(".").reduce<unknown>((current, key) => {
    if (current && typeof current === "object" && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
  return typeof value === "string" ? value : undefined;
}

export function createT(locale: UiLanguage) {
  const messages = catalogs[locale] ?? en;
  return function t(key: string, params?: Record<string, string | number>): string {
    let text = getNested(messages, key) ?? getNested(en, key) ?? key;
    if (params) {
      for (const [name, value] of Object.entries(params)) {
        text = text.replace(`{${name}}`, String(value));
      }
    }
    return text;
  };
}

export type TranslateFn = ReturnType<typeof createT>;
