import { useNavigate } from "@tanstack/react-router";
import { Search } from "lucide-react";
import { useLocale, useT } from "@/lib/use-locale";

export function SearchBar({ className = "" }: { className?: string }) {
  const locale = useLocale();
  const navigate = useNavigate();
  const t = useT();

  return (
    <form
      className={`flex w-full items-center gap-2 rounded-full bg-white p-1.5 text-fg shadow-[0_10px_40px_rgba(18,56,44,0.16)] ${className}`}
      onSubmit={(event) => {
        event.preventDefault();
        const q = String(new FormData(event.currentTarget).get("q") ?? "").trim();
        void navigate({ to: "/$locale/products", params: { locale }, search: { q } });
      }}
    >
      <Search className="ms-3 size-5 shrink-0 text-muted" aria-hidden="true" />
      <input
        name="q"
        className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-subtle"
        placeholder={t("home.searchPlaceholder")}
      />
      <button
        type="submit"
        className="h-11 rounded-full bg-accent px-6 text-sm font-medium text-accent-fg"
      >
        {t("home.search")}
      </button>
    </form>
  );
}
