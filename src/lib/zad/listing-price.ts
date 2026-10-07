import type { Locale } from "@/lib/i18n";
import type { Listing } from "@/lib/zad/types";

export function formatListingPrice(
  item: Pick<Listing, "operation" | "salePrice" | "rentPrice">,
  locale: Locale,
  t: (key: string, vars?: Record<string, string | number>) => string,
) {
  const amount = Number(item.operation === "rent" ? item.rentPrice : item.salePrice);
  const formatted = Number.isFinite(amount)
    ? t("sub.price", {
        amount: new Intl.NumberFormat(locale === "ar" ? "ar-DZ" : "fr-DZ", {
          maximumFractionDigits: 0,
        }).format(amount),
      })
    : null;
  if (item.operation === "sale") return formatted ?? "—";
  if (item.operation === "rent") return t("gear.rentPriceLabel", { price: formatted ?? "—" });
  if (item.operation === "wanted") return t("gear.opWanted");
  return t("gear.opExchange");
}

export function listingConditionKey(condition: string) {
  if (condition === "new") return "home.condNew";
  if (condition === "needs_repair") return "home.condRepair";
  return "home.condUsed";
}
