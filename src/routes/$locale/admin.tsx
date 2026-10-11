import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute, Link, Navigate, redirect } from "@tanstack/react-router";
import { z } from "zod";
import {
  Box,
  Calendar,
  CheckCircle2,
  Clock,
  Flag,
  LayoutDashboard,
  Package,
  RefreshCw,
  Search,
  Settings,
  Tent,
  Users,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { Button, controlClass, Field, Modal } from "@/components/shared/controls";
import { AdminPending } from "@/components/layout/route-pending";
import { ErrorPage } from "@/components/layout/status-page";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/cn";
import { isLocale } from "@/lib/i18n";
import { useT } from "@/lib/use-locale";
import {
  adminActivateSubscription,
  adminRejectSubscription,
  adminSuspendSubscription,
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
  pendingMs: 0,
  pendingMinMs: 200,
  pendingComponent: AdminPending,
  errorComponent: ErrorPage,
  component: AdminPage,
});

type Overview = Awaited<ReturnType<typeof adminOverview>>;

type SubDecision = {
  id: string;
  troopName: string;
  maxMembers: number;
  maxProducts: number;
  action: "activate" | "reject" | "suspend";
};

function AdminPage() {
  const { locale } = Route.useParams();
  const account = isLocale(locale) ? locale : "ar";
  const t = useT();
  const { user, isPending } = useCurrentUserState();
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [data, setData] = useState<Overview | null>(null);
  const [tab, setTab] = useState<"troops" | "subs" | "products" | "reports" | "plan">("troops");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [decision, setDecision] = useState<SubDecision | null>(null);

  function load() {
    return adminOverview({ data: { locale: account } }).then(setData);
  }

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    getMe()
      .then(async (me) => {
        if (cancel) return;
        if (me.platformRole !== "admin") {
          setAllowed(false);
          return;
        }
        const next = await adminOverview({ data: { locale: account } });
        if (cancel) return;
        setData(next);
        setAllowed(true);
      })
      .catch(() => {
        if (!cancel) setAllowed(false);
      });
    return () => {
      cancel = true;
    };
  }, [user, account]);

  if (isPending || (user && allowed === null)) {
    return <AdminPending />;
  }
  if (!user) return <Navigate to="/$locale/login" params={{ locale: account }} />;
  if (allowed === false) return <Navigate to="/$locale" params={{ locale: account }} />;
  if (!data) {
    return <AdminPending />;
  }

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
    rejected: "sub.statusRejected",
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
  const now = new Date();
  const dateLocale = account === "ar" ? "ar-DZ" : "fr-DZ";
  const dateLabel = new Intl.DateTimeFormat(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(now);
  const timeLabel = new Intl.DateTimeFormat(dateLocale, { hour: "2-digit", minute: "2-digit" }).format(now);
  const needle = query.trim();
  const pendingTroops = data.troops.filter((troop) => troop.status === "pending").length;
  const activeTroops = data.troops.filter((troop) => troop.status === "active").length;
  const openReports = data.reports.filter((report) => report.status === "open").length;

  const rows: { id: string; cells: ReactNode[]; action: ReactNode }[] =
    tab === "subs"
      ? data.subs
          .filter((sub) => (!needle || sub.troopName.includes(needle)) && (status === "all" || sub.status === status))
          .map((sub) => ({
            id: sub.id,
            cells: [
              <span key="name">
                <span className="block font-medium">{sub.troopName}</span>
                {sub.startsOn || sub.endsOn ? (
                  <span className="mt-0.5 block text-xs text-muted">
                    {sub.startsOn ?? "—"} – {sub.endsOn ?? "—"}
                  </span>
                ) : null}
                {sub.proof ? <span className="mt-0.5 block text-xs text-muted">{sub.proof}</span> : null}
                {sub.adminNote ? <span className="mt-0.5 block text-xs text-muted">{sub.adminNote}</span> : null}
              </span>,
              t("sub.price", { amount: money.format(Number(sub.price)) }),
              t("admin.limits", { members: sub.maxMembers, products: sub.maxProducts }),
              <Badge key="s" tone={toneFor(sub.status)}>
                {t(subStatus[sub.status as keyof typeof subStatus] ?? "sub.statusPending")}
              </Badge>,
              <Badge key="pay" tone={sub.paidAt ? "green" : "amber"}>
                {sub.paidAt ? t("admin.paidOn", { date: sub.paidAt.slice(0, 10) }) : t("admin.unpaid")}
              </Badge>,
            ],
            action: (
              <span className="flex flex-wrap gap-2">
                {sub.status !== "active" ? (
                  <Button
                    type="button"
                    onClick={() =>
                      setDecision({
                        id: sub.id,
                        troopName: sub.troopName,
                        maxMembers: sub.maxMembers,
                        maxProducts: sub.maxProducts,
                        action: "activate",
                      })
                    }
                  >
                    {t("admin.activate")}
                  </Button>
                ) : null}
                {sub.status === "pending" ? (
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setDecision({
                        id: sub.id,
                        troopName: sub.troopName,
                        maxMembers: sub.maxMembers,
                        maxProducts: sub.maxProducts,
                        action: "reject",
                      })
                    }
                  >
                    {t("admin.reject")}
                  </Button>
                ) : null}
                {sub.status === "active" ? (
                  <Button
                    type="button"
                    variant="danger"
                    onClick={() =>
                      setDecision({
                        id: sub.id,
                        troopName: sub.troopName,
                        maxMembers: sub.maxMembers,
                        maxProducts: sub.maxProducts,
                        action: "suspend",
                      })
                    }
                  >
                    {t("admin.suspend")}
                  </Button>
                ) : null}
              </span>
            ),
          }))
      : tab === "products"
        ? data.products
            .filter(
              (product) =>
                (!needle || `${product.title} ${product.troopName}`.includes(needle)) &&
                (status === "all" ||
                  (status === "hidden" ? product.visibility === "hidden" : product.status === status && product.visibility !== "hidden")),
            )
            .map((product) => ({
              id: product.id,
              cells: [
                product.title,
                product.troopName,
                <Badge key="p" tone={product.visibility === "hidden" ? "rose" : toneFor(product.status)}>
                  {t(
                    product.visibility === "hidden"
                      ? "gear.stHidden"
                      : (productStatus[product.status as keyof typeof productStatus] ?? "gear.stUnavailable"),
                  )}
                </Badge>,
              ],
              action: (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => run(adminHideProduct({ data: { id: product.id, hidden: product.visibility !== "hidden" } }))}
                >
                  {product.visibility === "hidden" ? t("admin.show") : t("admin.hide")}
                </Button>
              ),
            }))
        : tab === "reports"
          ? data.reports
              .filter(
                (report) =>
                  (!needle || `${report.productTitle} ${report.note}`.includes(needle)) &&
                  (status === "all" || report.status === status),
              )
              .map((report) => ({
                id: report.id,
                cells: [
                  report.productTitle,
                  t(reasonKey[report.reason as keyof typeof reasonKey] ?? "product.reasonOther"),
                  <Badge key="r" tone={report.status === "open" ? "blue" : "green"}>
                    {report.status === "open" ? t("admin.open") : t("admin.resolved")}
                  </Badge>,
                ],
                action: (
                  <span className="flex gap-2">
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
                  </span>
                ),
              }))
          : data.troops
              .filter(
                (troop) =>
                  (!needle || `${troop.name} ${troop.wilayaName}`.includes(needle)) &&
                  (status === "all" || troop.status === status),
              )
              .map((troop) => ({
                id: troop.id,
                cells: [
                  troop.name,
                  troop.wilayaName,
                  String(troop.members),
                  <Badge key="t" tone={toneFor(troop.status)}>
                    {t(troopStatus[troop.status as keyof typeof troopStatus] ?? "troop.statusPending")}
                  </Badge>,
                ],
                action: (
                  <span className="flex gap-2">
                    {troop.status === "pending" || troop.pendingSubId ? (
                      <Button
                        type="button"
                        onClick={() =>
                          run(
                            (async () => {
                              if (troop.status !== "active") {
                                await adminSetTroopStatus({ data: { id: troop.id, status: "active" } });
                              }
                              if (troop.pendingSubId) {
                                await adminActivateSubscription({ data: { id: troop.pendingSubId } });
                              }
                              toast.success(t("admin.accepted"));
                            })(),
                          )
                        }
                      >
                        {t("admin.accept")}
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => run(adminSetTroopStatus({ data: { id: troop.id, status: "suspended" } }))}
                    >
                      {t("admin.suspend")}
                    </Button>
                  </span>
                ),
              }));

  const pageCount = Math.max(1, Math.ceil(rows.length / 8));
  const safePage = Math.min(page, pageCount);
  const visible = rows.slice((safePage - 1) * 8, safePage * 8);
  const headers =
    tab === "subs"
      ? [t("admin.colTroop"), t("admin.colPrice"), t("admin.colLimits"), t("admin.colStatus"), t("admin.colPayment"), t("admin.colActions")]
      : tab === "products"
        ? [t("admin.colProduct"), t("admin.colTroop"), t("admin.colStatus"), t("admin.colActions")]
        : tab === "reports"
          ? [t("admin.colProduct"), t("admin.tabReports"), t("admin.colStatus"), t("admin.colActions")]
          : [t("admin.colTroop"), t("admin.colWilaya"), t("admin.colMembers"), t("admin.colStatus"), t("admin.colActions")];
  const listTitle =
    tab === "subs"
      ? t("admin.tabSubs")
      : tab === "products"
        ? t("admin.tabProducts")
        : tab === "reports"
          ? t("admin.tabReports")
          : t("admin.tabTroops");
  const statusOptions =
    tab === "subs"
      ? ["all", "pending", "active", "expired", "suspended", "rejected"]
      : tab === "products"
        ? ["all", "active", "unavailable", "hidden"]
        : tab === "reports"
          ? ["all", "open", "resolved"]
          : ["all", "pending", "active", "suspended"];
  const statusLabel = (value: string) => {
    if (value === "all") return t("admin.filterAll");
    if (value === "open") return t("admin.open");
    if (value === "resolved") return t("admin.resolved");
    if (value === "hidden") return t("gear.stHidden");
    if (value in productStatus && tab === "products") return t(productStatus[value as keyof typeof productStatus]);
    if (value in subStatus && tab === "subs") return t(subStatus[value as keyof typeof subStatus]);
    if (value in troopStatus) return t(troopStatus[value as keyof typeof troopStatus]);
    return value;
  };
  const empty =
    tab === "subs"
      ? t("admin.emptySubs")
      : tab === "products"
        ? t("admin.emptyProducts")
        : tab === "reports"
          ? t("admin.emptyReports")
          : t("admin.emptyTroops");

  function choose(next: typeof tab) {
    setTab(next);
    setQuery("");
    setStatus("all");
    setPage(1);
  }

  const nav = [
    ["troops", "admin.title", LayoutDashboard],
    ["subs", "admin.tabSubs", Users],
    ["products", "admin.tabProducts", Package],
    ["reports", "admin.tabReports", Flag],
    ["plan", "admin.tabPlan", Settings],
  ] as const;

  return (
    <div className="flex min-h-screen bg-[#f4f7f5] text-fg">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 flex-col bg-[#0f3d2e] px-4 py-5 text-white lg:flex">
        <Link to="/$locale" params={{ locale: account }} className="flex items-center gap-2 px-2">
          <Tent className="size-8" strokeWidth={1.75} aria-hidden="true" />
          <span>
            <span className="block text-base font-bold">{t("brand.name")}</span>
            <span className="block text-xs text-white/70">Zad Al-Kashaf</span>
          </span>
        </Link>
        <nav className="mt-8 space-y-1">
          {nav.map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              className={cn(
                "flex h-11 w-full items-center gap-2 rounded-xl px-3 text-sm",
                tab === key ? "bg-[#1f8a4d] text-white" : "text-white/80",
              )}
              onClick={() => choose(key)}
            >
              <Icon className="size-4" aria-hidden="true" />
              {t(label)}
            </button>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1">
        <header className="flex items-center gap-3 border-b border-border/70 bg-white px-4 py-3">
          <label className="relative ms-auto hidden max-w-md flex-1 sm:block">
            <Search className="pointer-events-none absolute inset-y-0 end-3 my-auto size-4 text-muted" aria-hidden="true" />
            <input
              className="h-11 w-full rounded-full border border-border bg-[#f7f8f6] pe-10 ps-4 text-sm"
              value={query}
              placeholder={t("admin.search")}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
            />
          </label>
          <div className="flex items-center gap-2">
            <span className="flex size-9 items-center justify-center rounded-full bg-[#e7f6ee] text-[#167944]">
              <Users className="size-4" aria-hidden="true" />
            </span>
            <span className="text-sm font-medium">{t("admin.hello", { name: user.displayName ?? t("nav.admin") })}</span>
            <button
              type="button"
              className="inline-flex size-11 items-center justify-center rounded-full border border-border"
              aria-label={t("admin.tabPlan")}
              onClick={() => choose("plan")}
            >
              <Settings className="size-4" aria-hidden="true" />
            </button>
          </div>
        </header>
        <div className="flex gap-2 overflow-x-auto px-4 py-3 lg:hidden">
          {nav.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={cn(
                "h-10 shrink-0 rounded-full px-3 text-sm",
                tab === key ? "bg-[#0f3d2e] text-white" : "border border-border bg-white",
              )}
              onClick={() => choose(key)}
            >
              {t(label)}
            </button>
          ))}
        </div>
        <main className="space-y-4 px-4 py-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold">{t("admin.title")}</h1>
              <p className="mt-1 text-sm text-muted">{t("admin.welcome")}</p>
            </div>
            <div className="text-sm text-muted">
              <p className="flex items-center gap-2">
                <Calendar className="size-4" aria-hidden="true" />
                {dateLabel}
              </p>
              <p className="mt-1">{timeLabel}</p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label={t("admin.statPending")} value={String(pendingTroops)} tone="blue" icon={<Clock className="size-5" />} />
            <StatCard label={t("admin.statActive")} value={String(activeTroops)} tone="green" icon={<CheckCircle2 className="size-5" />} />
            <StatCard label={t("admin.statProducts")} value={String(data.products.length)} tone="amber" icon={<Box className="size-5" />} />
            <StatCard label={t("admin.statReports")} value={String(openReports)} tone="rose" icon={<XCircle className="size-5" />} />
          </div>
          {tab === "plan" && data.plan ? (
            <PlanForm plan={data.plan} onDone={() => load().catch(() => undefined)} />
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-white p-3">
                <label className="relative min-w-48 flex-1">
                  <Search className="pointer-events-none absolute inset-y-0 end-3 my-auto size-4 text-muted" aria-hidden="true" />
                  <input
                    className="h-11 w-full rounded-full border border-border bg-[#f7f8f6] pe-10 ps-4 text-sm"
                    value={query}
                    placeholder={t("admin.search")}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setPage(1);
                    }}
                  />
                </label>
                <label className="flex items-center gap-2 text-sm text-muted">
                  {t("admin.colStatus")}
                  <select
                    className="h-11 rounded-xl border border-border bg-white px-3"
                    value={status}
                    onChange={(event) => {
                      setStatus(event.target.value);
                      setPage(1);
                    }}
                  >
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>
                        {statusLabel(option)}
                      </option>
                    ))}
                  </select>
                </label>
                <Button type="button" className="gap-2" onClick={() => load().catch(() => undefined)}>
                  <RefreshCw className="size-4" aria-hidden="true" />
                  {t("admin.refresh")}
                </Button>
              </div>
              <section className="overflow-hidden rounded-2xl border border-border bg-white">
                <h2 className="px-4 py-4 text-lg font-semibold">{listTitle}</h2>
                {visible.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-sm">
                      <thead className="bg-[#f7f8f6] text-muted">
                        <tr>
                          {headers.map((header) => (
                            <th key={header} className="px-4 py-3 text-start font-medium">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {visible.map((row) => (
                          <tr key={row.id} className="border-t border-border">
                            {row.cells.map((cell, index) => (
                              <td key={index} className="px-4 py-3">
                                {cell}
                              </td>
                            ))}
                            <td className="px-4 py-3">{row.action}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="px-4 pb-4 text-sm text-muted">{empty}</p>
                )}
                <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted">
                  <span>
                    {rows.length
                      ? t("admin.showing", {
                          from: (safePage - 1) * 8 + 1,
                          to: Math.min(safePage * 8, rows.length),
                          total: rows.length,
                        })
                      : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-border"
                      disabled={safePage <= 1}
                      onClick={() => setPage(safePage - 1)}
                    >
                      ‹
                    </button>
                    <span className="inline-flex size-9 items-center justify-center rounded-lg bg-[#0f3d2e] text-white">
                      {safePage}
                    </span>
                    <button
                      type="button"
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-border"
                      disabled={safePage >= pageCount}
                      onClick={() => setPage(safePage + 1)}
                    >
                      ›
                    </button>
                  </span>
                </div>
              </section>
            </>
          )}
        </main>
        <SubscriptionDialog
          key={decision ? `${decision.id}-${decision.action}` : "none"}
          target={decision}
          onOpenChange={(open) => {
            if (!open) setDecision(null);
          }}
          onDone={load}
        />
      </div>
    </div>
  );
}
function toneFor(status: string): "green" | "blue" | "rose" | "amber" | "muted" {
  if (status === "active" || status === "resolved") return "green";
  if (status === "pending" || status === "open") return "blue";
  if (status === "rejected" || status === "suspended" || status === "hidden" || status === "expired") return "rose";
  if (status === "unavailable") return "amber";
  return "muted";
}

function Badge({ tone, children }: { tone: "green" | "blue" | "rose" | "amber" | "muted"; children: ReactNode }) {
  const tones = {
    green: "bg-[#e7f6ee] text-[#167944]",
    blue: "bg-[#e7f0fb] text-[#2563eb]",
    rose: "bg-[#fde8e8] text-[#dc2626]",
    amber: "bg-[#fbf3dc] text-[#b45309]",
    muted: "bg-[#f3f4f6] text-[#6b7280]",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium", tones[tone])}>
      {children}
    </span>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string;
  tone: "blue" | "green" | "amber" | "rose";
  icon: ReactNode;
}) {
  const tones = {
    blue: "bg-[#eef5fb]",
    green: "bg-[#eef8f2]",
    amber: "bg-[#fbf8ee]",
    rose: "bg-[#fdf1f1]",
  };
  const icons = {
    blue: "bg-[#dbeafe] text-[#2563eb]",
    green: "bg-[#dcfce7] text-[#167944]",
    amber: "bg-[#fef3c7] text-[#d97706]",
    rose: "bg-[#fee2e2] text-[#dc2626]",
  };
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl p-4", tones[tone])}>
      <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-full", icons[tone])}>{icon}</span>
      <div>
        <p className="text-sm text-muted">{label}</p>
        <p className="text-3xl font-semibold tabular-nums">{value}</p>
      </div>
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

const dayField = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const optionalLimit = z.number().int().positive();

const activateFormSchema = z
  .object({
    startsOn: dayField.optional(),
    endsOn: dayField.optional(),
    maxMembers: optionalLimit.optional(),
    maxProducts: optionalLimit.optional(),
  })
  .refine((value) => !value.startsOn || !value.endsOn || value.endsOn >= value.startsOn);

const noteFormSchema = z.object({
  note: z.string().trim().min(1).max(500),
});

function optionalDay(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text ? text : undefined;
}

function optionalLimitField(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  const amount = Number(text);
  return Number.isInteger(amount) ? amount : Number.NaN;
}

function SubscriptionDialog({
  target,
  onOpenChange,
  onDone,
}: {
  target: SubDecision | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => Promise<void>;
}) {
  const t = useT();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const action = target?.action ?? "activate";
  const title =
    action === "reject" ? t("admin.rejectTitle") : action === "suspend" ? t("admin.suspendTitle") : t("admin.activateTitle");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target) return;
    const fd = new FormData(event.currentTarget);
    setPending(true);
    const work =
      target.action === "activate"
        ? Promise.resolve().then(() => {
            const maxMembers = optionalLimitField(fd.get("maxMembers"));
            const maxProducts = optionalLimitField(fd.get("maxProducts"));
            if (typeof maxMembers === "number" && Number.isNaN(maxMembers)) throw new Error(t("admin.errMembers"));
            if (typeof maxProducts === "number" && Number.isNaN(maxProducts)) throw new Error(t("admin.errProducts"));
            const parsed = activateFormSchema.safeParse({
              startsOn: optionalDay(fd.get("startsOn")),
              endsOn: optionalDay(fd.get("endsOn")),
              maxMembers,
              maxProducts,
            });
            if (!parsed.success) throw new Error(t("admin.errDates"));
            return adminActivateSubscription({ data: { id: target.id, ...parsed.data } }).then(() => t("admin.activated"));
          })
        : Promise.resolve().then(() => {
            const parsed = noteFormSchema.safeParse({ note: fd.get("note") });
            if (!parsed.success) throw new Error(t("admin.errNote"));
            const call =
              target.action === "reject"
                ? adminRejectSubscription({ data: { id: target.id, note: parsed.data.note } })
                : adminSuspendSubscription({ data: { id: target.id, note: parsed.data.note } });
            return call.then(() => (target.action === "reject" ? t("admin.rejectedSub") : t("admin.suspendedSub")));
          });
    work
      .then((message) => {
        toast.success(message);
        onOpenChange(false);
        return onDone();
      })
      .catch((reason) => {
        const message = reason instanceof Error ? reason.message : t("admin.failed");
        setError(message);
        toast.error(message);
      })
      .finally(() => setPending(false));
  }

  return (
    <Modal open={target !== null} onOpenChange={onOpenChange} title={title}>
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <p className="text-sm text-muted">{target?.troopName}</p>
        {action === "activate" ? (
          <>
            <Field label={t("admin.startsOn")}>
              <input className={controlClass} name="startsOn" type="date" />
            </Field>
            <Field label={t("admin.endsOn")}>
              <input className={controlClass} name="endsOn" type="date" />
            </Field>
            <p className="text-xs text-muted">{t("admin.datesHint")}</p>
            <Field label={t("admin.maxMembers")}>
              <input className={controlClass} name="maxMembers" type="number" min={1} defaultValue={target?.maxMembers} />
            </Field>
            <Field label={t("admin.maxProducts")}>
              <input className={controlClass} name="maxProducts" type="number" min={1} defaultValue={target?.maxProducts} />
            </Field>
            <p className="text-xs text-muted">{t("admin.limitsHint")}</p>
          </>
        ) : (
          <Field label={t("admin.note")}>
            <textarea className={`${controlClass} min-h-24 py-2`} name="note" maxLength={500} required />
          </Field>
        )}
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <div className="flex gap-2">
          <Button type="submit" disabled={pending}>
            {pending ? t("auth.pending") : t("admin.confirm")}
          </Button>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            {t("admin.cancel")}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
