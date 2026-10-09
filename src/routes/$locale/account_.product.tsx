import { useEffect, useState } from "react";
import { createFileRoute, Link, Navigate, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ProductForm } from "@/components/products/product-form";
import { Shell } from "@/components/layout/shell";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isLocale } from "@/lib/i18n";
import { useT } from "@/lib/use-locale";
import { getMe, getMeta } from "@/lib/zad/api";
import type { Category, Me, Plan, Wilaya } from "@/lib/zad/types";

export const Route = createFileRoute("/$locale/account_/product")({
  component: AddProductPage,
});

function AddProductPage() {
  const { locale } = Route.useParams();
  const account = isLocale(locale) ? locale : "ar";
  const { user, isPending } = useCurrentUserState();
  const navigate = useNavigate();
  const t = useT();
  const [me, setMe] = useState<Me | null>(null);
  const [meta, setMeta] = useState<{ categories: Category[]; wilayas: Wilaya[]; plan: Plan | null } | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancel = false;
    Promise.all([getMe(), getMeta({ data: { locale: account } })])
      .then(([next, base]) => {
        if (cancel) return;
        setMe(next);
        setMeta(base);
      })
      .catch((error) => {
        if (!cancel) toast.error(error instanceof Error ? error.message : t("troop.loadFailed"));
      })
      .finally(() => {
        if (!cancel) setLoaded(true);
      });
    return () => {
      cancel = true;
    };
  }, [user?.id, account, t]);

  if (isPending || (user && !loaded)) {
    return (
      <Shell>
        <div className="h-48 animate-pulse rounded-xl bg-surface" />
      </Shell>
    );
  }
  if (!user) return <Navigate to="/$locale/login" params={{ locale: account }} />;

  const troop = me?.troop;
  const manager = troop?.role === "troop_manager";
  if (!troop || !manager || !meta) {
    return (
      <Shell>
        <Link to="/$locale/account" params={{ locale: account }} className="text-sm font-medium text-accent">
          {t("troop.back")}
        </Link>
        <p className="mt-4 text-sm text-muted">{t("gear.managerOnly")}</p>
      </Shell>
    );
  }

  const today = new Date().toISOString().slice(0, 10);
  const live =
    me.subscription?.status === "active" &&
    !!me.subscription.startsOn &&
    !!me.subscription.endsOn &&
    me.subscription.startsOn <= today &&
    me.subscription.endsOn >= today;
  const max = me.subscription?.maxProducts ?? 0;
  const canAdd = live && me.counts.products < max;

  return (
    <Shell>
      <Link to="/$locale/account" params={{ locale: account }} className="text-sm font-medium text-accent">
        {t("troop.back")}
      </Link>
      <h1 className="mt-3 text-3xl font-semibold">{t("gear.newTitle")}</h1>
      <p className="mt-1 text-sm text-muted">{t("gear.pageLead")}</p>
      {canAdd ? (
        <div className="mt-6 rounded-xl border border-border bg-card p-4">
          <ProductForm
            item={null}
            categories={meta.categories}
            wilayas={meta.wilayas}
            defaultWilaya={troop.wilayaCode}
            onSaved={() => {
              void navigate({ to: "/$locale/account", params: { locale: account } });
            }}
          />
        </div>
      ) : (
        <p className="mt-6 text-sm text-muted">
          {live ? t("gear.full", { used: me.counts.products, max }) : t("gear.locked")}
        </p>
      )}
    </Shell>
  );
}
