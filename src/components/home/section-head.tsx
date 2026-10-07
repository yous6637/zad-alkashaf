import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useLocale, useT } from "@/lib/use-locale";

export function SectionHead({
  id,
  title,
  icon,
  href,
}: {
  id?: string;
  title: string;
  icon: ReactNode;
  href?: "/$locale/products" | "/$locale/troops";
}) {
  const locale = useLocale();
  const t = useT();

  return (
    <div className="mb-6 flex items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2 text-2xl font-semibold text-accent">
        {icon}
        {title}
      </h2>
      {href ? (
        <Link
          to={href}
          params={{ locale }}
          className="inline-flex items-center gap-1 text-sm text-muted transition hover:text-accent"
        >
          {t("home.seeAll")}
          <ArrowLeft className="size-4 ltr:rotate-180" aria-hidden="true" />
        </Link>
      ) : null}
    </div>
  );
}
