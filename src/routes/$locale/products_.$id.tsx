import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Calendar, Flag, MapPin, MessageCircle, Share2, Tent } from "lucide-react";
import { toast } from "sonner";
import { ProductCard } from "@/components/products/product-card";
import { ProductVisual } from "@/components/products/product-visual";
import { Shell } from "@/components/layout/shell";
import { Button, controlClass, Field, Modal } from "@/components/shared/controls";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { isLocale } from "@/lib/i18n";
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
    item.condition === "new" ? "home.condNew" : item.condition === "needs_repair" ? "home.condRepair" : "home.condUsed";

  return (
    <>
      <nav className="mb-4 flex flex-wrap items-center gap-2 text-sm text-muted">
        <Link to="/$locale" params={{ locale: account }} className="hover:text-accent">
          {t("nav.home")}
        </Link>
        <span aria-hidden="true">/</span>
        <Link to="/$locale/products" params={{ locale: account }} className="hover:text-accent">
          {t("nav.products")}
        </Link>
        <span aria-hidden="true">/</span>
        <span className="text-fg">{item.title}</span>
      </nav>
      <div className="grid items-start gap-6 lg:grid-cols-[17rem_minmax(0,1fr)_minmax(0,1.05fr)]">
        <aside className="order-3 space-y-4 lg:order-1">
          <div className="rounded-2xl border border-border bg-card p-4 text-center">
            {logo ? (
              <img src={logo} alt="" className="mx-auto size-20 rounded-full object-cover" />
            ) : (
              <span className="mx-auto flex size-20 items-center justify-center rounded-full bg-accent-soft text-accent">
                <Tent className="size-8" aria-hidden="true" />
              </span>
            )}
            <h2 className="mt-3 text-lg font-semibold">{item.troopName}</h2>
            <p className="mt-1 flex items-center justify-center gap-1 text-sm text-muted">
              <MapPin className="size-4" aria-hidden="true" />
              {item.wilayaName}
              {commune ? ` · ${commune}` : ""}
            </p>
            <Link
              to="/$locale/troops/$id"
              params={{ locale: account, id: item.troopId }}
              className="mt-4 inline-flex h-11 w-full items-center justify-center rounded-xl border border-accent text-sm font-medium text-accent"
            >
              {t("product.viewTroop")}
            </Link>
          </div>
          <div className="space-y-3 rounded-2xl border border-border bg-card p-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted">{t("gear.condition")}</span>
              <span>{t(shortCondition)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-1 text-muted">
                <Calendar className="size-4" aria-hidden="true" />
                {t("product.addedOn")}
              </span>
              <span>{item.createdAt}</span>
            </div>
          </div>
        </aside>
        <div className="order-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
            <span>{item.categoryName}</span>
            <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">
              {t(shortCondition)}
            </span>
            {operation ? (
              <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-medium">
                {t(operation)}
              </span>
            ) : null}
          </div>
          <h1 className="mt-2 text-3xl font-semibold">{item.title}</h1>
          <p className="mt-4 text-3xl font-bold tabular-nums text-accent">{price}</p>
          <p className="mt-3 flex items-center gap-1 text-sm text-muted">
            <MapPin className="size-4" aria-hidden="true" />
            {item.wilayaName}
          </p>
          <p className="mt-1 text-sm text-muted">{item.troopName}</p>
          <p className="mt-4 line-clamp-3 text-muted">{item.description}</p>
          <Button type="button" className="mt-5 h-12 w-full gap-2" onClick={() => setMode("contact")}>
            <MessageCircle className="size-4" aria-hidden="true" />
            {t("product.contact")}
          </Button>
          <p className="mt-2 text-center text-xs text-muted">{t("product.noPay")}</p>
          <div className="mt-4 flex flex-wrap gap-4 text-sm">
            <button
              type="button"
              className="inline-flex h-11 items-center gap-1 text-muted"
              onClick={() => setMode("report")}
            >
              <Flag className="size-4" aria-hidden="true" />
              {t("product.report")}
            </button>
            <button
              type="button"
              className="inline-flex h-11 items-center gap-1 text-muted"
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
        <div className="order-1 overflow-hidden rounded-2xl bg-card ring-1 ring-border lg:order-3">
          <div className="relative">
            <ProductVisual slug={item.categorySlug} className="min-h-80 w-full" />
            <span className="absolute top-3 start-3 rounded-full bg-accent px-3 py-1 text-xs font-medium text-white">
              {t(shortCondition)}
            </span>
          </div>
        </div>
      </div>
      <section className="mt-8 rounded-2xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold">{t("product.describe")}</h2>
        <p className="mt-3 whitespace-pre-wrap leading-7 text-muted">{item.description}</p>
        {condition ? <p className="mt-3 text-sm text-muted">{t(condition)}</p> : null}
      </section>
      {related.length ? (
        <section className="mt-8">
          <h2 className="text-lg font-semibold">{t("product.related")}</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <Link
              to="/$locale/login"
              params={{ locale: account }}
              className="inline-flex h-11 items-center text-sm font-medium text-accent"
            >
              {t("product.login")}
            </Link>
          </div>
        ) : mode === "contact" ? (
          <ContactDetails contact={contact} />
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
                .catch((caught) => toast.error(caught instanceof Error ? caught.message : t("product.sendFailed")))
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

function ContactDetails({ contact }: { contact: ContactState }) {
  const t = useT();
  if (contact.status === "idle" || contact.status === "loading") {
    return <div className="h-16 animate-pulse rounded-md bg-surface" />;
  }
  if (contact.status === "need_troop") return <p className="text-sm text-muted">{t("product.needTroop")}</p>;
  if (contact.status === "gone") return <p className="text-sm text-muted">{t("product.goneBody")}</p>;
  if (contact.status === "error") return <p className="text-sm text-muted">{t("product.sendFailed")}</p>;
  if (!contact.phone && !contact.email) return <p className="text-sm text-muted">{t("product.noContact")}</p>;
  const phone = /^[0-9+\s()-]{6,20}$/.test(contact.phone) ? contact.phone : "";
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email) ? contact.email : "";
  if (!phone && !email) return <p className="text-sm text-muted">{t("product.noContact")}</p>;
  return (
    <div className="space-y-3 text-sm">
      {phone ? (
        <p>
          <span className="text-muted">{t("product.phone")}</span>
          <a href={`tel:${phone}`} dir="ltr" className="ms-2 inline-flex h-11 items-center font-medium text-accent">
            {phone}
          </a>
        </p>
      ) : null}
      {email ? (
        <p>
          <span className="text-muted">{t("product.email")}</span>
          <a href={`mailto:${email}`} className="ms-2 inline-flex h-11 items-center font-medium text-accent">
            {email}
          </a>
        </p>
      ) : null}
    </div>
  );
}
