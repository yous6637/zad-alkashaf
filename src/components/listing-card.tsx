import { Link } from "@tanstack/react-router";
import { CategoryMark } from "@/components/marks";
import { useLocale, useT } from "@/lib/use-locale";
import type { Listing } from "@/lib/zad/types";

const operationKey = {
  sale: "gear.opSale",
  rent: "gear.opRent",
  exchange: "gear.opExchange",
  wanted: "gear.opWanted",
} as const;

export function ListingCard({ item }: { item: Listing }) {
  const locale = useLocale();
  const t = useT();
  const amount = Number(item.operation === "rent" ? item.rentPrice : item.salePrice);
  const formatted = Number.isFinite(amount)
    ? t("sub.price", {
        amount: new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
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
  const operation = operationKey[item.operation as keyof typeof operationKey];

  return (
    <Link
      to="/$locale/products/$id"
      params={{ locale, id: item.id }}
      className="overflow-hidden rounded-xl border border-border bg-card"
    >
      <div className="grid h-32 place-items-center bg-accent-soft text-accent">
        <CategoryMark id={item.categoryId} className="size-10" />
      </div>
      <div className="space-y-2 p-4">
        <div className="flex flex-wrap gap-2 text-xs font-medium text-accent">
          <span className="rounded-sm bg-accent-soft px-2 py-1">{operation ? t(operation) : item.operation}</span>
          <span className="rounded-sm bg-surface px-2 py-1 text-muted">{item.categoryName}</span>
        </div>
        <h3 className="text-base font-semibold">{item.title}</h3>
        <p className="text-sm font-medium tabular-nums text-accent">{price}</p>
        <p className="text-sm text-muted">
          {item.troopName} · {item.wilayaName}
        </p>
      </div>
    </Link>
  );
}
