import { Link } from "@tanstack/react-router";
import { Search, Users } from "lucide-react";
import { CategoryChip } from "@/components/categories/category-tile";
import { SearchBar } from "@/components/home/search-bar";
import { useLocale, useT } from "@/lib/use-locale";
import type { Category } from "@/lib/zad/types";

export function HeroBanner({ categories }: { categories: Category[] }) {
  const locale = useLocale();
  const t = useT();

  return (
    <section className="relative overflow-hidden text-white">
      <HeroBackdrop />
      <div className="absolute inset-0 bg-gradient-to-l from-black/70 via-black/35 to-black/10" />
      <div className="relative mx-auto flex min-h-[32rem] w-full max-w-7xl flex-col justify-center px-4 pb-24 pt-14 md:min-h-[36rem]">
        <h1 className="max-w-xl text-4xl font-bold leading-tight md:text-5xl">{t("home.title")}</h1>
        <p className="mt-4 max-w-xl text-base text-white/90 md:text-lg">{t("home.lead")}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to="/$locale/account"
            params={{ locale }}
            className="inline-flex h-12 items-center gap-2 rounded-full border border-white/80 bg-white/10 px-5 text-sm font-medium text-white backdrop-blur-sm"
          >
            <Users className="size-4" aria-hidden="true" />
            {t("home.join")}
          </Link>
          <Link
            to="/$locale/products"
            params={{ locale }}
            className="inline-flex h-12 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-accent-fg"
          >
            <Search className="size-4" aria-hidden="true" />
            {t("home.browse")}
          </Link>
        </div>
      </div>
      <div className="relative mx-auto w-full max-w-7xl px-4">
        <SearchBar className="relative z-10 -mb-7 max-w-3xl" />
      </div>
      <div className="bg-bg pt-12">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-2 px-4 pb-2 text-sm">
          <span className="text-muted">{t("home.popular")}</span>
          {categories.map((category) => (
            <CategoryChip key={category.id} category={category} />
          ))}
        </div>
      </div>
    </section>
  );
}

function HeroBackdrop() {
  return (
    <svg
      className="absolute inset-0 size-full"
      viewBox="0 0 1440 720"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="hero-sky" x1="0" y1="0" x2="0.2" y2="1">
          <stop offset="0%" stopColor="#f4d7a3" />
          <stop offset="38%" stopColor="#d98b5a" />
          <stop offset="72%" stopColor="#6b4b3a" />
          <stop offset="100%" stopColor="#1c2a22" />
        </linearGradient>
        <radialGradient id="hero-sun" cx="72%" cy="28%" r="22%">
          <stop offset="0%" stopColor="#ffe7b0" />
          <stop offset="55%" stopColor="#f0b36a" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#f0b36a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="720" fill="url(#hero-sky)" />
      <rect width="1440" height="720" fill="url(#hero-sun)" />
      <path d="M0 430 L120 360 L220 410 L360 300 L520 400 L680 250 L860 390 L1020 280 L1180 380 L1320 310 L1440 360 V720 H0 Z" fill="#2a3b32" />
      <path d="M0 500 L180 420 L320 470 L500 360 L720 470 L940 390 L1140 480 L1300 420 L1440 470 V720 H0 Z" fill="#1b3028" />
      <path d="M0 560 L260 500 L480 560 L740 470 L980 560 L1220 510 L1440 560 V720 H0 Z" fill="#14241e" />
      <path d="M980 560 L1120 390 L1260 560 Z" fill="#166534" />
      <path d="M1120 390 L1260 560 H1120 Z" fill="#12382c" />
      <path d="M1104 560 V430 L1120 416 L1136 430 V560" fill="#f5efe2" />
      <ellipse cx="1180" cy="548" rx="70" ry="14" fill="#0c1a15" opacity="0.35" />
      <circle cx="1248" cy="528" r="10" fill="#c4aa7a" />
      <circle cx="1218" cy="536" r="16" fill="#e8d5a8" />
      <circle cx="1218" cy="536" r="7" fill="#12382c" />
    </svg>
  );
}
