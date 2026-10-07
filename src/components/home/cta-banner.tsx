import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { ScoutHat } from "@/components/troops/scout-emblem";
import { useLocale, useT } from "@/lib/use-locale";

export function CtaBanner() {
  const locale = useLocale();
  const t = useT();

  return (
    <section className="relative overflow-hidden bg-forest px-4 py-14 text-white">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 text-black/20" aria-hidden="true">
        <svg viewBox="0 0 1440 140" className="h-full w-full" preserveAspectRatio="none">
          <path
            fill="currentColor"
            d="M0 90 L90 48 L180 82 L300 28 L420 88 L560 36 L720 92 L880 24 L1040 84 L1200 32 L1340 86 L1440 50 V140 H0 Z"
          />
        </svg>
      </div>
      <ScoutHat className="pointer-events-none absolute bottom-10 left-8 hidden size-28 md:block" />
      <div className="relative mx-auto flex w-full max-w-5xl flex-col items-center gap-6 text-center">
        <ScoutHat className="size-20 md:hidden" />
        <div>
          <h2 className="text-2xl font-bold md:text-3xl">{t("home.ctaTitle")}</h2>
          <p className="mx-auto mt-2 max-w-2xl text-white/80">{t("home.ctaBody")}</p>
        </div>
        <Link
          to="/$locale/account"
          params={{ locale }}
          className="inline-flex h-12 items-center gap-2 rounded-full bg-gold px-6 text-sm font-semibold text-forest"
        >
          <Plus className="size-4" aria-hidden="true" />
          {t("home.registerTroop")}
        </Link>
      </div>
    </section>
  );
}
