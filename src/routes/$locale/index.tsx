import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  ArrowLeft,
  ChevronLeft,
  Compass,
  Flame,
  LayoutGrid,
  MapPin,
  MessageCircle,
  Package,
  Search,
  UserRound,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { CategoryMark } from "@/components/marks";
import { Shell } from "@/components/shell";
import { isLocale, translate } from "@/lib/i18n";
import { getMeta, listProducts, listTroops } from "@/lib/zad/api";
import type { Listing } from "@/lib/zad/types";

export const Route = createFileRoute("/$locale/")({
  loader: async ({ params }) => {
    const locale = params.locale === "fr" ? "fr" : "ar";
    const [meta, latest, troops] = await Promise.all([
      getMeta({ data: { locale } }),
      listProducts({ data: { limit: 5, locale } }),
      listTroops({ data: { locale } }),
    ]);
    return { meta, latest, troops: troops.slice(0, 3) };
  },
  component: Home,
});

function Home() {
  const { locale } = Route.useParams();
  const account = isLocale(locale) ? locale : "ar";
  const navigate = useNavigate();
  const t = (key: string, vars?: Record<string, string | number>) => translate(account, key, vars);
  const { meta, latest, troops } = Route.useLoaderData();
  const slugById = new Map(meta.categories.map((category) => [category.id, category.slug]));
  const steps = [
    { title: t("home.step1Title"), body: t("home.step1Body"), icon: UserRound },
    { title: t("home.step2Title"), body: t("home.step2Body"), icon: Users },
    { title: t("home.step3Title"), body: t("home.step3Body"), icon: Package },
    { title: t("home.step4Title"), body: t("home.step4Body"), icon: MessageCircle },
  ];
  const faqs = [
    [t("home.faq1q"), t("home.faq1a")],
    [t("home.faq2q"), t("home.faq2a")],
    [t("home.faq3q"), t("home.faq3a")],
  ];

  return (
    <Shell flush>
      <section className="relative min-h-[34rem] overflow-hidden text-white">
        <img src="/hero-camp.jpg" alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-l from-black/65 via-black/35 to-black/10" />
        <div className="relative mx-auto flex min-h-[34rem] w-full max-w-7xl flex-col justify-center px-4 py-12">
          <h1 className="max-w-xl text-4xl font-bold leading-tight md:text-5xl">{t("home.title")}</h1>
          <p className="mt-4 max-w-xl text-base text-white/90 md:text-lg">{t("home.lead")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/$locale/products"
              params={{ locale: account }}
              className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-accent-fg"
            >
              <Search className="size-4" aria-hidden="true" />
              {t("home.browse")}
            </Link>
            <Link
              to="/$locale/account"
              params={{ locale: account }}
              className="inline-flex h-12 items-center gap-2 rounded-full border border-white/80 bg-white/10 px-5 text-sm font-medium text-white"
            >
              <Users className="size-4" aria-hidden="true" />
              {t("home.join")}
            </Link>
          </div>
          <form
            className="mt-8 flex w-full max-w-3xl items-center gap-2 rounded-full bg-card p-2 text-fg shadow-lg"
            onSubmit={(event) => {
              event.preventDefault();
              const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
              void navigate({ to: "/$locale/products", params: { locale: account }, search: { q } });
            }}
          >
            <Search className="ms-3 size-5 text-muted" aria-hidden="true" />
            <input
              name="q"
              className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
              placeholder={t("home.searchPlaceholder")}
            />
            <button type="submit" className="h-11 rounded-full bg-accent px-6 text-sm font-medium text-accent-fg">
              {t("home.search")}
            </button>
          </form>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-white/80">{t("home.popular")}</span>
            {meta.categories.slice(0, 6).map((category) => (
              <Link
                key={category.id}
                to="/$locale/products"
                params={{ locale: account }}
                search={{ categoryId: category.id }}
                className="inline-flex h-9 items-center rounded-full bg-white/20 px-3 text-white"
              >
                {category.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-7xl px-4 py-10">
        <SectionHead
          id="categories"
          title={t("home.categories")}
          icon={<LayoutGrid className="size-6" aria-hidden="true" />}
          action={
            <Link to="/$locale/products" params={{ locale: account }} className="inline-flex items-center gap-1 text-sm text-muted">
              {t("home.seeAll")}
              <ArrowLeft className="size-4" aria-hidden="true" />
            </Link>
          }
        />
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-9">
          {meta.categories.slice(0, 9).map((category) => (
            <Link
              key={category.id}
              to="/$locale/products"
              params={{ locale: account }}
              search={{ categoryId: category.id }}
              className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-2 py-4 text-center shadow-sm"
            >
              <span className="grid size-14 place-items-center rounded-2xl bg-accent-soft text-accent">
                <CategoryMark slug={category.slug} className="size-7" />
              </span>
              <span className="text-sm font-medium">{category.name}</span>
            </Link>
          ))}
        </div>

        <div className="mt-12">
          <SectionHead
            title={t("home.latest")}
            icon={<Flame className="size-6" aria-hidden="true" />}
            action={
              <Link to="/$locale/products" params={{ locale: account }} className="inline-flex items-center gap-1 text-sm text-muted">
                {t("home.seeAll")}
                <ArrowLeft className="size-4" aria-hidden="true" />
              </Link>
            }
          />
          {latest.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {latest.map((item) => (
                <HomeProduct key={item.id} item={item} locale={account} slug={slugById.get(item.categoryId)} t={t} />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-8 text-center">
              <p className="font-medium">{t("home.emptyTitle")}</p>
              <p className="mt-1 text-sm text-muted">{t("home.emptyBody")}</p>
            </div>
          )}
        </div>

        <div className="mt-12">
          <SectionHead
            title={t("home.troops")}
            icon={<Users className="size-6" aria-hidden="true" />}
            action={
              <Link to="/$locale/troops" params={{ locale: account }} className="inline-flex items-center gap-1 text-sm text-muted">
                {t("home.seeAll")}
                <ArrowLeft className="size-4" aria-hidden="true" />
              </Link>
            }
          />
          {troops.length ? (
            <div className="grid gap-4 md:grid-cols-3">
              {troops.map((troop) => (
                <article key={troop.id} className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                  <div className="relative h-36 bg-accent-soft">
                    {troop.thumbnail ? (
                      <img src={troop.thumbnail} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="h-full bg-gradient-to-br from-accent to-forest" />
                    )}
                    <div className="absolute inset-x-0 -bottom-7 flex justify-center">
                      <div className="grid size-16 place-items-center overflow-hidden rounded-full border-4 border-card bg-card text-lg font-semibold text-accent">
                        {troop.logo ? (
                          <img src={troop.logo} alt="" className="size-full object-cover" />
                        ) : (
                          troop.name.slice(0, 1)
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="px-4 pb-4 pt-10 text-center">
                    <h3 className="text-lg font-semibold">{troop.name}</h3>
                    <p className="mt-1 inline-flex items-center gap-1 text-sm text-muted">
                      <MapPin className="size-4" aria-hidden="true" />
                      {troop.wilayaName}
                    </p>
                    <p className="mt-2 flex items-center justify-center gap-4 text-sm text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Users className="size-4" aria-hidden="true" />
                        {t("home.members", { count: troop.memberCount })}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Package className="size-4" aria-hidden="true" />
                        {t("home.listings", { count: troop.listingCount })}
                      </span>
                    </p>
                    <Link
                      to="/$locale/troops/$id"
                      params={{ locale: account, id: troop.id }}
                      className="mt-4 inline-flex h-11 items-center rounded-full border border-border px-5 text-sm font-medium"
                    >
                      {t("home.viewTroop")}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted">{t("home.emptyTroops")}</div>
          )}
        </div>

        <section id="how" className="mt-12 rounded-3xl border border-border bg-card p-6 md:p-8">
          <h2 className="flex items-center gap-2 text-2xl font-semibold text-accent">
            <Compass className="size-6" aria-hidden="true" />
            {t("home.how")}
          </h2>
          <ol className="mt-8 flex flex-col gap-6 lg:flex-row lg:items-start">
            {steps.map((step, index) => {
              const Icon = step.icon;
              return (
                <li key={step.title} className="flex flex-1 items-start gap-2">
                  <div className="flex-1 text-center">
                    <p className="text-sm tabular-nums text-muted">0{index + 1}</p>
                    <span className="mx-auto mt-2 grid size-14 place-items-center rounded-full bg-accent-soft text-accent">
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                    <h3 className="mt-3 font-semibold">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted">{step.body}</p>
                  </div>
                  {index < steps.length - 1 ? (
                    <ChevronLeft className="mt-12 hidden size-5 shrink-0 text-muted lg:block" aria-hidden="true" />
                  ) : null}
                </li>
              );
            })}
          </ol>
        </section>

        <section
          className="relative mt-12 overflow-hidden rounded-3xl bg-forest px-6 py-10 text-white md:px-10"
        >
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 opacity-40" aria-hidden="true">
            <svg viewBox="0 0 1200 120" className="h-full w-full" preserveAspectRatio="none">
              <path fill="currentColor" d="M0 80 L80 40 L160 70 L260 20 L360 75 L480 30 L600 78 L740 18 L860 70 L1000 28 L1120 74 L1200 40 L1200 120 L0 120 Z" />
            </svg>
          </div>
          <div className="relative flex flex-col items-center gap-6 md:flex-row md:justify-between">
            <div className="max-w-xl text-center md:text-start">
              <h2 className="text-2xl font-bold md:text-3xl">{t("home.ctaTitle")}</h2>
              <p className="mt-2 text-white/80">{t("home.ctaBody")}</p>
              <Link
                to="/$locale/account"
                params={{ locale: account }}
                className="mt-5 inline-flex h-12 items-center gap-2 rounded-full bg-gold px-6 text-sm font-semibold text-forest"
              >
                <ArrowLeft className="size-4" aria-hidden="true" />
                {t("home.registerTroop")}
              </Link>
            </div>
            <div className="grid size-28 place-items-center rounded-full bg-white/10" aria-hidden="true">
              <Compass className="size-16 text-gold" strokeWidth={1.25} />
            </div>
          </div>
        </section>

        <section id="faq" className="mt-12">
          <h2 className="text-2xl font-semibold text-accent">{t("home.faq")}</h2>
          <div className="mt-4 space-y-2">
            {faqs.map(([question, answer]) => (
              <details key={question} className="rounded-2xl border border-border bg-card px-4 py-3">
                <summary className="cursor-pointer font-medium">{question}</summary>
                <p className="mt-2 text-sm text-muted">{answer}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </Shell>
  );
}

function SectionHead({
  id,
  title,
  icon,
  action,
}: {
  id?: string;
  title: string;
  icon: ReactNode;
  action: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2 text-2xl font-semibold text-accent">
        {icon}
        {title}
      </h2>
      {action}
    </div>
  );
}

function HomeProduct({
  item,
  locale,
  slug,
  t,
}: {
  item: Listing;
  locale: "ar" | "fr";
  slug?: string;
  t: (key: string, vars?: Record<string, string | number>) => string;
}) {
  const amount = Number(item.operation === "rent" ? item.rentPrice : item.salePrice);
  const formatted = Number.isFinite(amount)
    ? t("sub.price", {
        amount: new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", { maximumFractionDigits: 0 }).format(amount),
      })
    : null;
  const price =
    item.operation === "sale"
      ? (formatted ?? "—")
      : item.operation === "rent"
        ? t("gear.rentPriceLabel", { price: formatted ?? "—" })
        : item.operation === "wanted"
          ? t("gear.opWanted")
          : t("gear.opExchange");
  const condition =
    item.condition === "new" ? t("home.condNew") : item.condition === "needs_repair" ? t("home.condRepair") : t("home.condUsed");
  const badge = item.condition === "new" ? "bg-sky-700" : "bg-accent";

  return (
    <Link
      to="/$locale/products/$id"
      params={{ locale, id: item.id }}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm"
    >
      <div className="relative grid h-36 place-items-center bg-accent-soft text-accent">
        <CategoryMark slug={slug} className="size-12" />
        <span className={`absolute top-3 end-3 rounded-full px-2.5 py-1 text-xs font-medium text-white ${badge}`}>
          {condition}
        </span>
      </div>
      <div className="space-y-1 p-3">
        <h3 className="line-clamp-2 font-semibold">{item.title}</h3>
        <p className="font-semibold tabular-nums text-accent">{price}</p>
        <p className="flex items-center gap-1 text-xs text-muted">
          <MapPin className="size-3.5" aria-hidden="true" />
          {item.wilayaName}
        </p>
        <p className="flex items-center gap-1 text-xs text-muted">
          <Users className="size-3.5" aria-hidden="true" />
          {item.troopName}
        </p>
      </div>
    </Link>
  );
}
