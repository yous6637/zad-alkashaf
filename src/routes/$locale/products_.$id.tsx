import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { toast } from "sonner";
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
  const item = Route.useLoaderData();
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

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="overflow-hidden rounded-2xl ring-1 ring-border">
          <ProductVisual slug={item.categorySlug} className="min-h-72 w-full" />
        </div>
        <div>
          <p className="text-sm text-muted">{item.createdAt}</p>
          <h1 className="mt-1 text-3xl font-semibold">{item.title}</h1>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-medium">
            <span className="rounded-sm bg-accent-soft px-2 py-1 text-accent">
              {operation ? t(operation) : item.operation}
            </span>
            <span className="rounded-sm bg-surface px-2 py-1">{condition ? t(condition) : item.condition}</span>
            <span className="rounded-sm bg-surface px-2 py-1">{item.wilayaName}</span>
          </div>
          <p className="mt-4 text-2xl font-semibold tabular-nums">{price}</p>
          <p className="mt-4 text-muted">{item.description}</p>
          <div className="mt-5 rounded-lg border border-border bg-card p-4">
            <h2 className="font-semibold">{item.troopName}</h2>
            <Link
              to="/$locale/troops/$id"
              params={{ locale: account, id: item.troopId }}
              className="mt-1 inline-flex h-11 items-center text-sm text-accent"
            >
              {t("product.troop")}
            </Link>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" onClick={() => setMode("contact")}>
                {t("product.contact")}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setMode("report")}>
                {t("product.report")}
              </Button>
            </div>
            <p className="mt-3 text-sm text-muted">{t("product.noPay")}</p>
          </div>
        </div>
      </div>
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
