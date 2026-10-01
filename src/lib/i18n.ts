import ar from "../../messages/ar.json";
import fr from "../../messages/fr.json";

export const locales = ["ar", "fr"] as const;
export type Locale = (typeof locales)[number];

const catalogs = { ar, fr } as const;

export function isLocale(value: string): value is Locale {
  return value === "ar" || value === "fr";
}

export function dirFor(locale: Locale) {
  return locale === "ar" ? "rtl" : "ltr";
}

function read(catalog: typeof ar, key: string): string | null {
  const parts = key.split(".");
  let current: unknown = catalog;
  for (const part of parts) {
    if (typeof current !== "object" || current === null || !(part in current)) return null;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : null;
}

export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
) {
  const text = read(catalogs[locale], key) ?? read(catalogs.ar, key) ?? key;
  if (!vars) return text;
  return Object.entries(vars).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    text,
  );
}
