import { createFileRoute } from "@tanstack/react-router";
import { EmptyState } from "@/components/home/empty-state";
import { TroopsPending } from "@/components/layout/route-pending";
import { ErrorPage } from "@/components/layout/status-page";
import { Shell } from "@/components/layout/shell";
import { TroopCard } from "@/components/troops/troop-card";
import { useT } from "@/lib/use-locale";
import { listTroops } from "@/lib/zad/api";

export const Route = createFileRoute("/$locale/troops")({
  loader: ({ params }) => listTroops({ data: { locale: params.locale === "fr" ? "fr" : "ar" } }),
  pendingMs: 0,
  pendingMinMs: 200,
  pendingComponent: TroopsPending,
  errorComponent: ErrorPage,
  component: TroopsPage,
});

function TroopsPage() {
  const t = useT();
  const troops = Route.useLoaderData();
  return (
    <Shell>
      <h1 className="text-3xl font-semibold">{t("troops.title")}</h1>
      <p className="mt-2 text-muted">{t("troops.lead")}</p>
      {troops.length ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {troops.map((troop) => (
            <TroopCard key={troop.id} troop={troop} />
          ))}
        </div>
      ) : (
        <div className="mt-6">
          <EmptyState title={t("troops.empty")} />
        </div>
      )}
    </Shell>
  );
}
