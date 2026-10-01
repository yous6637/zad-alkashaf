import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate, redirect } from "@tanstack/react-router";
import { toast } from "sonner";
import { ProductDialog } from "@/components/product-form";
import { Shell } from "@/components/shell";
import { SubscriptionForm } from "@/components/subscription-form";
import { TroopForm } from "@/components/troop-form";
import { Button, controlClass, Field } from "@/components/ui";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isLocale } from "@/lib/i18n";
import { useLocale, useT } from "@/lib/use-locale";
import { memberEmailSchema } from "@/lib/zad/member";
import {
  addMember,
  claimAdmin,
  deleteProduct,
  getCurrentUser,
  getMe,
  getMeta,
  listInbox,
  listMembers,
  listOwnProducts,
  markNotificationsRead,
  removeMember,
  setProductStatus,
} from "@/lib/zad/api";
import type { Category, Listing, Me, Plan, Wilaya } from "@/lib/zad/types";

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
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [meta, setMeta] = useState<{ categories: Category[]; wilayas: Wilaya[]; plan: Plan | null }>({
    categories: [],
    wilayas: [],
    plan: null,
  });
  const [editing, setEditing] = useState<Listing | null | "new">(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const t = useT();
  const localeCode = useLocale();

  async function refresh() {
    const next = await getMe();
    setMe(next);
    if (next.troop) {
      const [gear, people, mail, base] = await Promise.all([
        listOwnProducts(),
        listMembers(),
        listInbox(),
        getMeta({ data: { locale: account } }),
      ]);
      setProducts(gear);
      setMembers(people);
      setInbox(mail);
      setMeta(base);
    }
  }

  useEffect(() => {
    if (!user) return;
    refresh()
      .catch((error) => toast.error(error instanceof Error ? error.message : t("troop.loadFailed")))
      .finally(() => setReady(true));
  }, [user, t]);

  if (isPending || (user && !ready)) {
    return (
      <Shell>
        <div className="h-48 animate-pulse rounded-xl bg-surface" />
      </Shell>
    );
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

  return (
    <Shell>
      <h1 className="text-3xl font-semibold">{me.troop ? me.troop.name : t("troop.accountTitle")}</h1>
      <p className="mt-1 text-sm text-muted">
        {me.name} · {role}
      </p>

      {!me.troop ? (
        <TroopForm mode="create" onDone={() => refresh().catch(() => undefined)} />
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
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Stat
              label={t("troop.sub")}
              value={subLabel}
              hint={me.subscription?.endsOn ? t("troop.until", { date: me.subscription.endsOn }) : t("troop.waiting")}
            />
            <Stat
              label={t("troop.members")}
              value={`${me.counts.members} / ${me.subscription?.maxMembers ?? "—"}`}
            />
            <Stat
              label={t("troop.products")}
              value={`${me.counts.products} / ${me.subscription?.maxProducts ?? "—"}`}
            />
          </div>
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
          {!live ? (
            <div className="mt-4 rounded-lg border border-border bg-danger-soft p-4 text-sm text-danger">
              {t("troop.inactiveSub")}
            </div>
          ) : null}
          {manager ? (
            <SubscriptionForm
              plan={meta.plan}
              renew={live}
              pendingProof={me.pendingProof}
              onDone={() => refresh().catch(() => undefined)}
            />
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
              <Button type="button" className="ms-auto" onClick={() => setEditing("new")}>
                {t("troop.addProduct")}
              </Button>
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
    hidden: "gear.stHidden",
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
                  <td className="px-3 py-2">{t(statusKey[item.status as keyof typeof statusKey] ?? "gear.stHidden")}</td>
                  {canWrite ? (
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-2">
                        {item.status !== "hidden" ? (
                          <Button type="button" variant="ghost" onClick={() => onEdit(item)}>
                            {t("gear.edit")}
                          </Button>
                        ) : null}
                        {item.status !== "hidden" ? (
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
  canManage,
  selfId,
  used,
  max,
  onChanged,
}: {
  members: Member[];
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

