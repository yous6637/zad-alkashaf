import { Link } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { useLocale, useT } from "@/lib/use-locale";

export function NotFoundPage() {
  const t = useT();
  const locale = useLocale();
  return (
    <Shell>
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold">{t("errors.notFoundTitle")}</h1>
        <p className="mt-2 text-sm text-muted">{t("errors.notFoundBody")}</p>
        <Link
          to="/$locale"
          params={{ locale }}
          className="mt-4 inline-flex h-11 items-center text-sm font-medium text-accent"
        >
          {t("errors.home")}
        </Link>
      </div>
    </Shell>
  );
}

export function ErrorPage({ reset }: { error: unknown; reset: () => void }) {
  const t = useT();
  return (
    <Shell>
      <div className="rounded-xl border border-border bg-card p-8 text-center">
        <h1 className="text-xl font-semibold">{t("errors.errorTitle")}</h1>
        <p className="mt-2 text-sm text-muted">{t("errors.errorBody")}</p>
        <button
          type="button"
          className="mt-4 inline-flex h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
          onClick={() => reset()}
        >
          {t("errors.retry")}
        </button>
      </div>
    </Shell>
  );
}
