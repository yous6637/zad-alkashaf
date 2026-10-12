import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, Copy, Flag, MapPin, MessageCircle, Phone, Share2, Tent } from "lucide-react";
import { toast } from "sonner";
import { ProductCard } from "@/components/products/product-card";
import ProductGallery from "@/components/products/product-gallery";
import { ProductPending } from "@/components/layout/route-pending";
import { ErrorPage } from "@/components/layout/status-page";
import { Shell } from "@/components/layout/shell";
import { Button, controlClass, Field, Modal } from "@/components/shared/controls";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isLocale, translate } from "@/lib/i18n";
import { shareMeta } from "@/lib/seo";
import { useT } from "@/lib/use-locale";
import { getListingContact, getProduct, sendReport } from "@/lib/zad/api";
import { reportFieldErrors, reportSchema } from "@/lib/zad/report";
import type { Listing } from "@/lib/zad/types";

const reasons = ["wrong_info", "inappropriate", "duplicate", "other"] as const;
const reasonKey = {
  wrong_info: "product.reasonWrong",
  inappropriate: "product.reasonBad",
  duplicate: "product.reasonDuplicate",
  other: "product.reasonOther",
} as const;

type ContactState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "need_troop" }
  | { status: "gone" }
  | { status: "ok"; phone: string; email: string }
  | { status: "error" };

export const Route = createFileRoute("/$locale/products_/$id")({
  loader: ({ params }) =>
    getProduct({ data: { id: params.id, locale: params.locale === "fr" ? "fr" : "ar" } }),
  head: ({ loaderData, params }) => {
    const locale = params.locale === "fr" ? "fr" : "ar";
    const item = loaderData?.item;
    return shareMeta({
      locale,
      title: item?.title ?? translate(locale, "product.goneTitle"),
      description: item?.description?.trim() || translate(locale, "meta.description"),
      path: `/${locale}/products/${params.id}`,
      origin: loaderData?.origin ?? "",
      type: "product",
    });
  },
  pendingMs: 0,
  pendingMinMs: 200,
  pendingComponent: ProductPending,
  errorComponent: ErrorPage,
  component: ProductPage,
});

function ProductPage() {
  const { locale } = Route.useParams();
  const account = isLocale(locale) ? locale : "ar";
  const t = useT();
  const page = Route.useLoaderData();
  const item = page?.item ?? null;
  const { user, isPending } = useCurrentUserState();
  const [mode, setMode] = useState<"contact" | "report" | null>(null);
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [contact, setContact] = useState<ContactState>({ status: "idle" });

  useEffect(() => {
    if (mode !== "contact" || !user || !item) return;
    let gone = false;
    setContact({ status: "loading" });
    getListingContact({ data: { productId: item.id } })
      .then((result) => {
        if (!gone) setContact(result);
      })
      .catch(() => {
        if (!gone) setContact({ status: "error" });
      });
    return () => {
      gone = true;
    };
  }, [mode, user, item]);

  if (!item) {
    return (
      <Shell>
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <h1 className="text-xl font-semibold">{t("product.goneTitle")}</h1>
          <p className="mt-2 text-sm text-muted">{t("product.goneBody")}</p>
          <Link
            to="/$locale/products"
            params={{ locale: account }}
            className="mt-4 inline-flex h-11 items-center text-sm font-medium text-accent"
          >
            {t("product.back")}
          </Link>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <ProductBody
        item={item}
        logo={page?.logo ?? null}
        commune={page?.commune ?? ""}
        related={page?.related ?? []}
        account={account}
        mode={mode}
        setMode={setMode}
        pending={pending}
        setPending={setPending}
        errors={errors}
        setErrors={setErrors}
        contact={contact}
        isPending={isPending}
        signedIn={Boolean(user)}
      />
    </Shell>
  );
}

function ProductBody({
  item,
  logo,
  commune,
  related,
  account,
  mode,
  setMode,
  pending,
  setPending,
  errors,
  setErrors,
  contact,
  isPending,
  signedIn,
}: {
  item: Listing;
  logo: string | null;
  commune: string;
  related: Listing[];
  account: "ar" | "fr";
  mode: "contact" | "report" | null;
  setMode: (mode: "contact" | "report" | null) => void;
  pending: boolean;
  setPending: (value: boolean) => void;
  errors: Record<string, string>;
  setErrors: (value: Record<string, string>) => void;
  contact: ContactState;
  isPending: boolean;
  signedIn: boolean;
}) {
  const t = useT();
  const operationKey = {
    sale: "gear.opSale",
    rent: "gear.opRent",
    exchange: "gear.opExchange",
    wanted: "gear.opWanted",
  } as const;
  const conditionKey = {
    new: "gear.condNew",
    used_good: "gear.condUsed",
    needs_repair: "gear.condRepair",
  } as const;
  const operation = operationKey[item.operation as keyof typeof operationKey];
  const condition = conditionKey[item.condition as keyof typeof conditionKey];
  const amount = Number(item.operation === "rent" ? item.rentPrice : item.salePrice);
  const formatted = Number.isFinite(amount)
    ? t("sub.price", {
        amount: new Intl.NumberFormat(account === "ar" ? "ar-DZ" : "fr-DZ", {
          maximumFractionDigits: 0,
        }).format(amount),
      })
    : null;
  const price =
    item.operation === "sale"
      ? (formatted ?? "—")
      : item.operation === "rent"
        ? t("gear.rentPriceLabel", { price: formatted ?? "—" })
        : item.operation === "wanted"
          ? t("gear.opWanted")
          : t("gear.opExchange");

  const shortCondition =
    item.condition === "new"
      ? "home.condNew"
      : item.condition === "needs_repair"
        ? "home.condRepair"
        : "home.condUsed";
  const formattedDate = formatPublishDate(item.createdAt, account);

  return (
    <>
      <nav
        className="mb-5 flex flex-wrap items-center gap-2 text-sm text-muted"
        aria-label={account === "ar" ? "مسار التنقل" : "Breadcrumb"}
      >
        <Link
          to="/$locale"
          params={{ locale: account }}
          className="transition-colors hover:text-accent"
        >
          {t("nav.home")}
        </Link>
        <span aria-hidden="true">‹</span>
        <Link
          to="/$locale/products"
          params={{ locale: account }}
          className="transition-colors hover:text-accent"
        >
          {t("nav.products")}
        </Link>
        <span aria-hidden="true">‹</span>
        <span className="max-w-56 truncate font-medium text-fg">{item.title}</span>
      </nav>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)_16rem]">
        <aside className="order-3 space-y-4 lg:order-1">
          <section className="rounded-2xl border border-border bg-card p-5 text-center shadow-sm">
            <div className="mx-auto flex size-20 items-center justify-center overflow-hidden rounded-2xl bg-accent-soft ring-1 ring-accent/10">
              {logo ? (
                <img src={logo} alt="" className="size-full object-cover" />
              ) : (
                <Tent className="size-9 text-accent" aria-hidden="true" />
              )}
            </div>
            <p className="mt-4 text-xs font-semibold text-accent">
              {account === "ar" ? "الفوج الناشر" : "Publié par"}
            </p>
            <h2 className="mt-1 text-lg font-bold">{item.troopName}</h2>
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-muted">
              <MapPin className="size-4 shrink-0 text-accent" aria-hidden="true" />
              <span>
                {item.wilayaName}
                {commune ? ` · ${commune}` : ""}
              </span>
            </p>
            <Link
              to="/$locale/troops/$id"
              params={{ locale: account, id: item.troopId }}
              className="mt-5 inline-flex h-11 w-full items-center justify-center rounded-xl border border-accent/40 font-semibold text-accent transition-colors hover:bg-accent-soft"
            >
              {t("product.viewTroop")}
            </Link>
          </section>
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h3 className="font-bold">
              {account === "ar" ? "معلومات إضافية" : "Informations complémentaires"}
            </h3>
            <dl className="mt-4 space-y-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">{t("gear.condition")}</dt>
                <dd className="text-end font-medium">{t(shortCondition)}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">{account === "ar" ? "نوع العرض" : "Type d’annonce"}</dt>
                <dd className="text-end font-medium">{operation ? t(operation) : "—"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted">{t("product.addedOn")}</dt>
                <dd className="text-end font-medium">{formattedDate}</dd>
              </div>
            </dl>
          </section>
        </aside>

        <div className="order-1 min-w-0 lg:order-2">
          <ProductGallery
            slug={item.categorySlug}
            images={item.images}
            alt={item.title}
            badge={t(shortCondition)}
            rtl={account === "ar"}
            label={
              account === "ar"
                ? { gallery: "معرض الصور", prev: "الصورة السابقة", next: "الصورة التالية" }
                : { gallery: "Galerie d’images", prev: "Image précédente", next: "Image suivante" }
            }
          />
        </div>

        <div className="order-1 min-w-0 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6 lg:order-2 lg:bg-transparent lg:border-0 lg:p-0 lg:shadow-none">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-medium text-muted">{item.categoryName}</span>
            <span className="rounded-full bg-accent-soft px-3 py-1 text-xs font-semibold text-accent">
              {t(shortCondition)}
            </span>
            {operation ? (
              <span className="rounded-full bg-sand-soft px-3 py-1 text-xs font-semibold text-fg">
                {t(operation)}
              </span>
            ) : null}
          </div>
          <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">{item.title}</h1>
          <p className="mt-5 text-3xl font-extrabold tracking-tight text-accent sm:text-4xl">
            {price}
          </p>
          <div className="mt-4 flex items-center gap-2 text-sm text-muted">
            <MapPin className="size-4 text-accent" aria-hidden="true" />
            <span>{item.wilayaName}</span>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 rounded-xl bg-surface p-3 text-center">
            <div className="px-1">
              <Tent className="mx-auto size-5 text-accent" aria-hidden="true" />
              <span className="mt-2 block text-xs font-medium">
                {account === "ar" ? "معدات كشفية" : "Équipement scout"}
              </span>
            </div>
            <div className="border-x border-border px-1">
              <MapPin className="mx-auto size-5 text-accent" aria-hidden="true" />
              <span className="mt-2 block text-xs font-medium">{item.wilayaName}</span>
            </div>
            <div className="px-1">
              <Calendar className="mx-auto size-5 text-accent" aria-hidden="true" />
              <span className="mt-2 block text-xs font-medium">{formattedDate}</span>
              <span className="mt-1 block text-[11px] text-muted">{t("product.addedOn")}</span>
            </div>
          </div>
          <p className="mt-5 line-clamp-4 leading-7 text-muted">{item.description}</p>
          <Button
            type="button"
            className="mt-6 h-12 w-full gap-2 rounded-xl text-base font-bold shadow-sm"
            onClick={() => setMode("contact")}
          >
            <MessageCircle className="size-5" aria-hidden="true" />
            {t("product.contact")}
          </Button>
          <p className="mt-2 text-center text-xs text-muted">{t("product.noPay")}</p>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-sm">
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-muted transition-colors hover:bg-danger-soft hover:text-danger"
              onClick={() => setMode("report")}
            >
              <Flag className="size-4" aria-hidden="true" />
              {t("product.report")}
            </button>
            <button
              type="button"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-lg px-2 text-muted transition-colors hover:bg-accent-soft hover:text-accent"
              onClick={() => {
                const url = window.location.href;
                const write = navigator.clipboard?.writeText(url);
                if (!write) return;
                write.then(() => toast.success(t("product.copied"))).catch(() => undefined);
              }}
            >
              <Share2 className="size-4" aria-hidden="true" />
              {t("product.share")}
            </button>
          </div>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
        <div className="flex items-center gap-3 border-b border-border pb-4">
          <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-accent">
            <Tent className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-lg font-bold">{t("product.describe")}</h2>
            <p className="mt-0.5 text-sm text-muted">
              {account === "ar"
                ? "تفاصيل ومعلومات عن المنتج"
                : "Détails et informations sur le produit"}
            </p>
          </div>
        </div>
        <p className="mt-5 whitespace-pre-wrap leading-8 text-muted">{item.description}</p>
        {condition ? (
          <p className="mt-4 inline-flex rounded-lg bg-surface px-3 py-2 text-sm font-medium text-muted">
            {t(condition)}
          </p>
        ) : null}
      </section>
      {related.length ? (
        <section className="mt-9 pb-3">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-accent">
                {account === "ar" ? "اكتشف المزيد" : "À découvrir"}
              </p>
              <h2 className="mt-1 text-xl font-bold sm:text-2xl">{t("product.related")}</h2>
            </div>
            <Link
              to="/$locale/products"
              params={{ locale: account }}
              className="inline-flex min-h-10 items-center text-sm font-semibold text-accent hover:underline"
            >
              {t("nav.products")} ←
            </Link>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((relatedItem) => (
              <ProductCard key={relatedItem.id} item={relatedItem} />
            ))}
          </div>
        </section>
      ) : null}
      <Modal
        open={mode !== null}
        onOpenChange={(open) => {
          if (!open) setMode(null);
        }}
        title={t(mode === "report" ? "product.reportTitle" : "product.contactTitle")}
      >
        {isPending ? (
          <div className="h-16 animate-pulse rounded-md bg-surface" />
        ) : !signedIn ? (
          <div className="space-y-3">
            <p className="text-sm text-muted">{t("product.signIn")}</p>
            <div className="flex flex-wrap gap-2">
              <Link
                to="/$locale/login"
                params={{ locale: account }}
                className="inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
              >
                {t("product.login")}
              </Link>
              <Link
                to="/$locale/register"
                params={{ locale: account }}
                className="inline-flex h-11 items-center rounded-lg border border-border bg-card px-4 text-sm font-medium"
              >
                {t("product.registerTroop")}
              </Link>
            </div>
          </div>
        ) : mode === "contact" ? (
          <ContactDetails contact={contact} locale={account} />
        ) : (
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              const fd = new FormData(event.currentTarget);
              const parsed = reportSchema.safeParse({
                productId: item.id,
                reason: String(fd.get("reason") ?? ""),
                note: String(fd.get("note") ?? ""),
              });
              if (!parsed.success) {
                setErrors(reportFieldErrors(parsed.error));
                toast.error(t("auth.invalid"));
                return;
              }
              setErrors({});
              setPending(true);
              sendReport({ data: parsed.data })
                .then(() => {
                  toast.success(t("product.reported"));
                  setMode(null);
                })
                .catch((caught) =>
                  toast.error(caught instanceof Error ? caught.message : t("product.sendFailed")),
                )
                .finally(() => setPending(false));
            }}
          >
            <Field label={t("product.reason")} error={errors.reason ? t(errors.reason) : undefined}>
              <select className={controlClass} name="reason" defaultValue="wrong_info">
                {reasons.map((id) => (
                  <option key={id} value={id}>
                    {t(reasonKey[id])}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t("product.note")} error={errors.note ? t(errors.note) : undefined}>
              <textarea className={`${controlClass} h-28 py-2`} name="note" maxLength={400} />
            </Field>
            <Button type="submit" disabled={pending}>
              {pending ? t("product.sending") : t("product.send")}
            </Button>
          </form>
        )}
      </Modal>
    </>
  );
}

function ContactDetails({ contact, locale }: { contact: ContactState; locale: "ar" | "fr" }) {
  const t = useT();
  if (contact.status === "idle" || contact.status === "loading") {
    return <div className="h-16 animate-pulse rounded-md bg-surface" />;
  }
  if (contact.status === "need_troop") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-muted">{t("product.needTroop")}</p>
        <Link
          to="/$locale/account"
          params={{ locale }}
          className="inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
        >
          {t("product.openAccount")}
        </Link>
      </div>
    );
  }
  if (contact.status === "gone")
    return <p className="text-sm text-muted">{t("product.goneBody")}</p>;
  if (contact.status === "error")
    return <p className="text-sm text-muted">{t("product.sendFailed")}</p>;
  if (!contact.phone && !contact.email)
    return <p className="text-sm text-muted">{t("product.noContact")}</p>;
  const phone = /^[0-9+\s()-]{6,20}$/.test(contact.phone) ? contact.phone : "";
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) ? contact.email : "";
  if (!phone && !email) return <p className="text-sm text-muted">{t("product.noContact")}</p>;
  const whatsapp = phone ? whatsAppNumber(phone) : "";
  return (
    <div className="space-y-3 text-sm">
      <p className="text-muted">{t("product.contactReady")}</p>
      {phone ? (
        <p>
          <span className="text-muted">{t("product.phone")}</span>
          <span dir="ltr" className="ms-2 font-medium">
            {phone}
          </span>
        </p>
      ) : null}
      {email ? (
        <p>
          <span className="text-muted">{t("product.email")}</span>
          <a href={`mailto:${email}`} className="ms-2 inline-flex min-h-11 items-center font-medium text-accent">
            {email}
          </a>
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            const value = phone || email;
            const write = navigator.clipboard?.writeText(value);
            if (!write) return;
            write.then(() => toast.success(t(phone ? "product.copiedPhone" : "product.copied"))).catch(() => undefined);
          }}
        >
          <Copy className="size-4" aria-hidden="true" />
          {t(phone ? "product.copyPhone" : "product.copyEmail")}
        </Button>
        {phone ? (
          <a
            href={`tel:${phone}`}
            className="inline-flex h-11 items-center gap-2 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg"
          >
            <Phone className="size-4" aria-hidden="true" />
            {t("product.call")}
          </a>
        ) : null}
        {whatsapp ? (
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-card px-4 text-sm font-medium"
          >
            <MessageCircle className="size-4" aria-hidden="true" />
            {t("product.whatsapp")}
          </a>
        ) : null}
      </div>
    </div>
  );
}

function formatPublishDate(value: string, locale: "ar" | "fr") {
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(date);
}

function whatsAppNumber(phone: string) {
  let digits = phone.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `213${digits.slice(1)}`;
  return /^[1-9]\d{7,14}$/.test(digits) ? digits : "";
}
