import { Link } from "@tanstack/react-router";
import { MapPin, Users } from "lucide-react";
import { ProductVisual } from "@/components/products/product-visual";
import { formatListingPrice, listingConditionKey } from "@/lib/zad/listing-price";
import { useLocale, useT } from "@/lib/use-locale";
import type { Listing } from "@/lib/zad/types";

export function ProductCard({ item }: { item: Listing }) {
  const locale = useLocale();
  const t = useT();
  const price = formatListingPrice(item, locale, t);
  const condition = t(listingConditionKey(item.condition));
  const badge = item.condition === "new" ? "bg-forest" : "bg-accent";

  return (
    <Link
      to="/$locale/products/$id"
      params={{ locale, id: item.id }}
      className="group overflow-hidden rounded-2xl bg-card shadow-[0_8px_24px_rgba(18,56,44,0.06)] ring-1 ring-border transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(18,56,44,0.1)]"
    >
      <div className="relative">
        <ProductVisual slug={item.categorySlug} className="h-40 w-full" />
        <span className={`absolute top-3 start-3 rounded-full px-2.5 py-1 text-xs font-medium text-white ${badge}`}>
          {condition}
        </span>
      </div>
      <div className="space-y-1.5 p-3">
        <h3 className="line-clamp-2 font-semibold leading-snug">{item.title}</h3>
        <p className="font-semibold tabular-nums text-accent">{price}</p>
        <p className="flex items-center gap-1 text-xs text-muted">
          <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{item.wilayaName}</span>
        </p>
        <p className="flex items-center gap-1 text-xs text-muted">
          <Users className="size-3.5 shrink-0" aria-hidden="true" />
          <span className="truncate">{item.troopName}</span>
        </p>
      </div>
    </Link>
  );
}
