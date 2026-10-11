import { ChevronRight, ChevronLeft } from "lucide-react";
import { useRef, useState } from "react";
import { productImageUrl } from "@/lib/zad/image";
import { ProductVisual } from "./product-visual";

export default function ProductGallery({
    slug,
    images = [],
    badge,
    rtl,
    label,
    alt = "",
  }: {
    slug: string;
    images?: string[];
    badge: string;
    rtl: boolean;
    label: { prev: string; next: string; gallery: string };
    alt?: string;
  }) {
    const photos = images.filter(Boolean);
    const count = Math.max(photos.length, 1);
    const trackRef = useRef<HTMLDivElement>(null);
    const [index, setIndex] = useState(0);
  
    const goTo = (next: number) => {
      const track = trackRef.current;
      if (!track) return;
      const target = Math.max(0, Math.min(count - 1, next));
      // scrollLeft is negative in RTL
      track.scrollTo({ left: (rtl ? -1 : 1) * target * track.clientWidth, behavior: "smooth" });
    };
  
    const onScroll = () => {
      const track = trackRef.current;
      if (!track || !track.clientWidth) return;
      setIndex(Math.round(Math.abs(track.scrollLeft) / track.clientWidth));
    };
  
    const PrevIcon = rtl ? ChevronRight : ChevronLeft;
    const NextIcon = rtl ? ChevronLeft : ChevronRight;
    const arrow =
      "absolute top-1/2 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-fg shadow-md transition hover:bg-white disabled:opacity-0 sm:flex";
  
    return (
      <div className="overflow-hidden rounded-2xl border border-border bg-card p-2 shadow-sm" role="group" aria-label={label.gallery}>
        <div className="relative overflow-hidden rounded-xl">
          <div
            ref={trackRef}
            onScroll={onScroll}
            className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {photos.length
              ? photos.map((path) => (
                  <div key={path} className="w-full shrink-0 snap-center">
                    <img src={productImageUrl(path)} alt={alt} className="aspect-4/3 w-full object-cover sm:aspect-[5/4]" />
                  </div>
                ))
              : (
                  <div className="w-full shrink-0 snap-center">
                    <ProductVisual slug={slug} className="aspect-4/3 w-full sm:aspect-[5/4]" />
                  </div>
                )}
          </div>
  
          <span className="pointer-events-none absolute inset-s-3 top-3 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-white shadow-sm">
            {badge}
          </span>
          <span
            dir="ltr"
            className="pointer-events-none absolute inset-e-3 top-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white"
          >
            {index + 1} / {count}
          </span>
  
          <button type="button" className={`${arrow} inset-s-2`} aria-label={label.prev} disabled={index === 0} onClick={() => goTo(index - 1)}>
            <PrevIcon className="size-5" aria-hidden="true" />
          </button>
          <button type="button" className={`${arrow} inset-e-2`} aria-label={label.next} disabled={index === count - 1} onClick={() => goTo(index + 1)}>
            <NextIcon className="size-5" aria-hidden="true" />
          </button>
  
          <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center gap-1.5 sm:hidden" aria-hidden="true">
            {Array.from({ length: count }, (_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-white" : "w-1.5 bg-white/60"}`} />
            ))}
          </div>
        </div>
  
        <div className="grid grid-cols-4 gap-2 p-1 pt-3">
          {Array.from({ length: count }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`${i + 1} / ${count}`}
              aria-current={i === index}
              onClick={() => goTo(i)}
              className={`overflow-hidden rounded-lg border bg-surface transition ${
                i === index ? "border-2 border-accent p-0.5" : "border-border opacity-75 hover:opacity-100"
              }`}
            >
              {photos.length ? (
                <img src={productImageUrl(photos[i] ?? "")} alt="" className="aspect-square w-full object-cover" />
              ) : (
                <ProductVisual slug={slug} className="aspect-square w-full" />
              )}
            </button>
          ))}
        </div>
      </div>
    );
  }