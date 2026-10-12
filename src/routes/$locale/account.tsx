import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate, redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { ProductDialog } from "@/components/products/product-form";
import { AccountPending } from "@/components/layout/route-pending";
import { ErrorPage } from "@/components/layout/status-page";
import { Shell } from "@/components/layout/shell";
import { SubscriptionForm } from "@/components/subscriptions/subscription-form";
import { TroopForm } from "@/components/troops/troop-form";
import { Button, controlClass, Field } from "@/components/shared/controls";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isLocale } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/use-locale";
import { memberEmailSchema } from "@/lib/zad/member";
import {
  addMember,
  cancelJoinRequest,
  claimAdmin,
  decideJoinRequest,
  deleteProduct,
  getCurrentUser,
  getMe,
  getMeta,
  joinTroop,
  listInbox,
  listJoinRequests,
  listMembers,
  listOwnProducts,
  listTroops,
  markNotificationsRead,
  removeMember,
  setProductStatus,
} from "@/lib/zad/api";
import type { Category, Listing, Me, Plan, TroopCard, Wilaya } from "@/lib/zad/types";

export const Route = createFileRoute("/$locale/account")({
  beforeLoad: async ({ params }) => {
    const locale = isLocale(params.locale) ? params.locale : "ar";
    try {
      await getCurrentUser();
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "Unauthorized") {
        throw redirect({ to: "/$locale/login", params: { locale } });
      }
      throw error;
    }
  },
  pendingMs: 0,
  pendingMinMs: 200,
  pendingComponent: AccountPending,
  errorComponent: ErrorPage,
  component: AccountPage,
});

type Member = { id: string; name: string; email: string; role: string };
type InboxItem = { id: string; message: string; createdAt: string; fromName: string; productTitle: string };

function AccountPage() {
  const { locale } = Route.useParams();
  const account = isLocale(locale) ? locale : "ar";
  const { user, isPending } = useCurrentUserState();
  const [me, setMe] = useState<Me | null>(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<"gear" | "members" | "inbox" | "notes">("gear");
  const [products, setProducts] = useState<Listing[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [requests, setRequests] = useState<Member[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [meta, setMeta] = useState<{ categories: Category[]; wilayas: Wilaya[]; plan: Plan | null }>({
    categories: [],
    wilayas: [],
    plan: null,
  });
  const [editing, setEditing] = useState<Listing | null | "new">(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [path, setPath] = useState<"create" | "join" | null>(null);
  const [showRenew, setShowRenew] = useState(false);
  const t = useT();
  const localeCode = useLocale();

  async function refresh() {
    const next = await getMe();
    setMe(next);
    if (!next.troop || next.troop.role !== "troop_manager") {
      setProducts([]);
      setMembers([]);
      setRequests([]);
      setInbox([]);
      return;
    }
      const [gear, people, mail, base, asks] = await Promise.all([
        listOwnProducts(),
        listMembers(),
        listInbox(),
        getMeta({ data: { locale: account } }),
        listJoinRequests(),
      ]);
      setProducts(gear);
      setMembers(people);
      setInbox(mail);
      setMeta(base);
      setRequests(asks.map((ask) => ({ ...ask, role: "member" })));
  }

  useEffect(() => {
    if (!user) return;
    refresh()
      .catch((error) => toast.error(error instanceof Error ? error.message : t("troop.loadFailed")))
      .finally(() => setReady(true));
  }, [user, t]);

  if (isPending || (user && !ready)) {
    return <AccountPending />;
  }
  if (!user) return <Navigate to="/$locale/login" params={{ locale: account }} />;
  if (!me) {
    return (
      <Shell>
        <p>تعذّر تحميل الحساب.</p>
      </Shell>
    );
  }

  const live =
    me.subscription?.status === "active" &&
    !!me.subscription.startsOn &&
    !!me.subscription.endsOn &&
    me.subscription.startsOn <= new Date().toISOString().slice(0, 10) &&
    me.subscription.endsOn >= new Date().toISOString().slice(0, 10);

  const subStatus = !me.subscription
    ? null
    : live
      ? "active"
      : me.subscription.status === "active"
        ? "expired"
        : me.subscription.status;
  const subLabel = subStatus ? t(`sub.status${subStatus[0]?.toUpperCase()}${subStatus.slice(1)}`) : t("troop.noSub");
  const troopLabel = me.troop
    ? t(`troop.status${me.troop.status[0]?.toUpperCase()}${me.troop.status.slice(1)}`)
    : "";
  const amount = me.subscription ? Number(me.subscription.price) : Number.NaN;
  const price = Number.isFinite(amount)
    ? t("sub.price", {
        amount: new Intl.NumberFormat(localeCode === "ar" ? "ar-DZ" : "fr-DZ", {
          maximumFractionDigits: 0,
        }).format(amount),
      })
    : "";
  const role = me.troop
    ? me.troop.role === "troop_manager"
      ? t("troop.roleManager")
      : t("troop.roleMember")
    : t("troop.roleNone");
  const manager = me.troop?.role === "troop_manager";
  const today = new Date().toISOString().slice(0, 10);
  const daysLeft = me.subscription?.endsOn
    ? Math.round((Date.parse(`${me.subscription.endsOn}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400000)
    : null;
  const expired = subStatus === "expired";
  const expiring = live && daysLeft !== null && daysLeft <= 30;
  const showRequest =
    manager && (showRenew || !me.subscription || me.subscription.status === "rejected" || !!me.pendingProof);

  return (
    <Shell>
      <div className="flex items-center gap-3">
        {me.troop?.logo ? (
          <img src={me.troop.logo} alt="" className="size-14 rounded-full object-cover" />
        ) : null}
        <div>
          <h1 className="text-3xl font-semibold">{me.troop ? me.troop.name : t("troop.accountTitle")}</h1>
          <p className="mt-1 text-sm text-muted">
            {me.name} · {role}
          </p>
        </div>
      </div>

      {!me.troop ? (
        path === "create" ? (
          <div className="mt-6">
            <Button type="button" variant="ghost" onClick={() => setPath(null)}>
              {t("troop.back")}
            </Button>
            <TroopForm mode="create" onDone={() => refresh().catch(() => undefined)} />
          </div>
        ) : path === "join" ? (
          <div className="mt-6">
            <Button type="button" variant="ghost" onClick={() => setPath(null)}>
              {t("troop.back")}
            </Button>
            <JoinTroop
              locale={account}
              pendingTroopId={me.joinRequest?.troopId ?? null}
              onDone={() => {
                setPath(null);
                refresh().catch(() => undefined);
              }}
            />
          </div>
        ) : (
          <div className="mt-6">
            {me.joinRequest ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 text-sm">
                <p>{t("troop.joinPending", { troop: me.joinRequest.troopName })}</p>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() =>
                    cancelJoinRequest()
                      .then(() => {
                        toast.success(t("troop.requestCancelled"));
                        refresh().catch(() => undefined);
                      })
                      .catch((error) => toast.error(error instanceof Error ? error.message : t("troop.joinFailed")))
                  }
                >
                  {t("troop.cancelRequest")}
                </Button>
              </div>
            ) : null}
            <p className="text-sm text-muted">{t("troop.chooseLead")}</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                className="rounded-xl border border-border bg-card p-4 text-start"
                onClick={() => setPath("create")}
              >
                <span className="block text-lg font-semibold">{t("troop.chooseCreate")}</span>
                <span className="mt-1 block text-sm text-muted">{t("troop.chooseCreateLead")}</span>
              </button>
              <button
                type="button"
                className="rounded-xl border border-border bg-card p-4 text-start"
                onClick={() => setPath("join")}
              >
                <span className="block text-lg font-semibold">{t("troop.chooseJoin")}</span>
                <span className="mt-1 block text-sm text-muted">{t("troop.chooseJoinLead")}</span>
              </button>
            </div>
          </div>
        )
      ) : (
        <>
          {me.troop.status === "pending" ? (
            <p className="mt-4 rounded-lg border border-border bg-card p-4 text-sm">{t("troop.pendingBanner")}</p>
          ) : null}
          {me.troop.status === "suspended" ? (
            <p className="mt-4 rounded-lg border border-border bg-danger-soft p-4 text-sm text-danger">
              {t("troop.suspendedBanner")}
            </p>
          ) : null}
          <section className="mt-6 rounded-xl border border-border bg-card p-4">
            <h2 className="text-lg font-semibold">{t("troop.statusPanel")}</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat label={t("troop.sub")} value={subLabel} />
              <Stat
                label={t("troop.endsOn")}
                value={me.subscription?.endsOn ?? t("troop.waiting")}
              />
              <Stat
                label={t("troop.members")}
                value={t("troop.usedOf", {
                  used: me.counts.members,
                  limit: me.subscription?.maxMembers ?? "—",
                })}
              />
              <Stat
                label={t("troop.products")}
                value={t("troop.usedOf", {
                  used: me.counts.products,
                  limit: me.subscription?.maxProducts ?? "—",
                })}
              />
            </div>
          </section>
          {me.subscription?.status === "rejected" && me.subscription.adminNote ? (
            <p className="mt-3 rounded-lg border border-danger/30 bg-danger-soft p-4 text-sm text-danger">
              {t("troop.rejectionNote", { note: me.subscription.adminNote })}
            </p>
          ) : null}
          {expiring || expired ? (
            <div
              className={`mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 text-sm ${
                expired ? "border-danger/30 bg-danger-soft text-danger" : "border-warning/40 bg-warning-soft text-fg"
              }`}
            >
              <p>{expired ? t("troop.expiredBanner") : t("troop.expiringBanner", { days: daysLeft ?? 0 })}</p>
              {manager ? (
                <Button
                  type="button"
                  onClick={() => {
                    setShowRenew(true);
                    requestAnimationFrame(() => {
                      document.getElementById("subscription-request")?.scrollIntoView({ block: "nearest" });
                    });
                  }}
                >
                  {t("troop.renew")}
                </Button>
              ) : null}
            </div>
          ) : null}
          <p className="mt-3 text-sm text-muted">
            {t("troop.statusLabel")}: {troopLabel}
            {price ? ` · ${price}` : ""}
            {" · "}
            {me.troop.wilayaName} · {me.troop.commune}
          </p>
          {me.troop.status === "active" ? (
            <Link
              to="/$locale/troops/$id"
              params={{ locale: account, id: me.troop.id }}
              className="mt-2 inline-flex h-11 items-center text-sm font-medium text-accent"
            >
              {t("troop.publicPage")}
            </Link>
          ) : null}
          {manager ? (
            editingProfile ? (
              <TroopForm
                key={me.troop.id}
                mode="edit"
                initial={{
                  name: me.troop.name,
                  wilayaCode: me.troop.wilayaCode,
                  commune: me.troop.commune,
                  about: me.troop.about,
                  phone: me.troop.phone || null,
                  email: me.troop.contactEmail || null,
                  logo: me.troop.logo || null,
                  thumbnail: me.troop.thumbnail || null,
                }}
                onDone={() => {
                  setEditingProfile(false);
                  refresh().catch(() => undefined);
                }}
                onCancel={() => setEditingProfile(false)}
              />
            ) : (
              <Button type="button" variant="ghost" className="mt-3" onClick={() => setEditingProfile(true)}>
                {t("troop.edit")}
              </Button>
            )
          ) : null}
          {!live && !expired ? (
            <div className="mt-4 rounded-lg border border-border bg-danger-soft p-4 text-sm text-danger">
              {t("troop.inactiveSub")}
            </div>
          ) : null}
          {showRequest ? (
            <div id="subscription-request">
              <SubscriptionForm
                plan={meta.plan}
                renew={Boolean(me.subscription)}
                pendingProof={me.pendingProof}
                onDone={() => refresh().catch(() => undefined)}
              />
            </div>
          ) : null}
          {me.canClaimAdmin ? (
            <Button
              type="button"
              variant="ghost"
              className="mt-4"
              onClick={() =>
                claimAdmin()
                  .then(() => {
                    toast.success(t("troop.claimed"));
                    return refresh();
                  })
                  .catch((error) => toast.error(error instanceof Error ? error.message : t("troop.claimFailed")))
              }
            >
              {t("troop.claim")}
            </Button>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-2">
            {(
              [
                ["gear", t("troop.products")],
                ["members", t("troop.members")],
                ["inbox", t("troop.inbox", { count: inbox.length })],
                ["notes", t("troop.notes")],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`h-10 rounded-md px-3 text-sm ${tab === key ? "bg-accent text-accent-fg" : "border border-border bg-card"}`}
                onClick={() => {
                  setTab(key);
                  if (key === "notes") {
                    markNotificationsRead().then(refresh).catch(() => undefined);
                  }
                }}
              >
                {label}
              </button>
            ))}
            {tab === "gear" && live && manager && me.counts.products < (me.subscription?.maxProducts ?? 0) ? (
              <Link
                to="/$locale/account/product"
                params={{ locale: account }}
                className="ms-auto inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
              >
                {t("troop.addProduct")}
              </Link>
            ) : null}
          </div>

          <div className="mt-4">
            {tab === "gear" ? (
              <GearTable
                products={products}
                canWrite={manager}
                live={live}
                used={me.counts.products}
                max={live ? (me.subscription?.maxProducts ?? null) : null}
                onEdit={setEditing}
                onChanged={() => refresh().catch(() => undefined)}
              />
            ) : null}
            {tab === "members" ? (
              <Members
                members={members}
                requests={requests}
                canManage={manager && live}
                selfId={me.userId}
                used={me.counts.members}
                max={live ? (me.subscription?.maxMembers ?? null) : null}
                onChanged={() => refresh().catch(() => undefined)}
              />
            ) : null}
            {tab === "inbox" ? <Inbox items={inbox} /> : null}
            {tab === "notes" ? <Notes items={me.notifications} /> : null}
          </div>
          {editing ? (
            <ProductDialog
              item={editing === "new" ? null : editing}
              categories={meta.categories}
              wilayas={meta.wilayas}
              defaultWilaya={me.troop.wilayaCode}
              onClose={() => setEditing(null)}
              onSaved={() => {
                setEditing(null);
                refresh().catch(() => undefined);
              }}
            />
          ) : null}
        </>
      )}
    </Shell>
  );
}

function JoinTroop({
  locale,
  pendingTroopId,
  onDone,
}: {
  locale: "ar" | "fr";
  pendingTroopId: string | null;
  onDone: () => void;
}) {
  const t = useT();
  const [troops, setTroops] = useState<TroopCard[]>([]);
  const [query, setQuery] = useState("");
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    listTroops({ data: { locale } })
      .then(setTroops)
      .catch(() => toast.error(t("troop.joinFailed")));
  }, [locale, t]);

  const needle = query.trim();
  const shown = troops.filter((troop) =>
    needle ? `${troop.name} ${troop.wilayaName} ${troop.commune}`.includes(needle) : true,
  );

  return (
    <div className="mt-4 space-y-3">
      <h2 className="text-xl font-semibold">{t("troop.chooseJoin")}</h2>
      <p className="text-sm text-muted">{t("troop.chooseJoinLead")}</p>
      <input
        className={controlClass}
        value={query}
        placeholder={t("troop.joinSearch")}
        onChange={(event) => setQuery(event.target.value)}
      />
      {shown.length ? (
        <ul className="space-y-2">
          {shown.map((troop) => (
            <li
              key={troop.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="flex min-w-0 items-center gap-3">
                {troop.logo ? (
                  <img src={troop.logo} alt="" className="size-11 shrink-0 rounded-full object-cover" />
                ) : null}
                <div className="min-w-0">
                  <p className="font-medium">{troop.name}</p>
                  <p className="text-sm text-muted">
                    {troop.wilayaName} · {troop.commune}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                disabled={pending !== null || pendingTroopId !== null}
                onClick={() => {
                  setPending(troop.id);
                  joinTroop({ data: { troopId: troop.id } })
                    .then(() => {
                      toast.success(t("troop.joined"));
                      onDone();
                    })
                    .catch((error) => toast.error(error instanceof Error ? error.message : t("troop.joinFailed")))
                    .finally(() => setPending(null));
                }}
              >
                {pending === troop.id
                  ? t("auth.pending")
                  : pendingTroopId === troop.id
                    ? t("troop.joinWaiting")
                    : t("troop.joinAction")}
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t("troop.joinEmpty")}</p>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {hint ? <p className="text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

function GearTable({
  products,
  canWrite,
  live,
  used,
  max,
  onEdit,
  onChanged,
}: {
  products: Listing[];
  canWrite: boolean;
  live: boolean;
  used: number;
  max: number | null;
  onEdit: (item: Listing) => void;
  onChanged: () => void;
}) {
  const t = useT();
  const locale = useLocale();
  const full = max !== null && used >= max;
  const statusKey = {
    active: "gear.stActive",
    unavailable: "gear.stUnavailable",
  } as const;

  function priceOf(item: Listing) {
    const amount = Number(item.operation === "rent" ? item.rentPrice : item.salePrice);
    const formatted = Number.isFinite(amount)
      ? t("sub.price", {
          amount: new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
            maximumFractionDigits: 0,
          }).format(amount),
        })
      : "—";
    if (item.operation === "sale") return formatted;
    if (item.operation === "rent") return t("gear.rentPriceLabel", { price: formatted });
    if (item.operation === "wanted") return t("gear.opWanted");
    return t("gear.opExchange");
  }

  return (
    <div className="space-y-3">
      {canWrite && max !== null && !full ? (
        <p className="text-sm text-muted">{t("gear.left", { count: max - used, max })}</p>
      ) : null}
      {canWrite && full ? <p className="text-sm text-muted">{t("gear.full", { used, max: max ?? 0 })}</p> : null}
      {canWrite && !live ? <p className="text-sm text-muted">{t("gear.locked")}</p> : null}
      {products.length ? (
        <div className="overflow-x-auto rounded-lg border border-border bg-card">
          <table className="w-full min-w-[36rem] text-sm">
            <thead className="bg-surface text-muted">
              <tr>
                <th className="px-3 py-2 text-start font-medium">{t("gear.colProduct")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("gear.colPrice")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("gear.colStatus")}</th>
                {canWrite ? <th className="px-3 py-2 text-start font-medium">{t("gear.colActions")}</th> : null}
              </tr>
            </thead>
            <tbody>
              {products.map((item) => (
                <tr key={item.id} className="border-t border-border">
                  <td className="px-3 py-2">{item.title}</td>
                  <td className="px-3 py-2 tabular-nums">{priceOf(item)}</td>
                  <td className="px-3 py-2">
                    {item.visibility === "hidden"
                      ? t("gear.stHidden")
                      : t(statusKey[item.status as keyof typeof statusKey] ?? "gear.stUnavailable")}
                  </td>
                  {canWrite ? (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {item.visibility !== "hidden" ? (
                          <Button type="button" variant="ghost" onClick={() => onEdit(item)}>
                            {t("gear.edit")}
                          </Button>
                        ) : null}
                        {item.visibility !== "hidden" ? (
                          <Button
                            type="button"
                            variant="ghost"
                            onClick={() =>
                              setProductStatus({
                                data: {
                                  id: item.id,
                                  status: item.status === "active" ? "unavailable" : "active",
                                },
                              })
                                .then(onChanged)
                                .catch((caught) =>
                                  toast.error(caught instanceof Error ? caught.message : t("gear.statusFailed")),
                                )
                            }
                          >
                            {item.status === "active" ? t("gear.unavailable") : t("gear.available")}
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="danger"
                          onClick={() =>
                            deleteProduct({ data: { id: item.id } })
                              .then(onChanged)
                              .catch((caught) =>
                                toast.error(caught instanceof Error ? caught.message : t("gear.deleteFailed")),
                              )
                          }
                        >
                          {t("gear.delete")}
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted">{t("gear.empty")}</p>
      )}
    </div>
  );
}

function Members({
  members,
  requests,
  canManage,
  selfId,
  used,
  max,
  onChanged,
}: {
  members: Member[];
  requests: Member[];
  canManage: boolean;
  selfId: string;
  used: number;
  max: number | null;
  onChanged: () => void;
}) {
  const t = useT();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const full = max !== null && used >= max;

  return (
    <div className="space-y-4">
      {canManage || requests.length ? (
      <div>
        <h2 className="text-lg font-semibold">{t("members.requests")}</h2>
        {requests.length ? (
          <ul className="mt-2 divide-y divide-border rounded-lg border border-border bg-card">
            {requests.map((request) => (
              <li key={request.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                <span>
                  <span className="font-medium">{request.name}</span>
                  <span className="mt-0.5 block text-muted">{request.email}</span>
                </span>
                <span className="flex gap-2">
                  <Button
                    type="button"
                    disabled={pending || !canManage}
                    onClick={() => {
                      setPending(true);
                      decideJoinRequest({ data: { id: request.id, accept: true } })
                        .then(() => {
                          toast.success(t("members.accepted"));
                          onChanged();
                        })
                        .catch((caught) => toast.error(caught instanceof Error ? caught.message : t("members.addFailed")))
                        .finally(() => setPending(false));
                    }}
                  >
                    {t("members.accept")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      setPending(true);
                      decideJoinRequest({ data: { id: request.id, accept: false } })
                        .then(() => {
                          toast.success(t("members.rejected"));
                          onChanged();
                        })
                        .catch((caught) => toast.error(caught instanceof Error ? caught.message : t("members.removeFailed")))
                        .finally(() => setPending(false));
                    }}
                  >
                    {t("members.reject")}
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted">{t("members.noRequests")}</p>
        )}
      </div>
      ) : null}
      {members.length ? (
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {members.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                <span className="font-medium">{member.name}</span>
                <span className="mt-0.5 block text-muted">{member.email}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="text-muted">
                  {member.role === "troop_manager" ? t("members.manager") : t("members.member")}
                </span>
                {canManage && member.role !== "troop_manager" && member.id !== selfId ? (
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      setPending(true);
                      removeMember({ data: { userId: member.id } })
                        .then(() => {
                          toast.success(t("members.removed"));
                          onChanged();
                        })
                        .catch((caught) =>
                          toast.error(caught instanceof Error ? caught.message : t("members.removeFailed")),
                        )
                        .finally(() => setPending(false));
                    }}
                  >
                    {t("members.remove")}
                  </Button>
                ) : null}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">{t("members.empty")}</p>
      )}
      {canManage && max !== null && !full ? (
        <p className="text-sm text-muted">{t("members.left", { count: max - used, max })}</p>
      ) : null}
      {canManage && full ? <p className="text-sm text-muted">{t("members.full", { used, max: max ?? 0 })}</p> : null}
      {canManage && !full ? (
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault();
            const form = event.currentTarget;
            const parsed = memberEmailSchema.safeParse({
              email: String(new FormData(form).get("email") ?? ""),
            });
            if (!parsed.success) {
              setError("members.errEmail");
              toast.error(t("auth.invalid"));
              return;
            }
            setError(null);
            setPending(true);
            addMember({ data: parsed.data })
              .then(() => {
                toast.success(t("members.added"));
                form.reset();
                onChanged();
              })
              .catch((caught) => toast.error(caught instanceof Error ? caught.message : t("members.addFailed")))
              .finally(() => setPending(false));
          }}
        >
          <Field label={t("members.email")} error={error ? t(error) : undefined}>
            <input className={controlClass} name="email" type="email" required autoComplete="off" />
          </Field>
          <Button type="submit" disabled={pending}>
            {pending ? t("auth.pending") : t("members.add")}
          </Button>
        </form>
      ) : null}
      {!canManage ? <p className="text-sm text-muted">{t("members.locked")}</p> : null}
    </div>
  );
}

function Inbox({ items }: { items: InboxItem[] }) {
  const t = useT();
  if (!items.length) return <p className="text-sm text-muted">{t("dash.inboxEmpty")}</p>;
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <article key={item.id} className="rounded-lg border border-border bg-card p-4">
          <p className="text-sm font-medium">
            {item.fromName} · {item.createdAt}
          </p>
          <p className="text-sm text-muted">{item.productTitle}</p>
          <p className="mt-2">{item.message}</p>
        </article>
      ))}
    </div>
  );
}

function Notes({ items }: { items: Me["notifications"] }) {
  const t = useT();
  if (!items.length) return <p className="text-sm text-muted">{t("dash.notesEmpty")}</p>;
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <article key={item.id} className="rounded-lg border border-border bg-card px-4 py-3 text-sm">
          <p>{item.body}</p>
          <p className="mt-1 text-muted">{item.createdAt}</p>
        </article>
      ))}
    </div>
  );
}

