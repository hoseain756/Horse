"use client";

// Harbor Web — horizontal scroll rail (port of Harbor row.tsx, condensed)
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Rail({
  title,
  subtitle,
  titleIcon: TitleIcon,
  children,
  onViewAll,
  itemWidth = 150,
  className,
}: {
  title: string;
  subtitle?: string;
  titleIcon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  onViewAll?: () => void;
  itemWidth?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [showLeft, setShowLeft] = useState(false);
  const [showRight, setShowRight] = useState(true);

  const updateArrows = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    setShowLeft(el.scrollLeft > 20);
    setShowRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 20);
  }, []);

  useEffect(() => {
    updateArrows();
    const el = ref.current;
    if (!el) return;
    el.addEventListener("scroll", updateArrows, { passive: true });
    const ro = new ResizeObserver(updateArrows);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", updateArrows);
      ro.disconnect();
    };
  }, [updateArrows]);

  const scrollBy = (dir: number) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * el.clientWidth * 0.85, behavior: "smooth" });
  };

  return (
    <section className={`relative group/rail ${className ?? ""}`} aria-label={title}>
      <div className="flex items-baseline justify-between px-4 md:px-8 mb-2.5">
        <div className="flex items-baseline gap-2.5 min-w-0">
          {TitleIcon && <TitleIcon className="w-5 h-5 text-accent self-center shrink-0" />}
          <h2 className="md-title-large text-ink truncate">{title}</h2>
          {subtitle && (
            <span className="md-body-small text-ink-subtle truncate hidden sm:inline">{subtitle}</span>
          )}
        </div>
        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="md-chip md-state harbor-tv-focus shrink-0 !min-h-11"
          >
            View all
          </button>
        )}
      </div>
      <div className="relative">
        {/* Hover headroom contract: overflow-x:auto forces overflow-y to clip, so
            .harbor-poster:hover (lift −4px + scale 1.03 ≈ 8px above the card) needs
            real padding INSIDE the scroller. pt-3 + -mt-2 = same visual rhythm as the
            old pt-1 (10−8+12 = 14px header→card gap) with 12px of headroom — without
            it the poster's top edge gets shaved on hover. */}
        <div
          ref={ref}
          className="harbor-scroll-x overflow-x-auto flex gap-3 px-4 md:px-8 pb-3 pt-3 -mt-2"
          style={{ scrollbarWidth: "none" }}
        >
          {children}
          <div className="shrink-0 w-2" aria-hidden />
        </div>
        {/* Edge fades signal more content without touching pointer events */}
        <div
          aria-hidden
          className={`pointer-events-none absolute left-0 top-0 bottom-3 w-10 bg-gradient-to-r from-canvas to-transparent transition-opacity duration-300 ${showLeft ? "opacity-100" : "opacity-0"}`}
        />
        <div
          aria-hidden
          className={`pointer-events-none absolute right-0 top-0 bottom-3 w-10 bg-gradient-to-l from-canvas to-transparent transition-opacity duration-300 ${showRight ? "opacity-100" : "opacity-0"}`}
        />
        {showLeft && (
          <button
            type="button"
            onClick={() => scrollBy(-1)}
            aria-label={`Scroll ${title} left`}
            className="md-icon-btn md-state harbor-tv-focus hidden! md:flex! absolute left-1.5 top-1/2 -translate-y-1/2 z-20 w-10! h-10! bg-black/40! hover:bg-black/70! backdrop-blur border border-edge-soft! text-accent! after:content-[''] after:absolute after:-inset-1 after:rounded-full opacity-0 pointer-events-none group-hover/rail:opacity-100 group-hover/rail:pointer-events-auto group-focus-within/rail:opacity-100 group-focus-within/rail:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto transition-all duration-200"
          >
            <ChevronLeft className="w-4.5 h-4.5" />
          </button>
        )}
        {showRight && (
          <button
            type="button"
            onClick={() => scrollBy(1)}
            aria-label={`Scroll ${title} right`}
            className="md-icon-btn md-state harbor-tv-focus hidden! md:flex! absolute right-1.5 top-1/2 -translate-y-1/2 z-20 w-10! h-10! bg-black/40! hover:bg-black/70! backdrop-blur border border-edge-soft! text-accent! after:content-[''] after:absolute after:-inset-1 after:rounded-full opacity-0 pointer-events-none group-hover/rail:opacity-100 group-hover/rail:pointer-events-auto group-focus-within/rail:opacity-100 group-focus-within/rail:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto transition-all duration-200"
          >
            <ChevronRight className="w-4.5 h-4.5" />
          </button>
        )}
      </div>
    </section>
  );
}

export function RailSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="flex gap-3 px-4 md:px-8 pb-3 overflow-hidden" aria-hidden>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="harbor-skeleton rounded-xl shrink-0 w-[130px] md:w-[150px] aspect-[2/3]" />
      ))}
    </div>
  );
}
