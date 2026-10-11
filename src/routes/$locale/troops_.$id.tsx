import { createFileRoute, Link } from "@tanstack/react-router";
import { ProductCard } from "@/components/products/product-card";
import { Shell } from "@/components/layout/shell";
import { isLocale, translate } from "@/lib/i18n";
import { shareMeta } from "@/lib/seo";
import { useT } from "@/lib/use-locale";
import { getTroop } from "@/lib/zad/api";

export const Route = createFileRoute("/$locale/troops_/$id")({
  loader: ({ params }) =>
    getTroop({ data: { id: params.id, locale: params.locale === "fr" ? "fr" : "ar" } }),
  head: ({ loaderData, params }) => {
    const locale = params.locale === "fr" ? "fr" : "ar";
    const troop = loaderData?.troop;
    const place = troop ? `${troop.wilayaName}${troop.commune ? ` · ${troop.commune}` : ""}` : "";
    return shareMeta({
      locale,
      title: troop?.name ?? translate(locale, "troops.gone"),
      description: troop?.about?.trim() || (place ? `${troop?.name ?? ""} — ${place}` : translate(locale, "meta.description")),
      path: `/${locale}/troops/${params.id}`,
      origin: loaderData?.origin ?? "",
    });
  },
  component: TroopPage,
});

function TroopPage() {
  const { locale } = Route.useParams();
  const account = isLocale(locale) ? locale : "ar";
  const t = useT();
  const data = Route.useLoaderData();
  if (!data) {
    return (
      <Shell>
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">{t("troops.gone")}</h1>
          <Link
            to="/$locale/troops"
            params={{ locale: account }}
            className="mt-4 inline-flex h-11 items-center text-sm font-medium text-accent"
          >
            {t("troops.back")}
          </Link>
        </div>
      </Shell>
    );
  }
  const { troop, listings } = data;
  return (
    <Shell>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        <div className="h-44 bg-sand-soft">
          {troop.thumbnail ? <img src={troop.thumbnail} alt="" className="h-full w-full object-cover" /> : null}
        </div>
        <div className="flex items-end gap-4 px-4 pb-4">
          <div className="-mt-10 size-20 shrink-0 overflow-hidden rounded-full border-4 border-card bg-accent-soft">
            {troop.logo ? (
              <img src={troop.logo} alt="" className="size-full object-cover" />
            ) : (
              <span className="grid size-full place-items-center text-xl font-semibold text-accent">
                {troop.name.slice(0, 1)}
              </span>
            )}
          </div>
          <div className="min-w-0 pb-1">
            <h1 className="text-3xl font-semibold">{troop.name}</h1>
            <p className="mt-1 text-sm text-muted">
              {troop.wilayaName} · {troop.commune}
            </p>
          </div>
        </div>
      </div>
      {troop.about ? <p className="mt-4 max-w-3xl text-muted">{troop.about}</p> : null}
      <h2 className="mt-8 text-2xl font-semibold">{t("troops.products")}</h2>
      {listings.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((item) => (
            <ProductCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <p className="mt-4 text-sm text-muted">{t("troops.noProducts")}</p>
      )}
      <Link to="/$locale/troops" params={{ locale: account }} className="mt-6 inline-flex h-11 items-center text-sm text-accent">
        {t("troops.back")}
      </Link>
    </Shell>
  );
}
