import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { createFileRoute, Link, Navigate, redirect } from "@tanstack/react-router";
import { z } from "zod";
import {
  BarChart3,
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
  Tags,
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
import { adminDismissReport, adminListCategories, adminPage, adminReorderCategories, adminSaveCategory, adminStats } from "@/lib/zad/admin";
import {
  adminActivateSubscription,
  adminRejectSubscription,
  adminSuspendSubscription,
  adminHideProduct,
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

type PageData = Awaited<ReturnType<typeof adminPage>>;
type Stats = Awaited<ReturnType<typeof adminStats>>;
type CategoryRow = Awaited<ReturnType<typeof adminListCategories>>[number];
type Tab = "troops" | "subs" | "products" | "reports" | "categories" | "stats" | "plan";
type ListTab = "troops" | "subs" | "products" | "reports";

function isListTab(value: Tab): value is ListTab {
  return value === "troops" || value === "subs" || value === "products" || value === "reports";
}

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
  const [stats, setStats] = useState<Stats | null>(null);
  const [list, setList] = useState<{ resource: ListTab; data: PageData } | null>(null);
  const [categories, setCategories] = useState<CategoryRow[]>([]);
  const [tab, setTab] = useState<Tab>("troops");
  const [draft, setDraft] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [decision, setDecision] = useState<SubDecision | null>(null);
  const [dismissing, setDismissing] = useState<{ id: string; title: string } | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryRow | "new" | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const generation = useRef(0);

  function reload() {
    const id = ++generation.current;
    const listed = isListTab(tab);
    if (listed) setLoadingList(true);
    return Promise.all([
      adminStats({ data: { locale: account } }),
      tab === "categories" ? adminListCategories() : listed ? adminPage({ data: { resource: tab, q: query, status, page, locale: account } }) : Promise.resolve(null),
    ])
      .then(([nextStats, extra]) => {
        if (id !== generation.current) return;
        setStats(nextStats);
        setLoadError(false);
        if (tab === "categories" && Array.isArray(extra)) setCategories(extra);
        if (listed && extra && !Array.isArray(extra)) setList({ resource: tab, data: extra });
        setLoadingList(false);
      })
      .catch((error) => {
        if (id === generation.current) setLoadingList(false);
        throw error;
      });
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
        setAllowed(true);
      })
      .catch(() => {
        if (!cancel) setAllowed(false);
      });
    return () => {
      cancel = true;
    };
  }, [user]);

  useEffect(() => {
    if (allowed !== true) return;
    let cancel = false;
    reload().catch((error) => {
      if (cancel) return;
      setLoadError(true);
      toast.error(error instanceof Error ? error.message : t("admin.failed"));
    });
    return () => {
      cancel = true;
    };
  }, [allowed, tab, query, status, page, account]);

  useEffect(() => {
    if (!list || list.resource !== tab) return;
    const last = Math.max(1, Math.ceil(list.data.total / list.data.pageSize));
    if (page > last) setPage(last);
  }, [list, tab, page]);

  if (isPending || (user && allowed === null) || (allowed === true && !stats && !loadError)) {
    return <AdminPending />;
  }
  if (!user) return <Navigate to="/$locale/login" params={{ locale: account }} />;
  if (allowed === false) return <Navigate to="/$locale" params={{ locale: account }} />;
  if (!stats) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f7f5] px-4">
        <div className="max-w-md rounded-2xl border border-border bg-white p-8 text-center">
          <h1 className="text-xl font-semibold">{t("errors.errorTitle")}</h1>
          <p className="mt-2 text-sm text-muted">{t("errors.errorBody")}</p>
          <Button
            type="button"
            className="mt-4"
            onClick={() => {
              setLoadError(false);
              reload().catch(() => setLoadError(true));
            }}
          >
            {t("errors.retry")}
          </Button>
        </div>
      </div>
    );
  }

  function run(work: Promise<unknown>) {
    setBusy(true);
    work
      .then(() => reload())
      .catch((error) => toast.error(error instanceof Error ? error.message : t("admin.failed")))
      .finally(() => setBusy(false));
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    if (!isListTab(tab)) setTab("troops");
    if (next === query && page === 1 && isListTab(tab)) {
      reload().catch((error) => toast.error(error instanceof Error ? error.message : t("admin.failed")));
      return;
    }
    setPage(1);
    setQuery(next);
  }

  function choose(next: Tab) {
    setTab(next);
    setDraft("");
    setQuery("");
    setStatus("all");
    setPage(1);
  }

  function moveCategory(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= categories.length) return;
    const next = categories.slice();
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    run(adminReorderCategories({ data: { ids: next.map((category) => category.id) } }));
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
  const listReady = isListTab(tab) && list?.resource === tab;
  const pageRows = listReady && list ? list.data : { total: 0, pageSize: 8, troops: [], subs: [], products: [], reports: [] };

  const rows: { id: string; cells: ReactNode[]; action: ReactNode }[] =
    tab === "subs"
      ? pageRows.subs.map((sub) => ({
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
        ? pageRows.products.map((product) => ({
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
          ? pageRows.reports.map((report) => ({
                id: report.id,
                cells: [
                  <span key="product">
                    <span className="block font-medium">{report.productTitle}</span>
                    {report.note ? <span className="mt-0.5 block max-w-xs text-xs text-muted">{report.note}</span> : null}
                    {report.adminNote ? (
                      <span className="mt-0.5 block max-w-xs text-xs text-muted">
                        {t("admin.reportNote")}: {report.adminNote}
                      </span>
                    ) : null}
                  </span>,
                  t(reasonKey[report.reason as keyof typeof reasonKey] ?? "product.reasonOther"),
                  <Badge key="r" tone={toneFor(report.status)}>
                    {report.status === "dismissed" ? t("admin.dismissed") : report.status === "open" ? t("admin.open") : t("admin.resolved")}
                  </Badge>,
                ],
                action: (
                  <span className="flex flex-wrap gap-2">
                    {report.productVisibility !== "hidden" ? (
                      <Button
                        type="button"
                        variant="danger"
                        onClick={() =>
                          run(
                            adminHideProduct({ data: { id: report.productId, hidden: true } }).then(() => {
                              toast.success(t("admin.hiddenOk"));
                            }),
                          )
                        }
                      >
                        {t("admin.hide")}
                      </Button>
                    ) : null}
                    {report.status === "open" ? (
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setDismissing({ id: report.id, title: report.productTitle })}
                      >
                        {t("admin.dismiss")}
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
          : pageRows.troops.map((troop) => ({
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

  const pageSize = pageRows.pageSize || 8;
  const total = listReady ? pageRows.total : 0;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const visible = rows;
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
          ? ["all", "open", "resolved", "dismissed"]
          : ["all", "pending", "active", "suspended"];
  const statusLabel = (value: string) => {
    if (value === "all") return t("admin.filterAll");
    if (value === "open") return t("admin.open");
    if (value === "resolved") return t("admin.resolved");
    if (value === "dismissed") return t("admin.dismissed");
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

  const nav = [
    ["troops", "admin.title", LayoutDashboard],
    ["subs", "admin.tabSubs", Users],
    ["products", "admin.tabProducts", Package],
    ["reports", "admin.tabReports", Flag],
    ["categories", "admin.tabCategories", Tags],
    ["stats", "admin.tabStats", BarChart3],
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
          <form className="relative ms-auto hidden max-w-md flex-1 sm:block" onSubmit={submitSearch}>
            <Search className="pointer-events-none absolute inset-y-0 end-3 my-auto size-4 text-muted" aria-hidden="true" />
            <input
              className="h-11 w-full rounded-full border border-border bg-[#f7f8f6] pe-10 ps-4 text-sm"
              value={draft}
              placeholder={t("admin.search")}
              onChange={(event) => setDraft(event.target.value)}
            />
            <button type="submit" className="sr-only">
              {t("admin.search")}
            </button>
          </form>
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
            <StatCard label={t("admin.statPending")} value={String(stats.pendingTroops)} tone="blue" icon={<Clock className="size-5" />} />
            <StatCard label={t("admin.statActive")} value={String(stats.activeTroops)} tone="green" icon={<CheckCircle2 className="size-5" />} />
            <StatCard label={t("admin.statProducts")} value={String(stats.products)} tone="amber" icon={<Box className="size-5" />} />
            <StatCard label={t("admin.statReports")} value={String(stats.reports.open)} tone="rose" icon={<XCircle className="size-5" />} />
          </div>
          {tab === "plan" ? (
            stats.plan ? (
              <PlanForm plan={stats.plan} onDone={() => reload().then(() => undefined)} />
            ) : (
              <p className="rounded-2xl border border-border bg-white p-4 text-sm text-muted">{t("admin.rateNone")}</p>
            )
          ) : tab === "stats" ? (
            <StatsPanel stats={stats} />
          ) : tab === "categories" ? (
            <CategoriesPanel categories={categories} busy={busy} onEdit={setEditingCategory} onMove={moveCategory} />
          ) : (
            <>
              <form className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-white p-3" onSubmit={submitSearch}>
                <label className="relative min-w-48 flex-1">
                  <Search className="pointer-events-none absolute inset-y-0 end-3 my-auto size-4 text-muted" aria-hidden="true" />
                  <input
                    className="h-11 w-full rounded-full border border-border bg-[#f7f8f6] pe-10 ps-4 text-sm"
                    value={draft}
                    placeholder={t("admin.search")}
                    onChange={(event) => setDraft(event.target.value)}
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
                <Button type="submit" className="gap-2" disabled={busy}>
                  <RefreshCw className="size-4" aria-hidden="true" />
                  {t("admin.refresh")}
                </Button>
              </form>
              <section className="overflow-hidden rounded-2xl border border-border bg-white">
                <h2 className="px-4 py-4 text-lg font-semibold">{listTitle}</h2>
                {!listReady || loadingList ? (
                  <p className="px-4 pb-4 text-sm text-muted">{t("auth.pending")}</p>
                ) : visible.length ? (
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
                    {total
                      ? t("admin.showing", {
                          from: (page - 1) * pageSize + 1,
                          to: Math.min(page * pageSize, total),
                          total,
                        })
                      : ""}
                  </span>
                  <span className="flex items-center gap-2">
                    <button
                      type="button"
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-border disabled:opacity-40"
                      disabled={page <= 1}
                      onClick={() => setPage(page - 1)}
                    >
                      ‹
                    </button>
                    <span className="inline-flex size-9 items-center justify-center rounded-lg bg-[#0f3d2e] text-white">
                      {page}
                    </span>
                    <button
                      type="button"
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-border disabled:opacity-40"
                      disabled={page >= pageCount}
                      onClick={() => setPage(page + 1)}
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
          onDone={() => reload()}
        />
        <DismissDialog
          key={dismissing?.id ?? "dismiss-none"}
          target={dismissing}
          onOpenChange={(open) => {
            if (!open) setDismissing(null);
          }}
          onDone={() => reload()}
        />
        <CategoryDialog
          key={editingCategory === "new" ? "category-new" : (editingCategory?.id ?? "category-none")}
          target={editingCategory}
          onOpenChange={(open) => {
            if (!open) setEditingCategory(null);
          }}
          onDone={() => reload()}
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

function DismissDialog({
  target,
  onOpenChange,
  onDone,
}: {
  target: { id: string; title: string } | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => Promise<unknown>;
}) {
  const t = useT();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target) return;
    const parsed = noteFormSchema.safeParse({ note: new FormData(event.currentTarget).get("note") });
    if (!parsed.success) {
      setError(t("admin.errNote"));
      return;
    }
    setError("");
    setPending(true);
    adminDismissReport({ data: { id: target.id, note: parsed.data.note } })
      .then(() => {
        toast.success(t("admin.dismissedOk"));
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
    <Modal open={target !== null} onOpenChange={onOpenChange} title={t("admin.dismissTitle")}>
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <p className="text-sm text-muted">{target?.title}</p>
        <Field label={t("admin.reportNote")} error={error || undefined}>
          <textarea className={`${controlClass} min-h-24 py-2`} name="note" maxLength={500} required />
        </Field>
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

function CategoryDialog({
  target,
  onOpenChange,
  onDone,
}: {
  target: CategoryRow | "new" | null;
  onOpenChange: (open: boolean) => void;
  onDone: () => Promise<unknown>;
}) {
  const t = useT();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const current = target && target !== "new" ? target : null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!target) return;
    const fd = new FormData(event.currentTarget);
    const slug = String(fd.get("slug") ?? "").trim().toLowerCase();
    const nameAr = String(fd.get("nameAr") ?? "").trim();
    const nameFr = String(fd.get("nameFr") ?? "").trim();
    const isActive = fd.get("isActive") === "on";
    const slugOk = /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) && slug.length <= 40;
    if (!slugOk || nameAr.length < 2 || nameAr.length > 80 || nameFr.length < 2 || nameFr.length > 80) {
      setError(t("auth.invalid"));
      return;
    }
    setError("");
    setPending(true);
    adminSaveCategory({
      data: current
        ? { id: current.id, slug, nameAr, nameFr, isActive }
        : { slug, nameAr, nameFr, isActive },
    })
      .then(() => {
        toast.success(t("admin.categorySaved"));
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
    <Modal open={target !== null} onOpenChange={onOpenChange} title={current ? t("admin.categoryEdit") : t("admin.categoryNew")}>
      <form className="flex flex-col gap-3" onSubmit={submit}>
        <Field label={t("admin.categorySlug")}>
          <input className={controlClass} name="slug" defaultValue={current?.slug ?? ""} maxLength={40} required />
        </Field>
        <Field label={t("admin.categoryAr")}>
          <input className={controlClass} name="nameAr" defaultValue={current?.nameAr ?? ""} maxLength={80} required />
        </Field>
        <Field label={t("admin.categoryFr")}>
          <input className={controlClass} name="nameFr" defaultValue={current?.nameFr ?? ""} maxLength={80} required />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={current ? current.isActive : true} className="size-4" />
          {t("admin.categoryActive")}
        </label>
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

function CategoriesPanel({
  categories,
  busy,
  onEdit,
  onMove,
}: {
  categories: CategoryRow[];
  busy: boolean;
  onEdit: (category: CategoryRow | "new") => void;
  onMove: (index: number, delta: number) => void;
}) {
  const t = useT();
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
        <h2 className="text-lg font-semibold">{t("admin.tabCategories")}</h2>
        <Button type="button" onClick={() => onEdit("new")}>
          {t("admin.categoryNew")}
        </Button>
      </div>
      {categories.length ? (
        <ul>
          {categories.map((category, index) => (
            <li key={category.id} className="flex flex-wrap items-center gap-3 border-t border-border px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {category.nameAr}
                  <span className="text-muted"> · {category.nameFr}</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {category.slug} · {t("admin.categoryProducts", { count: category.products })}
                </p>
              </div>
              {category.isActive ? <Badge tone="green">{t("admin.categoryActive")}</Badge> : null}
              <Button type="button" variant="ghost" disabled={busy || index === 0} onClick={() => onMove(index, -1)}>
                {t("admin.moveEarlier")}
              </Button>
              <Button type="button" variant="ghost" disabled={busy || index === categories.length - 1} onClick={() => onMove(index, 1)}>
                {t("admin.moveLater")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => onEdit(category)}>
                {t("admin.categoryEdit")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-4 pb-4 text-sm text-muted">{t("admin.emptyCategories")}</p>
      )}
    </section>
  );
}

function StatsPanel({ stats }: { stats: Stats }) {
  const t = useT();
  const rate = (value: number | null, part: number, whole: number) =>
    value == null ? t("admin.rateNone") : t("admin.rateValue", { rate: value, part, whole });
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <StatCard label={t("admin.statRegistered")} value={String(stats.troops)} tone="green" icon={<Tent className="size-5" />} />
        <StatCard label={t("admin.statProductsAll")} value={String(stats.products)} tone="amber" icon={<Package className="size-5" />} />
        <StatCard label={t("admin.statMonthly")} value={String(stats.activeTroops)} tone="blue" icon={<Users className="size-5" />} />
        <StatCard label={t("admin.statSearches")} value={String(stats.searches)} tone="blue" icon={<Search className="size-5" />} />
        <StatCard label={t("admin.statContacts")} value={String(stats.contacts)} tone="green" icon={<CheckCircle2 className="size-5" />} />
        <StatCard label={t("admin.statProblems")} value={String(stats.reports.total)} tone="rose" icon={<Flag className="size-5" />} />
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="rounded-2xl border border-border bg-white p-4">
          <h2 className="text-sm text-muted">{t("admin.statPayment")}</h2>
          <p className="mt-1 text-2xl font-semibold">{rate(stats.paymentRate, stats.paid, stats.billable)}</p>
        </section>
        <section className="rounded-2xl border border-border bg-white p-4">
          <h2 className="text-sm text-muted">{t("admin.statRenewal")}</h2>
          <p className="mt-1 text-2xl font-semibold">{rate(stats.renewalRate, stats.renewed, stats.expiredTroops)}</p>
        </section>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <RankList title={t("admin.statTopCategories")} rows={stats.categories} />
        <RankList title={t("admin.statTopWilayas")} rows={stats.wilayas} />
      </div>
      <p className="text-sm text-muted">
        {t("admin.statOpen", { count: stats.reports.open })}
        {" · "}
        {t("admin.statResolved", { count: stats.reports.resolved })}
        {" · "}
        {t("admin.statDismissed", { count: stats.reports.dismissed })}
      </p>
    </div>
  );
}

function RankList({ title, rows }: { title: string; rows: { name: string; count: number }[] }) {
  const t = useT();
  return (
    <section className="rounded-2xl border border-border bg-white p-4">
      <h2 className="font-semibold">{title}</h2>
      {rows.length ? (
        <ol className="mt-3 space-y-2">
          {rows.map((row) => (
            <li key={row.name} className="flex items-center justify-between gap-3 text-sm">
              <span className="min-w-0 truncate">{row.name}</span>
              <span className="tabular-nums text-muted">{row.count}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-3 text-sm text-muted">{t("admin.rateNone")}</p>
      )}
    </section>
  );
}
