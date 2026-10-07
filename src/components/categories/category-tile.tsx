import { Link } from "@tanstack/react-router";
import { CategoryMark } from "@/components/categories/category-mark";
import { useLocale } from "@/lib/use-locale";
import type { Category } from "@/lib/zad/types";

export function CategoryTile({ category }: { category: Category }) {
  const locale = useLocale();

  return (
    <Link
      to="/$locale/products"
      params={{ locale }}
      search={{ categoryId: category.id }}
      className="group flex flex-col items-center gap-3 text-center"
    >
      <span className="grid size-16 place-items-center rounded-full bg-white text-accent shadow-[0_8px_24px_rgba(18,56,44,0.08)] ring-1 ring-border transition group-hover:-translate-y-0.5 group-hover:shadow-[0_12px_28px_rgba(18,56,44,0.12)]">
        <CategoryMark slug={category.slug} className="size-7" />
      </span>
      <span className="text-sm font-medium leading-snug">{category.name}</span>
    </Link>
  );
}

export function CategoryChip({ category }: { category: Category }) {
  const locale = useLocale();

  return (
    <Link
      to="/$locale/products"
      params={{ locale }}
      search={{ categoryId: category.id }}
      className="inline-flex h-9 items-center rounded-full bg-[#eef0ea] px-3 text-sm text-fg transition hover:bg-white hover:ring-1 hover:ring-border"
    >
      {category.name}
    </Link>
  );
}
