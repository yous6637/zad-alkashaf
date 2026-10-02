import { useEffect, useState, type ReactNode } from "react";
import { createFileRoute, Navigate, redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { Shell } from "@/components/shell";
import { Button, controlClass, Field } from "@/components/ui";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isLocale } from "@/lib/i18n";
import { useT } from "@/lib/use-locale";
import {
  adminActivateSubscription,
  adminHideProduct,
  adminOverview,
  adminResolveReport,
  adminSetTroopStatus,
  adminUpdatePlan,
  getCurrentUser,
  getMe,
} from "@/lib/zad/api";
import { parseIntField, planFieldErrors, planSchema } from "@/lib/zad/plan";
import type { Plan } from "@/lib/zad/types";

export const Route = createFileRoute("/$locale/admin")({
  beforeLoad: async ({ params }) => {
    const locale = isLocale(params.locale) ? params.locale : "ar";
    try {
      const current = await getCurrentUser();
      if (current.role !== "admin") {
        throw redirect({ to: "/$locale", params: { locale } });
      }
    } catch (error) {
      if (error instanceof Error && error.message === "Unauthorized") {
        throw redirect({ to: "/$locale/login", params: { locale } });
      }
      throw error;
    }
  },
  component: AdminPage,
});

type Overview = Awaited<ReturnType<typeof adminOverview>>;

function AdminPage() {
  const { locale } = Route.useParams();
  const account = isLocale(locale) ? locale : "ar";
  const t = useT();
  const { user, isPending } = useCurrentUserState();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<"troops" | "subs" | "products" | "reports" | "plan">("troops");

  function load() {
    return adminOverview({ data: { locale: account } }).then(setData);
  }

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    getMe()
      .then((me) => {
        if (cancel) return;
        if (me.platformRole !== "admin") {
          setAllowed(false);
          return;
        }
        setAllowed(true);
        return adminOverview({ data: { locale: account } }).then((next) => {
          if (!cancel) setData(next);
        });
      })
      .catch(() => {
        if (!cancel) setAllowed(false);
      });
    return () => {
      cancel = true;
    };
  }, [user, account]);

  if (isPending || (user && allowed === null)) {
    return (
      <Shell>
        <div className="h-40 animate-pulse rounded-xl bg-surface" />
      </Shell>
    );
  }
  if (!user) return <Navigate to="/$locale/login" params={{ locale: account }} />;
  if (!allowed || !data) return <Navigate to="/$locale" params={{ locale: account }} />;

  function run(work: Promise<unknown>) {
    work.then(() => load()).catch((error) => toast.error(error instanceof Error ? error.message : t("admin.failed")));
  }

  const troopStatus = {
    pending: "troop.statusPending",
    active: "troop.statusActive",
    suspended: "troop.statusSuspended",
  } as const;
  const subStatus = {
    pending: "sub.statusPending",
    active: "sub.statusActive",
    expired: "sub.statusExpired",
    suspended: "sub.statusSuspended",
  } as const;
  const productStatus = {
    active: "gear.stActive",
    unavailable: "gear.stUnavailable",
    hidden: "gear.stHidden",
  } as const;
  const reasonKey = {
    wrong_info: "product.reasonWrong",
    inappropriate: "product.reasonBad",
    duplicate: "product.reasonDuplicate",
    other: "product.reasonOther",
  } as const;
  const money = new Intl.NumberFormat(account === "ar" ? "ar-DZ" : "fr-DZ", { maximumFractionDigits: 0 });

  return (
    <Shell>
      <h1 className="text-3xl font-semibold">{t("admin.title")}</h1>
      <div className="mt-4 grid gap-3 sm:grid-cols-4">
        <Stat label={t("admin.statTroops")} value={String(data.troops.length)} />
        <Stat label={t("admin.statSubs")} value={String(data.subs.length)} />
        <Stat label={t("admin.statProducts")} value={String(data.products.length)} />
        <Stat
          label={t("admin.statReports")}
          value={String(data.reports.filter((report) => report.status === "open").length)}
        />
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {(
          [
            ["troops", "admin.tabTroops"],
            ["subs", "admin.tabSubs"],
            ["products", "admin.tabProducts"],
            ["reports", "admin.tabReports"],
            ["plan", "admin.tabPlan"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={`h-11 rounded-md px-3 text-sm ${tab === key ? "bg-accent text-accent-fg" : "border border-border bg-card"}`}
            onClick={() => setTab(key)}
          >
            {t(label)}
          </button>
        ))}
      </div>
      <div className="mt-4">
        {tab === "troops" ? (
          data.troops.length ? (
            <Rows
              rows={data.troops.map((troop) => [
                troop.name,
                troop.wilayaName,
                t(troopStatus[troop.status as keyof typeof troopStatus] ?? "troop.statusPending"),
                String(troop.members),
                <span key={troop.id} className="flex gap-2">
                  <Button type="button" onClick={() => run(adminSetTroopStatus({ data: { id: troop.id, status: "active" } }))}>
                    {t("admin.accept")}
                  </Button>
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() => run(adminSetTroopStatus({ data: { id: troop.id, status: "suspended" } }))}
                  >
                    {t("admin.suspend")}
                  </Button>
                </span>,
              ])}
            />
          ) : (
            <p className="text-sm text-muted">{t("admin.emptyTroops")}</p>
          )
        ) : null}
        {tab === "subs" ? (
          data.subs.length ? (
            <div className="space-y-3">
              {data.subs.map((sub) => (
                <article key={sub.id} className="rounded-lg border border-border bg-card p-4 text-sm">
                  <p className="font-medium">
                    {sub.troopName} · {t(subStatus[sub.status as keyof typeof subStatus] ?? "sub.statusPending")}
                  </p>
                  <p className="mt-1 tabular-nums text-muted">
                    {t("sub.price", { amount: money.format(Number(sub.price)) })}
                    {" · "}
                    {t("admin.limits", { members: sub.maxMembers, products: sub.maxProducts })}
                    {sub.endsOn ? ` · ${t("admin.until", { date: sub.endsOn })}` : ""}
                  </p>
                  <p className="mt-2">{sub.proof}</p>
                  {sub.status !== "active" ? (
                    <Button type="button" className="mt-3" onClick={() => run(adminActivateSubscription({ data: { id: sub.id } }))}>
                      {t("admin.activate")}
                    </Button>
                  ) : null}
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">{t("admin.emptySubs")}</p>
          )
        ) : null}
        {tab === "products" ? (
          data.products.length ? (
            <Rows
              rows={data.products.map((product) => [
                product.title,
                product.troopName,
                t(product.visibility === "hidden" ? "gear.stHidden" : (productStatus[product.status as keyof typeof productStatus] ?? "gear.stUnavailable")),
                <Button
                  key={product.id}
                  type="button"
                  variant="ghost"
                  onClick={() => run(adminHideProduct({ data: { id: product.id, hidden: product.visibility !== "hidden" } }))}
                >
                  {product.visibility === "hidden" ? t("admin.show") : t("admin.hide")}
                </Button>,
              ])}
            />
          ) : (
            <p className="text-sm text-muted">{t("admin.emptyProducts")}</p>
          )
        ) : null}
        {tab === "reports" ? (
          data.reports.length ? (
            <div className="space-y-3">
              {data.reports.map((report) => (
                <article key={report.id} className="rounded-lg border border-border bg-card p-4 text-sm">
                  <p className="font-medium">
                    {t(reasonKey[report.reason as keyof typeof reasonKey] ?? "product.reasonOther")}
                    {" · "}
                    {report.status === "open" ? t("admin.open") : t("admin.resolved")}
                  </p>
                  <p className="text-muted">
                    {report.productTitle}
                    {" · "}
                    {t(
                      report.productVisibility === "hidden"
                        ? "gear.stHidden"
                        : (productStatus[report.productStatus as keyof typeof productStatus] ?? "gear.stUnavailable"),
                    )}
                  </p>
                  {report.note ? <p className="mt-2">{report.note}</p> : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    {report.productVisibility !== "hidden" ? (
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() => run(adminHideProduct({ data: { id: report.productId, hidden: true } }))}
                      >
                        {t("admin.hide")}
                      </Button>
                    ) : null}
                    {report.status === "open" ? (
                      <Button type="button" variant="ghost" onClick={() => run(adminResolveReport({ data: { id: report.id } }))}>
                        {t("admin.resolve")}
                      </Button>
                    ) : null}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">{t("admin.emptyReports")}</p>
          )
        ) : null}
        {tab === "plan" && data.plan ? <PlanForm plan={data.plan} onDone={() => load().catch(() => undefined)} /> : null}
      </div>
    </Shell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function Rows({ rows }: { rows: (string | ReactNode)[][] }) {
  return (
    <div className="space-y-2">
      {rows.map((cells, index) => (
        <div
          key={index}
          className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3 text-sm"
        >
          <div className="flex flex-wrap gap-3">
            {cells.slice(0, -1).map((cell, cellIndex) => (
              <span key={cellIndex}>{cell}</span>
            ))}
          </div>
          {cells[cells.length - 1]}
        </div>
      ))}
    </div>
  );
}

function PlanForm({ plan, onDone }: { plan: Plan; onDone: () => void }) {
  const t = useT();
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  return (
    <form
      className="max-w-md space-y-3 rounded-lg border border-border bg-card p-4"
      onSubmit={(event) => {
        event.preventDefault();
        const fd = new FormData(event.currentTarget);
        const parsed = planSchema.safeParse({
          price: parseIntField(fd.get("price")),
          durationDays: parseIntField(fd.get("durationDays")),
          maxMembers: parseIntField(fd.get("maxMembers")),
          maxProducts: parseIntField(fd.get("maxProducts")),
        });
        if (!parsed.success) {
          setErrors(planFieldErrors(parsed.error));
          toast.error(t("auth.invalid"));
          return;
        }
        setErrors({});
        setPending(true);
        adminUpdatePlan({ data: parsed.data })
          .then(() => {
            toast.success(t("admin.planSaved"));
            onDone();
          })
          .catch((error) => toast.error(error instanceof Error ? error.message : t("admin.failed")))
          .finally(() => setPending(false));
      }}
    >
      <p className="text-sm text-muted">{t("admin.planLead")}</p>
      <Field label={t("admin.price")} error={errors.price ? t(errors.price) : undefined}>
        <input className={controlClass} name="price" type="number" min={0} defaultValue={plan.price} />
      </Field>
      <Field label={t("admin.duration")} error={errors.durationDays ? t(errors.durationDays) : undefined}>
        <input className={controlClass} name="durationDays" type="number" min={1} defaultValue={plan.durationDays} />
      </Field>
      <Field label={t("admin.maxMembers")} error={errors.maxMembers ? t(errors.maxMembers) : undefined}>
        <input className={controlClass} name="maxMembers" type="number" min={1} defaultValue={plan.maxMembers} />
      </Field>
      <Field label={t("admin.maxProducts")} error={errors.maxProducts ? t(errors.maxProducts) : undefined}>
        <input className={controlClass} name="maxProducts" type="number" min={1} defaultValue={plan.maxProducts} />
      </Field>
      <Button type="submit" disabled={pending}>
        {pending ? t("auth.pending") : t("admin.savePlan")}
      </Button>
    </form>
  );
}
