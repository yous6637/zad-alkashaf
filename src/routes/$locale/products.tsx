import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { z } from "zod";
import { ProductCard } from "@/components/products/product-card";
import { ProductsPending } from "@/components/layout/route-pending";
import { ErrorPage } from "@/components/layout/status-page";
import { Shell } from "@/components/layout/shell";
import { Button, controlClass, Field } from "@/components/shared/controls";
import { useT } from "@/lib/use-locale";
import { getMeta, listProducts } from "@/lib/zad/api";
import type { CatalogQuery } from "@/lib/zad/types";

const operations = ["sale", "rent", "exchange", "wanted"] as const;
const conditions = ["new", "used_good", "needs_repair"] as const;
const pageSize = 24;
const maxPage = 20;

function num(value: unknown) {
  const n = typeof value === "number" ? value : typeof value === "string" && value ? Number(value) : Number.NaN;
  return Number.isInteger(n) && n >= 0 ? n : undefined;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[]) {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : "";
}

function pageOf(value: unknown) {
  const page = num(value);
  if (page === undefined || page <= 1) return undefined;
  return Math.min(page, maxPage);
}

export const Route = createFileRoute("/$locale/products")({
  validateSearch: (search: Record<string, unknown>): CatalogQuery => {
    const wilaya = num(search.wilayaCode);
    const category = z.string().uuid().safeParse(search.categoryId);
    const page = pageOf(search.page);
    return {
      q: typeof search.q === "string" ? search.q.slice(0, 80) : "",
      categoryId: category.success ? category.data : "",
      wilayaCode: wilaya !== undefined && wilaya >= 1 && wilaya <= 58 ? wilaya : undefined,
      operation: oneOf(search.operation, operations),
      condition: oneOf(search.condition, conditions),
      maxPrice: num(search.maxPrice),
      ...(page ? { page } : {}),
    };
  },
  loaderDeps: ({ search }) => search,
  loader: async ({ deps, params }) => {
    const locale = params.locale === "fr" ? "fr" : "ar";
    const { page, ...filters } = deps;
    const [meta, listings] = await Promise.all([
      getMeta({ data: { locale } }),
      listProducts({ data: { ...filters, locale, limit: (page ?? 1) * pageSize } }),
    ]);
    return { meta, listings };
  },
  pendingMs: 0,
  pendingMinMs: 200,
  pendingComponent: ProductsPending,
  errorComponent: ErrorPage,
  component: ProductsPage,
});

function ProductsPage() {
  const t = useT();
  const navigating = useRouterState({ select: (state) => state.status === "pending" });
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

  function clearFilters() {
    navigate({
      search: {
        q: "",
        categoryId: "",
        wilayaCode: undefined,
        operation: "",
        condition: "",
        maxPrice: undefined,
      },
    });
  }

  const filters: string[] = [];
  if (search.q) filters.push(t("catalog.filterQ", { value: search.q }));
  const category = meta.categories.find((item) => item.id === search.categoryId);
  if (category) filters.push(category.name);
  const wilaya = meta.wilayas.find((item) => item.code === search.wilayaCode);
  if (wilaya) filters.push(wilaya.name);
  if (search.operation && search.operation in operationKey) {
    filters.push(t(operationKey[search.operation as keyof typeof operationKey]));
  }
  if (search.condition && search.condition in conditionKey) {
    filters.push(t(conditionKey[search.condition as keyof typeof conditionKey]));
  }
  if (search.maxPrice !== undefined) filters.push(t("catalog.filterPrice", { amount: search.maxPrice }));
  const total = listings[0]?.matchCount ?? 0;
  const hasMore = listings.length < total && (search.page ?? 1) < maxPage;

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
          <Button type="submit" disabled={navigating}>
            {navigating ? t("auth.pending") : t("catalog.search")}
          </Button>
          <Button type="button" variant="ghost" onClick={clearFilters}>
            {t("catalog.clear")}
          </Button>
        </div>
      </form>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {listings.length < total
            ? t("catalog.showing", { shown: listings.length, count: total })
            : t("catalog.count", { count: total })}
        </p>
        {filters.length ? (
          <Button type="button" variant="ghost" onClick={clearFilters}>
            {t("catalog.clear")}
          </Button>
        ) : null}
      </div>
      {listings.length ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {listings.map((item) => (
            <ProductCard key={item.id} item={item} />
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-border bg-card p-8 text-center text-muted">
          {filters.length ? t("catalog.emptyFiltered", { filters: filters.join(" · ") }) : t("catalog.empty")}
        </div>
      )}
      {hasMore ? (
        <div className="mt-6 flex justify-center">
          <Button
            type="button"
            disabled={navigating}
            onClick={() =>
              navigate({
                search: {
                  ...search,
                  page: (search.page ?? 1) + 1,
                },
              })
            }
          >
            {navigating ? t("auth.pending") : t("catalog.more")}
          </Button>
        </div>
      ) : null}
    </Shell>
  );
}
