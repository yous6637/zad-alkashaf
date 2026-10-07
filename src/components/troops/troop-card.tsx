import { Link } from "@tanstack/react-router";
import { MapPin, Package, Users } from "lucide-react";
import { TroopCoverArt } from "@/components/products/product-visual";
import { ScoutEmblem } from "@/components/troops/scout-emblem";
import { useLocale, useT } from "@/lib/use-locale";
import type { TroopCard as Troop } from "@/lib/zad/types";

export function TroopCard({ troop }: { troop: Troop }) {
  const locale = useLocale();
  const t = useT();

  return (
    <Link
      to="/$locale/troops/$id"
      params={{ locale, id: troop.id }}
      className="group relative isolate flex min-h-36 items-center gap-4 overflow-hidden rounded-2xl bg-card p-4 shadow-[0_8px_24px_rgba(18,56,44,0.06)] ring-1 ring-border transition hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgba(18,56,44,0.1)]"
    >
      <div
        className="absolute inset-y-0 end-0 -z-10 w-[46%] opacity-90 ltr:[mask-image:linear-gradient(to_right,transparent,black_58%)] rtl:[mask-image:linear-gradient(to_left,transparent,black_58%)]"
        aria-hidden="true"
      >
        {troop.thumbnail ? (
          <img
            src={troop.thumbnail}
            alt=""
            className="size-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <TroopCoverArt seed={troop.id} />
        )}
      </div>

      <div className="grid size-[4.5rem] shrink-0 place-items-center overflow-hidden rounded-full bg-white shadow-md ring-1 ring-border">
        {troop.logo ? (
          <img src={troop.logo} alt="" className="size-full object-contain p-1" />
        ) : (
          <ScoutEmblem className="size-[4.25rem]" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1.5 pe-[18%]">
        <h3 className="line-clamp-2 text-lg font-semibold leading-snug break-words">{troop.name}</h3>
        <p className="flex items-center gap-1.5 text-sm text-muted">
          <MapPin className="size-4 shrink-0" aria-hidden="true" />
          <span className="truncate">{troop.wilayaName}</span>
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span className="inline-flex items-center gap-1.5">
            <Users className="size-4 shrink-0" aria-hidden="true" />
            {t("home.members", { count: troop.memberCount })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Package className="size-4 shrink-0" aria-hidden="true" />
            {t("home.listings", { count: troop.listingCount })}
          </span>
        </p>
        <span className="mt-1 inline-flex h-10 items-center rounded-full border border-border bg-white/80 px-4 text-sm font-medium">
          {t("home.viewTroop")}
        </span>
      </div>
    </Link>
  );
}
