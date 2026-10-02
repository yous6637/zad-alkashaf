import { useEffect, useState, type ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Facebook, Instagram, Tent, User, Youtube } from "lucide-react";
import { UserButton } from "@/lib/auth/gates";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/cn";
import { dirFor, translate, type Locale } from "@/lib/i18n";
import { useLocale } from "@/lib/use-locale";
import { getCurrentUser } from "@/lib/zad/api";

const LINKS = [
  { to: "/$locale", key: "nav.home", hash: undefined, match: "exact" },
  { to: "/$locale/products", key: "nav.products", hash: undefined, match: "start" },
  { to: "/$locale/troops", key: "nav.troops", hash: undefined, match: "start" },
  { to: "/$locale", key: "nav.how", hash: "how", match: "none" },
  { to: "/$locale", key: "nav.faq", hash: "faq", match: "none" },
] as const;

export function Shell({ children, flush = false }: { children: ReactNode; flush?: boolean }) {
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
  const year = new Date().getFullYear();

  const nav = (
    <>
      {LINKS.map((link) => {
        const href = link.to.replace("$locale", locale);
        const active =
          link.match === "exact" ? pathname === href : link.match === "start" ? pathname.startsWith(href) : false;
        return (
          <Link
            key={link.key}
            to={link.to}
            params={{ locale }}
            hash={link.hash}
            className={cn(
              "flex h-11 items-center px-3 text-sm",
              active ? "font-semibold text-accent underline decoration-2 underline-offset-8" : "text-fg",
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
      <header className="sticky top-0 z-30 border-b border-border bg-card">
        <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 py-3">
          <Link to="/$locale" params={{ locale }} className="flex items-center gap-2">
            <Tent className="size-9 text-accent" strokeWidth={1.75} aria-hidden="true" />
            <span className="leading-tight">
              <span className="block text-lg font-bold text-accent">{t("brand.name")}</span>
              <span className="hidden text-xs text-muted sm:block">{t("brand.tagline")}</span>
            </span>
          </Link>
          <nav className="ms-4 hidden flex-1 items-center justify-center gap-1 lg:flex">{nav}</nav>
          <div className="ms-auto flex items-center gap-2">
            <a
              href={languageHref}
              hrefLang={other}
              className="inline-flex h-11 items-center rounded-full px-3 text-sm font-medium text-muted"
            >
              {other === "ar" ? "العربية" : "FR"}
            </a>
            {isPending ? (
              <div className="h-11 w-24 animate-pulse rounded-full bg-surface" />
            ) : user ? (
              <>
                <Link
                  to="/$locale/account"
                  params={{ locale }}
                  className="hidden h-11 items-center rounded-full px-3 text-sm font-medium md:inline-flex"
                >
                  {t("nav.account")}
                </Link>
                {admin ? (
                  <Link
                    to="/$locale/admin"
                    params={{ locale }}
                    className="hidden h-11 items-center rounded-full px-3 text-sm font-medium md:inline-flex"
                  >
                    {t("nav.admin")}
                  </Link>
                ) : null}
                <UserButton />
              </>
            ) : (
              <>
                <Link
                  to="/$locale/register"
                  params={{ locale }}
                  className="inline-flex h-11 items-center rounded-full bg-accent px-4 text-sm font-medium text-accent-fg"
                >
                  {t("nav.register")}
                </Link>
                <Link
                  to="/$locale/login"
                  params={{ locale }}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium"
                >
                  <User className="size-4" aria-hidden="true" />
                  {t("nav.login")}
                </Link>
              </>
            )}
            <button
              type="button"
              className="inline-flex h-11 items-center rounded-full border border-border px-3 text-sm lg:hidden"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              {t("nav.menu")}
            </button>
          </div>
        </div>
        {open ? (
          <nav className="flex flex-col border-t border-border px-4 py-2 lg:hidden">
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
            ) : null}
          </nav>
        ) : null}
      </header>
      <main className={flush ? "flex-1" : "mx-auto w-full max-w-7xl flex-1 px-4 py-6"}>{children}</main>
      <footer className="bg-forest text-white">
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2">
              <Tent className="size-8" strokeWidth={1.75} aria-hidden="true" />
              <div>
                <p className="text-lg font-bold">{t("brand.name")}</p>
                <p className="text-xs text-white/70">{t("brand.tagline")}</p>
              </div>
            </div>
          </div>
          <FooterCol title={t("footer.products")}>
            <FooterLink to="/$locale/products" locale={locale}>
              {t("footer.latest")}
            </FooterLink>
            <FooterLink to="/$locale" locale={locale} hash="categories">
              {t("footer.categories")}
            </FooterLink>
          </FooterCol>
          <FooterCol title={t("footer.troops")}>
            <FooterLink to="/$locale/troops" locale={locale}>
              {t("footer.discover")}
            </FooterLink>
            <FooterLink to="/$locale/account" locale={locale}>
              {t("footer.createTroop")}
            </FooterLink>
            <FooterLink to="/$locale/account" locale={locale}>
              {t("footer.plans")}
            </FooterLink>
          </FooterCol>
          <FooterCol title={t("footer.help")}>
            <FooterLink to="/$locale" locale={locale} hash="faq">
              {t("nav.faq")}
            </FooterLink>
            <FooterLink to="/$locale" locale={locale} hash="how">
              {t("nav.how")}
            </FooterLink>
            <FooterLink to="/$locale/account" locale={locale}>
              {t("footer.contact")}
            </FooterLink>
          </FooterCol>
        </div>
        <div className="border-t border-white/15">
          <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 text-sm text-white/80">
            <p>{t("footer.rights", { year })}</p>
            <div className="flex gap-2">
              <span className="grid size-9 place-items-center rounded-full border border-white/30">
                <Facebook className="size-4" aria-hidden="true" />
              </span>
              <span className="grid size-9 place-items-center rounded-full border border-white/30">
                <Instagram className="size-4" aria-hidden="true" />
              </span>
              <span className="grid size-9 place-items-center rounded-full border border-white/30">
                <Youtube className="size-4" aria-hidden="true" />
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FooterCol({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="font-semibold">{title}</p>
      <div className="mt-3 flex flex-col gap-2 text-sm text-white/80">{children}</div>
    </div>
  );
}

function FooterLink({
  to,
  locale,
  hash,
  children,
}: {
  to: "/$locale" | "/$locale/products" | "/$locale/troops" | "/$locale/account";
  locale: Locale;
  hash?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} params={{ locale }} hash={hash} className="hover:text-white">
      {children}
    </Link>
  );
}
