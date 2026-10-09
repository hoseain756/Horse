"use client";

// Harbor Web — season dropdown (episodes rebuild)
// M3 menu button wearing the shared glass recipe: trigger = glass pill
// ("الموسم 2 ▾"), panel = the app's glass menu surface (elevated/95 +
// backdrop blur + edge stroke, same recipe as the detail-page options menu).
//
// Items: season name (season 0 → "Specials"/"حلقات خاصة"), episode count and
// watched count "12/22"; the current season carries a check. Scrollable with
// a max height; full keyboard support (arrows rove, Home/End, Esc closes and
// refocuses the trigger, Tab dismisses) and SR semantics
// (aria-haspopup/expanded, menu + menuitemradio + aria-checked).
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Check, ChevronDown } from "lucide-react";

export type SeasonOption = {
  season: number;
  label: string;
  count: number;
  watched: number;
};

export function SeasonDropdown({
  options,
  value,
  onChange,
  selectLabel,
}: {
  options: SeasonOption[];
  value: number | null;
  onChange: (season: number) => void;
  selectLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const current = options.find((o) => o.season === value) ?? null;

  const close = useCallback((refocus: boolean) => {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }, []);

  // Outside pointer + Escape close (focus returns to the trigger).
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) close(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close(true);
      }
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open, close]);

  // Open → roving focus lands on the checked item.
  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      menuRef.current
        ?.querySelector<HTMLButtonElement>('[aria-checked="true"]')
        ?.focus();
    });
    return () => cancelAnimationFrame(raf);
  }, [open]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const items = Array.from(
        menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]') ?? [],
      );
      if (items.length === 0) return;
      const idx = items.indexOf(document.activeElement as HTMLButtonElement);
      const move = (next: number) => {
        e.preventDefault();
        items[(next + items.length) % items.length]?.focus();
      };
      if (e.key === "ArrowDown") move(idx + 1);
      else if (e.key === "ArrowUp") move(idx - 1);
      else if (e.key === "Home") move(0);
      else if (e.key === "End") move(items.length - 1);
      else if (e.key === "Tab") close(false);
    },
    [close],
  );

  return (
    <div ref={wrapRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${selectLabel}: ${current?.label ?? ""}`}
        className="glass-surface glass-hover md-state harbor-tv-focus flex h-12 min-w-40 max-w-60 items-center gap-2 rounded-full px-4 text-start"
      >
        <span className="md-label-large truncate text-ink">{current?.label ?? selectLabel}</span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0, 0, 1] }}
          className="flex shrink-0 text-ink-muted ms-auto"
        >
          <ChevronDown className="h-4.5 w-4.5" aria-hidden />
        </motion.span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={menuRef}
            role="menu"
            aria-label={selectLabel}
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.97 }}
            transition={{ duration: 0.19, ease: [0.2, 0, 0, 1] }}
            onKeyDown={onKeyDown}
            className="absolute top-full start-0 z-40 mt-2 w-64 origin-top overflow-hidden rounded-2xl border border-edge-soft bg-elevated/95 shadow-[var(--md-sys-elevation-3)] backdrop-blur-xl"
          >
            <div
              className="harbor-scroll max-h-[min(60vh,420px)] overflow-y-auto overscroll-contain p-1.5"
            >
              {options.map((opt) => {
                const selected = opt.season === value;
                return (
                  <button
                    key={opt.season}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => {
                      onChange(opt.season);
                      close(true);
                    }}
                    className="md-state harbor-tv-focus flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-start transition-colors hover:bg-raised"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                      {selected && <Check className="h-4 w-4 text-accent" aria-hidden />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="md-body-medium block truncate font-semibold text-ink">
                        {opt.label}
                      </span>
                      <span className="md-body-small block text-ink-subtle tabular-nums">
                        {opt.count} · {opt.watched}/{opt.count}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
