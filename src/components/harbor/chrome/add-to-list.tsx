"use client";

// Harbor Web — "Add to list" popover (detail view) — assign any title to user lists
// Placement is owned by Radix Popover (portal at the end of <body> +
// collision-aware popper): opening it can never widen, clip, or shift the
// page — it flips above when out of room, shifts to stay 12px inside the
// viewport, and is capped at min(70vh, available space) with internal
// scrolling. The visual design (panel, items, colors, radius, typography)
// is unchanged — only the placement engine changed.
import { useEffect, useRef, useState } from "react";
import { ListPlus, Check, Plus, FolderOpen } from "lucide-react";
import { useNav } from "@/lib/harbor/store";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getLists,
  getListsContaining,
  toggleInList,
  createList,
  type UserList,
} from "@/lib/harbor/lists";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type TargetItem = {
  id: string;
  type: string;
  name: string;
  poster?: string;
  releaseInfo?: string;
  imdbRating?: string;
};

export function AddToListButton({
  item,
  variant = "row",
}: {
  item: TargetItem;
  /** "row" = pill button (legacy detail layout). "icon" = compact circular
   *  icon button for the premium centered action row (Task 30); the popover
   *  centers under the button so it fits narrow phones in both RTL and LTR. */
  variant?: "row" | "icon";
}) {
  const [open, setOpen] = useState(false);
  const [lists, setLists] = useState<UserList[]>([]);
  const [member, setMember] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const push = useNav((s) => s.push);
  const { toast } = useToast();

  const refresh = () => {
    const all = getLists();
    setLists(all);
    setMember(new Set(getListsContaining(item.id).map((l) => l.id)));
  };

  const count = member.size;

  // Radix owns outside-click + Escape + focus return; we only load fresh
  // list state whenever the popover opens.
  const onOpenChange = (next: boolean) => {
    if (next) refresh();
    else setCreating(false);
    setOpen(next);
  };

  useEffect(() => {
    if (creating) inputRef.current?.focus();
  }, [creating]);

  const create = () => {
    const name = newName.trim();
    if (!name) return;
    const list = createList(name);
    toggleInList(list.id, item);
    refresh();
    setCreating(false);
    setNewName("");
    toast({ title: `Created “${list.name}”`, description: `${item.name} added.` });
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={count > 0 ? `In ${count} ${count === 1 ? "list" : "lists"}` : "Add to list"}
          className={cn(
            variant === "icon"
              ? cn(
                  "harbor-tv-focus flex h-[52px] w-[52px] items-center justify-center rounded-full",
                  "border border-edge-soft bg-raised/80 text-ink backdrop-blur-md transition-all",
                  "hover:bg-raised hover:scale-[1.04] active:scale-95 md-state",
                  count > 0 && "bg-accent-soft text-accent border-accent/40",
                )
              : cn(
                  "flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-colors",
                  count > 0 ? "bg-accent-soft text-accent" : "bg-raised/80 backdrop-blur text-ink hover:bg-raised",
                ),
          )}
        >
          <ListPlus className={variant === "icon" ? "h-5 w-5" : "h-4 w-4"} />
          {variant === "row" &&
            (count > 0 ? `In ${count} ${count === 1 ? "list" : "lists"}` : "Add to list")}
          {variant === "icon" && <span className="sr-only">{count > 0 ? `In ${count} lists` : "Add to list"}</span>}
        </button>
      </PopoverTrigger>

      <PopoverContent
        role="menu"
        aria-label="Lists"
        side="bottom"
        align={variant === "icon" ? "center" : "start"}
        sideOffset={8}
        collisionPadding={12}
        className="max-h-[min(70vh,var(--radix-popover-content-available-height))] w-72 overflow-y-auto overscroll-contain rounded-[var(--md-sys-shape-corner-large)] border border-edge-soft bg-elevated p-0 shadow-[var(--md-sys-elevation-3)] harbor-pop-in"
      >
        <div>
          <div className="px-4 pt-3 pb-2 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Your lists
          </div>
          <div className="max-h-56 overflow-y-auto harbor-scroll px-2 pb-2">
            {lists.length === 0 && !creating && (
              <p className="px-2 py-3 text-xs text-ink-subtle">
                No lists yet — create your first one below.
              </p>
            )}
            {lists.map((l) => {
              const inList = member.has(l.id);
              return (
                <button
                  key={l.id}
                  type="button"
                  role="menuitemcheckbox"
                  aria-checked={inList}
                  onClick={() => {
                    const nowIn = toggleInList(l.id, item);
                    if (nowIn) toast({ title: `Added to ${l.name}` });
                    else toast({ title: `Removed from ${l.name}` });
                    refresh();
                  }}
                  className="md-state w-full flex items-center gap-2.5 rounded-[var(--md-sys-shape-corner-medium)] px-2.5 py-2 text-left hover:bg-raised transition-colors group"
                >
                  <span
                    className={cn(
                      "w-5 h-5 shrink-0 rounded-md border flex items-center justify-center transition-colors",
                      inList ? "bg-accent border-accent text-black" : "border-edge-soft bg-raised text-transparent group-hover:border-ink-subtle",
                    )}
                  >
                    <Check className="w-3.5 h-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block harbor-clamp-1 text-sm text-ink">{l.name}</span>
                    <span className="block text-[11px] text-ink-subtle">{l.items.length} titles</span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="border-t border-edge-soft p-2">
            {creating ? (
              <div className="flex items-center gap-1.5 px-1">
                <input
                  ref={inputRef}
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      create();
                    }
                    if (e.key === "Escape") setCreating(false);
                  }}
                  maxLength={80}
                  placeholder="List name…"
                  className="md-field-outlined flex-1 min-w-0 bg-raised px-2.5 py-1.5 text-xs text-ink"
                />
                <button
                  type="button"
                  onClick={create}
                  disabled={!newName.trim()}
                  className="rounded-lg bg-accent px-2.5 py-1.5 text-xs font-bold text-black hover:brightness-110 disabled:opacity-40"
                >
                  Create
                </button>
              </div>
            ) : (
              <div className="flex gap-1.5 px-1">
                <button
                  type="button"
                  onClick={() => setCreating(true)}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-raised px-2.5 py-2 text-xs font-semibold text-ink hover:text-accent transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> New list
                </button>
                {lists.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setOpen(false);
                      push({ kind: "view", view: "library" });
                    }}
                    className="flex items-center justify-center rounded-lg bg-raised px-2.5 py-2 text-xs text-ink-subtle hover:text-ink transition-colors"
                    title="Open library lists"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
