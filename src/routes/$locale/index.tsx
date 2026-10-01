import { createFileRoute, Link } from "@tanstack/react-router";
import { CategoryMark } from "@/components/marks";
import { ListingCard } from "@/components/listing-card";
import { Shell } from "@/components/shell";
import { isLocale, translate } from "@/lib/i18n";
import { getMeta, listProducts } from "@/lib/zad/api";

export const Route = createFileRoute("/$locale/")({
  loader: async ({ params }) => {
    const locale = params.locale === "fr" ? "fr" : "ar";
    const [meta, latest] = await Promise.all([
      getMeta({ data: { locale } }),
      listProducts({ data: { limit: 6, locale } }),
    ]);
    return { meta, latest };
  },
  component: Home,
});

function Home() {
  const { locale } = Route.useParams();
  const account = isLocale(locale) ? locale : "ar";
  const t = (key: string, vars?: Record<string, string | number>) => translate(account, key, vars);
  const { meta, latest } = Route.useLoaderData();
  const steps = [
    [t("home.step1Title"), t("home.step1Body")],
    [t("home.step2Title"), t("home.step2Body")],
    [t("home.step3Title"), t("home.step3Body")],
    [t("home.step4Title"), t("home.step4Body")],
  ];
  const faqs = [
    [t("home.faq1q"), t("home.faq1a")],
    [t("home.faq2q"), t("home.faq2a")],
    [t("home.faq3q"), t("home.faq3a")],
  ];

  return (
    <Shell>
      <section className="grid items-end gap-8 border-b border-border pb-8 lg:grid-cols-[1.3fr_0.7fr]">
        <div>
          <p className="text-sm font-medium text-accent">{t("home.kicker")}</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-semibold leading-tight md:text-5xl">{t("home.title")}</h1>
          <p className="mt-4 max-w-2xl text-lg text-muted">{t("home.lead")}</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/$locale/products"
              params={{ locale: account }}
              className="inline-flex h-11 items-center rounded-md bg-accent px-4 text-sm font-medium text-accent-fg"
            >
              {t("home.browse")}
            </Link>
            <Link
              to="/$locale/account"
              params={{ locale: account }}
              className="inline-flex h-11 items-center rounded-md border border-border bg-card px-4 text-sm font-medium"
            >
              {t("home.registerTroop")}
            </Link>
          </div>
        </div>
        <aside className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm text-muted">{t("home.plan")}</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums">
            {meta.plan
              ? t("sub.price", {
                  amount: new Intl.NumberFormat(account === "ar" ? "ar-DZ" : "fr-DZ", {
                    maximumFractionDigits: 0,
                  }).format(Number(meta.plan.price)),
                })
              : t("home.priceMissing")}
          </p>
          <p className="mt-1 text-sm text-muted">{t("home.perYear")}</p>
          {meta.plan ? (
            <ul className="mt-4 space-y-2 text-sm">
              <li>{t("home.membersLimit", { count: meta.plan.maxMembers })}</li>
              <li>{t("home.productsLimit", { count: meta.plan.maxProducts })}</li>
              <li>{t("home.limitsManaged")}</li>
            </ul>
          ) : null}
        </aside>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-semibold">{t("home.categories")}</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {meta.categories.map((category) => (
            <Link
              key={category.id}
              to="/$locale/products"
              params={{ locale: account }}
              search={{ categoryId: category.id }}
              className="rounded-lg border border-border bg-card p-4"
            >
              <CategoryMark id={category.id} className="size-6 text-accent" />
              <span className="mt-3 block font-medium">{category.name}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between gap-3">
          <h2 className="text-2xl font-semibold">{t("home.latest")}</h2>
          <Link to="/$locale/products" params={{ locale: account }} className="text-sm font-medium text-accent">
            {t("home.allProducts")}
          </Link>
        </div>
        {latest.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((item) => (
              <ListingCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="font-medium">{t("home.emptyTitle")}</p>
            <p className="mt-1 text-sm text-muted">{t("home.emptyBody")}</p>
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">{t("home.how")}</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-4">
          {steps.map(([title, body], index) => (
            <li key={title} className="rounded-lg border border-border bg-card p-4">
              <span className="text-sm tabular-nums text-muted">0{index + 1}</span>
              <h3 className="mt-2 font-semibold">{title}</h3>
              <p className="mt-1 text-sm text-muted">{body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-semibold">{t("home.faq")}</h2>
        <div className="mt-4 space-y-2">
          {faqs.map(([question, answer]) => (
            <details key={question} className="rounded-lg border border-border bg-card px-4 py-3">
              <summary className="cursor-pointer font-medium">{question}</summary>
              <p className="mt-2 text-sm text-muted">{answer}</p>
            </details>
          ))}
        </div>
      </section>
    </Shell>
  );
}
