import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { z } from "zod";
import { ListingCard } from "@/components/listing-card";
import { Shell } from "@/components/shell";
import { Button, controlClass, Field } from "@/components/ui";
import { useT } from "@/lib/use-locale";
import { getMeta, listProducts } from "@/lib/zad/api";
import type { CatalogQuery } from "@/lib/zad/types";

const operations = ["sale", "rent", "exchange", "wanted"] as const;
const conditions = ["new", "used_good", "needs_repair"] as const;

function num(value: unknown) {
  const n = typeof value === "number" ? value : typeof value === "string" && value ? Number(value) : Number.NaN;
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]) {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : "";
}

export const Route = createFileRoute("/$locale/products")({
  validateSearch: (search: Record<string, unknown>): CatalogQuery => {
    const wilaya = num(search.wilayaCode);
    const category = z.string().uuid().safeParse(search.categoryId);
    return {
      q: typeof search.q === "string" ? search.q.slice(0, 80) : "",
      categoryId: category.success ? category.data : "",
      wilayaCode: wilaya !== undefined && wilaya >= 1 && wilaya <= 58 ? wilaya : undefined,
      operation: oneOf(search.operation, operations),
      condition: oneOf(search.condition, conditions),
      maxPrice: num(search.maxPrice),
    };
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, params }) => {
    const locale = params.locale === "fr" ? "fr" : "ar";
    const [meta, listings] = await Promise.all([
      getMeta({ data: { locale } }),
      listProducts({ data: { ...deps, locale } }),
    ]);
    return { meta, listings };
  },
  component: ProductsPage,
});

function ProductsPage() {
  const t = useT();
  const { meta, listings } = Route.useLoaderData();
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/$locale/products" });
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

  function apply(form: HTMLFormElement) {
    const fd = new FormData(form);
    const wilaya = String(fd.get("wilayaCode") ?? "");
    const maxPrice = String(fd.get("maxPrice") ?? "");
    const price = num(maxPrice);
    navigate({
      search: {
        q: String(fd.get("q") ?? "").slice(0, 80),
        categoryId: String(fd.get("categoryId") ?? ""),
        wilayaCode: wilaya ? Number(wilaya) : undefined,
        operation: String(fd.get("operation") ?? ""),
        condition: String(fd.get("condition") ?? ""),
        maxPrice: price,
      },
    });
  }

  return (
    <Shell>
      <h1 className="text-3xl font-semibold">{t("catalog.title")}</h1>
      <p className="mt-2 text-muted">{t("catalog.lead")}</p>
      <form
        key={`${search.q}-${search.categoryId}-${search.wilayaCode}-${search.operation}-${search.condition}-${search.maxPrice}`}
        className="mt-4 grid gap-3 md:grid-cols-2 lg:grid-cols-3"
        onSubmit={(event) => {
          event.preventDefault();
          apply(event.currentTarget);
        }}
      >
        <Field label={t("catalog.q")}>
          <input className={controlClass} name="q" defaultValue={search.q ?? ""} placeholder={t("catalog.qHint")} />
        </Field>
        <Field label={t("catalog.category")}>
          <select className={controlClass} name="categoryId" defaultValue={search.categoryId ?? ""}>
            <option value="">{t("catalog.all")}</option>
            {meta.categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("catalog.wilaya")}>
          <select className={controlClass} name="wilayaCode" defaultValue={search.wilayaCode ?? ""}>
            <option value="">{t("catalog.all")}</option>
            {meta.wilayas.map((wilaya) => (
              <option key={wilaya.code} value={wilaya.code}>
                {wilaya.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("catalog.operation")}>
          <select className={controlClass} name="operation" defaultValue={search.operation ?? ""}>
            <option value="">{t("catalog.all")}</option>
            {operations.map((id) => (
              <option key={id} value={id}>
                {t(operationKey[id])}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("catalog.condition")}>
          <select className={controlClass} name="condition" defaultValue={search.condition ?? ""}>
            <option value="">{t("catalog.all")}</option>
            {conditions.map((id) => (
              <option key={id} value={id}>
                {t(conditionKey[id])}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("catalog.maxPrice")}>
          <input className={controlClass} name="maxPrice" type="number" min={0} defaultValue={search.maxPrice ?? ""} />
        </Field>
        <p className="text-sm text-muted md:col-span-2 lg:col-span-3">{t("catalog.priceHint")}</p>
        <div className="flex flex-wrap gap-2 md:col-span-2 lg:col-span-3">
          <Button type="submit">{t("catalog.search")}</Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() =>
              navigate({
                search: {
                  q: "",
                  categoryId: "",
                  wilayaCode: undefined,
                  operation: "",
                  condition: "",
                  maxPrice: undefined,
                },
              })
            }
          >
            {t("catalog.clear")}
          </Button>
        </div>
      </form>
      <p className="mt-4 text-sm text-muted">{t("catalog.count", { count: listings.length })}</p>
      {listings.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((item) => (
            <ListingCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-border bg-card p-8 text-center text-muted">{t("catalog.empty")}</div>
      )}
    </Shell>
  );
}
