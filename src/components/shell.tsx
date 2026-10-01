import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/cn";
import { dirFor, translate, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/use-locale";
import { getCurrentUser } from "@/lib/zad/api";

const LINKS = [
  { to: "/$locale", key: "nav.home" },
  { to: "/$locale/products", key: "nav.products" },
  { to: "/$locale/troops", key: "nav.troops" },
] as const;

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const searchStr = useRouterState({ select: (state) => state.location.searchStr });
  const locale = useLocale();
  const t = (key: string, vars?: Record<string, string | number>) => translate(locale, key, vars);
  const { user, isPending } = useCurrentUserState();
  const [admin, setAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const other: Locale = locale === "ar" ? "fr" : "ar";

  useEffect(() => {
    if (!user) return;
    getCurrentUser()
      .then((current) => setAdmin(current.role === "admin"))
      .catch(() => setAdmin(false));
  }, [user]);

  useEffect(() => {
    document.documentElement.lang = locale;
    document.documentElement.dir = dirFor(locale);
  }, [locale]);

  const rest = pathname.replace(/^\/(ar|fr)/, "") || "/";
  const languageHref = `/${other}${rest === "/" ? "" : rest}${searchStr}`;

  const nav = (
    <>
      {LINKS.map((link) => {
        const href = link.to.replace("$locale", locale);
        const active = pathname === href;
        return (
          <Link
            key={link.to}
            to={link.to}
            params={{ locale }}
            className={cn(
              "flex h-11 items-center rounded-md px-3 text-sm",
              active ? "bg-surface font-medium" : "text-muted",
            )}
            onClick={() => setOpen(false)}
          >
            {t(link.key)}
          </Link>
        );
      })}
    </>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/95">
        <div className="mx-auto flex w-full max-w-6xl items-center gap-3 px-4 py-3">
          <Link to="/$locale" params={{ locale }} className="flex items-center gap-2">
            <span className="grid size-11 place-items-center rounded-md bg-accent text-base font-semibold text-accent-fg">
              ز
            </span>
            <span className="leading-tight">
              <span className="block text-base font-semibold">{t("brand.name")}</span>
              <span className="block text-xs text-muted">{t("brand.tagline")}</span>
            </span>
          </Link>
          <nav className="ms-2 hidden flex-1 items-center gap-1 md:flex">{nav}</nav>
          <div className="ms-auto flex items-center gap-2">
            <a
              href={languageHref}
              hrefLang={other}
              className="inline-flex h-11 items-center rounded-md px-3 text-sm font-medium"
            >
              {other === "ar" ? "العربية" : "FR"}
            </a>
            {isPending ? (
              <div className="h-11 w-24 animate-pulse rounded-md bg-surface" />
            ) : user ? (
              <>
                <Link
                  to="/$locale/account"
                  params={{ locale }}
                  className="hidden h-11 items-center rounded-md px-3 text-sm font-medium md:inline-flex"
                >
                  {t("nav.account")}
                </Link>
                {admin ? (
                  <Link
                    to="/$locale/admin"
                    params={{ locale }}
                    className="hidden h-11 items-center rounded-md px-3 text-sm font-medium md:inline-flex"
                  >
                    {t("nav.admin")}
                  </Link>
                ) : null}
                <UserButton />
              </>
            ) : (
              <>
                <Link
                  to="/$locale/login"
                  params={{ locale }}
                  className="inline-flex h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
                >
                  {t("nav.login")}
                </Link>
                <Link
                  to="/$locale/register"
                  params={{ locale }}
                  className="hidden h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium md:inline-flex"
                >
                  {t("nav.register")}
                </Link>
              </>
            )}
            <button
              type="button"
              className="inline-flex h-11 items-center rounded-md border border-border px-3 text-sm md:hidden"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              {t("nav.menu")}
            </button>
          </div>
        </div>
        {open ? (
          <nav className="flex flex-col border-t border-border px-4 py-2 md:hidden">
            {nav}
            {user ? (
              <>
                <Link
                  to="/$locale/account"
                  params={{ locale }}
                  className="flex h-11 items-center rounded-md px-3 text-sm font-medium"
                  onClick={() => setOpen(false)}
                >
                  {t("nav.account")}
                </Link>
                {admin ? (
                  <Link
                    to="/$locale/admin"
                    params={{ locale }}
                    className="flex h-11 items-center rounded-md px-3 text-sm font-medium"
                    onClick={() => setOpen(false)}
                  >
                    {t("nav.admin")}
                  </Link>
                ) : null}
              </>
            ) : (
              <Link
                to="/$locale/register"
                params={{ locale }}
                className="flex h-11 items-center rounded-md px-3 text-sm font-medium"
                onClick={() => setOpen(false)}
              >
                {t("nav.register")}
              </Link>
            )}
          </nav>
        ) : null}
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto w-full max-w-6xl px-4 py-6 text-sm text-muted">{t("footer.note")}</div>
      </footer>
    </div>
  );
}
