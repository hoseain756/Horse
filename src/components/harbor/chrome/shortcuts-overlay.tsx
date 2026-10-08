"use client";

// Harbor Web — keyboard shortcuts help overlay ("?" hotkey)
// Documents app-level + player-level shortcuts; player shortcuts only apply while a player is open.
import { useEffect, useRef } from "react";
import { create } from "zustand";
import { Command, X, MonitorPlay } from "lucide-react";
import { cn } from "@/lib/utils";

type ShortcutsState = {
  open: boolean;
  setOpen: (open: boolean) => void;
  toggle: () => void;
};

export const useShortcutsHelp = create<ShortcutsState>((set, get) => ({
  open: false,
  setOpen: (open) => set({ open }),
  toggle: () => set({ open: !get().open }),
}));

type ShortcutRow = { keys: string[]; label: string };

const ANYWHERE: ShortcutRow[] = [
  { keys: ["Ctrl", "K"], label: "Search (instant results)" },
  { keys: ["/"], label: "Search" },
  { keys: ["Ctrl", "Shift", "P"], label: "Command palette (navigate & settings)" },
  { keys: ["?"], label: "This shortcuts help" },
  { keys: ["Esc"], label: "Close overlays / dialogs" },
  { keys: ["Backspace", "Alt+←"], label: "Go back" },
];

const PLAYER: ShortcutRow[] = [
  { keys: ["Space"], label: "Play / pause" },
  { keys: ["←", "→"], label: "Seek back / forward" },
  { keys: ["↑", "↓"], label: "Volume up / down" },
  { keys: ["M"], label: "Mute" },
  { keys: ["F"], label: "Fullscreen (double-click also works)" },
  { keys: ["U"], label: "Picture-in-picture" },
  { keys: ["S", "C"], label: "Cycle subtitles" },
  { keys: ["W"], label: "Switch stream" },
  { keys: ["N"], label: "Next episode (series)" },
  { keys: ["0", "…", "9"], label: "Jump to 0–90% of the video" },
  { keys: ["Home", "End"], label: "Jump to start / end" },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return <span className="harbor-kbd">{children}</span>;
}

export function ShortcutsOverlay() {
  const open = useShortcutsHelp((s) => s.open);
  const setOpen = useShortcutsHelp((s) => s.setOpen);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, setOpen]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[290] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts"
      onClick={() => setOpen(false)}
    >
      <div
        className="md-dialog harbor-pop-in w-full max-w-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-6 pt-5 pb-4 border-b border-edge-soft">
          <span className="w-9 h-9 rounded-2xl bg-accent-soft border border-edge-soft flex items-center justify-center text-accent">
            <Command className="w-4.5 h-4.5" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-lg font-bold text-ink leading-tight">Keyboard shortcuts</h2>
            <p className="text-xs text-ink-muted">Work anywhere in Harbor.</p>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={() => setOpen(false)}
            className="md-state md-icon-btn harbor-tv-focus ms-auto"
            aria-label="Close shortcuts help"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>

        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto harbor-scroll space-y-6">
          <ShortcutSection title="Anywhere" rows={ANYWHERE} />
          <div>
            <div className="flex items-center gap-2 mb-2.5">
              <MonitorPlay className="w-3.5 h-3.5 text-accent" />
              <h3 className="text-xs font-semibold text-ink uppercase tracking-wide">While watching</h3>
            </div>
            <ShortcutList rows={PLAYER} />
          </div>
        </div>

        <div className="px-6 py-3.5 border-t border-edge-soft bg-elevated/50">
          <p className="text-[11px] text-ink-subtle">
            Tip: press <Kbd>Ctrl</Kbd> <Kbd>K</Kbd> for instant search results, or{" "}
            <Kbd>Ctrl</Kbd> <Kbd>Shift</Kbd> <Kbd>P</Kbd> for the command palette —
            together they search everywhere.
          </p>
        </div>
      </div>
    </div>
  );
}

function ShortcutSection({ title, rows }: { title: string; rows: ShortcutRow[] }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-ink uppercase tracking-wide mb-2.5">{title}</h3>
      <ShortcutList rows={rows} />
    </div>
  );
}

function ShortcutList({ rows }: { rows: ShortcutRow[] }) {
  return (
    <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-1.5">
      {rows.map((r, i) => (
        <li
          key={i}
          className={cn(
            "md-state flex items-center justify-between gap-3 rounded-lg px-2 py-1.5",
          )}
        >
          <span className="text-[13px] text-ink-muted truncate">{r.label}</span>
          <span className="shrink-0 flex items-center gap-1">
            {r.keys.map((k, j) => (
              <Kbd key={j}>{k}</Kbd>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}
