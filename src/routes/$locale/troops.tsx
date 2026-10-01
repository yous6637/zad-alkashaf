import { createFileRoute, Link } from "@tanstack/react-router";
import { Shell } from "@/components/shell";
import { isLocale } from "@/lib/i18n";
import { useT } from "@/lib/use-locale";
import { listTroops } from "@/lib/zad/api";

export const Route = createFileRoute("/$locale/troops")({
  loader: ({ params }) => listTroops({ data: { locale: params.locale === "fr" ? "fr" : "ar" } }),
  component: TroopsPage,
});

function TroopsPage() {
  const { locale } = Route.useParams();
  const account = isLocale(locale) ? locale : "ar";
  const t = useT();
  const troops = Route.useLoaderData();
  return (
    <Shell>
      <h1 className="text-3xl font-semibold">{t("troops.title")}</h1>
      <p className="mt-2 text-muted">{t("troops.lead")}</p>
      {troops.length ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {troops.map((troop) => (
            <Link
              key={troop.id}
              to="/$locale/troops/$id"
              params={{ locale: account, id: troop.id }}
              className="rounded-xl border border-border bg-card p-4"
            >
              <h2 className="text-xl font-semibold">{troop.name}</h2>
              <p className="text-sm text-muted">
                {troop.wilayaName} · {troop.commune}
              </p>
              {troop.about ? <p className="mt-2 line-clamp-3 text-sm">{troop.about}</p> : null}
              <p className="mt-3 text-sm tabular-nums text-muted">{t("troops.count", { count: troop.listingCount })}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="mt-6 rounded-xl border border-border bg-card p-8 text-center text-muted">{t("troops.empty")}</div>
      )}
    </Shell>
  );
}
