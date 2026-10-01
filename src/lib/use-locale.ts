import { useCallback } from "react";
import { useRouterState } from "@tanstack/react-router";
import { isLocale, translate, type Locale } from "@/lib/i18n";

export function useLocale(): Locale {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const segment = pathname.split("/").filter(Boolean)[0] ?? "ar";
  return isLocale(segment) ? segment : "ar";
}

export function useT() {
  const locale = useLocale();
  return useCallback(
    (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars),
    [locale],
  );
}

