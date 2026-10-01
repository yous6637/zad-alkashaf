import { createFileRoute, Link } from "@tanstack/react-router";
import { ListingCard } from "@/components/listing-card";
import { Shell } from "@/components/shell";
import { isLocale } from "@/lib/i18n";
import { useT } from "@/lib/use-locale";
import { getTroop } from "@/lib/zad/api";

export const Route = createFileRoute("/$locale/troops_/$id")({
  loader: ({ params }) =>
    getTroop({ data: { id: params.id, locale: params.locale === "fr" ? "fr" : "ar" } }),
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
      <h1 className="text-3xl font-semibold">{troop.name}</h1>
      <p className="mt-1 text-sm text-muted">
        {troop.wilayaName} · {troop.commune}
      </p>
      {troop.about ? <p className="mt-4 max-w-3xl text-muted">{troop.about}</p> : null}
      <h2 className="mt-8 text-2xl font-semibold">{t("troops.products")}</h2>
      {listings.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((item) => (
            <ListingCard key={item.id} item={item} />
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
