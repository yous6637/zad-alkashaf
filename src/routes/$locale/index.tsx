import { createFileRoute } from "@tanstack/react-router";
import { Flame, LayoutGrid, Users } from "lucide-react";
import { CategoryTile } from "@/components/categories/category-tile";
import { CtaBanner } from "@/components/home/cta-banner";
import { EmptyState } from "@/components/home/empty-state";
import { HeroBanner } from "@/components/home/hero-banner";
import { HowSteps } from "@/components/home/how-steps";
import { ProductCard } from "@/components/products/product-card";
import { SectionHead } from "@/components/home/section-head";
import { Shell } from "@/components/layout/shell";
import { TroopCard } from "@/components/troops/troop-card";
import { isLocale, translate } from "@/lib/i18n";
import { getMeta, listProducts, listTroops } from "@/lib/zad/api";

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
  const t = (key: string, vars?: Record<string, string | number>) => translate(account, key, vars);
  const { meta, latest, troops } = Route.useLoaderData();
  const faqs = [
    [t("home.faq1q"), t("home.faq1a")],
    [t("home.faq2q"), t("home.faq2a")],
    [t("home.faq3q"), t("home.faq3a")],
  ];

  return (
    <Shell flush>
      <HeroBanner categories={meta.categories.slice(0, 6)} />

      <div className="mx-auto w-full max-w-7xl px-4 py-12">
        <SectionHead
          id="categories"
          title={t("home.categories")}
          icon={<LayoutGrid className="size-6" aria-hidden="true" />}
          href="/$locale/products"
        />
        <div className="grid grid-cols-3 gap-x-3 gap-y-6 sm:grid-cols-5 lg:grid-cols-9">
          {meta.categories.slice(0, 9).map((category) => (
            <CategoryTile key={category.id} category={category} />
          ))}
        </div>

        <div className="mt-16">
          <SectionHead
            title={t("home.latest")}
            icon={<Flame className="size-6" aria-hidden="true" />}
            href="/$locale/products"
          />
          {latest.length ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {latest.map((item) => (
                <ProductCard key={item.id} item={item} />
              ))}
            </div>
          ) : (
            <EmptyState title={t("home.emptyTitle")} body={t("home.emptyBody")} />
          )}
        </div>

        <div className="mt-16">
          <SectionHead
            title={t("home.troops")}
            icon={<Users className="size-6" aria-hidden="true" />}
            href="/$locale/troops"
          />
          {troops.length ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {troops.map((troop) => (
                <TroopCard key={troop.id} troop={troop} />
              ))}
            </div>
          ) : (
            <EmptyState title={t("home.emptyTroops")} />
          )}
        </div>

        <HowSteps />
      </div>

      <CtaBanner />

      <section id="faq" className="mx-auto w-full max-w-7xl px-4 py-12">
        <h2 className="text-2xl font-semibold text-accent">{t("home.faq")}</h2>
        <div className="mt-4 space-y-2">
          {faqs.map(([question, answer]) => (
            <details key={question} className="rounded-2xl bg-card px-4 py-3 ring-1 ring-border">
              <summary className="cursor-pointer font-medium">{question}</summary>
              <p className="mt-2 text-sm text-muted">{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </Shell>
  );
}
