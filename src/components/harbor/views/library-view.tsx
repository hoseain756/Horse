"use client";

// Harbor Web — Library: Watchlist + Lists + History tabs (port of Harbor library.tsx)
import { useEffect, useState } from "react";
import { PageHeader } from "../chrome/page-header";
import { Library, Bookmark, History, Trash2, ListPlus, ListVideo, Pencil, X, Check } from "lucide-react";
import { useNav } from "@/lib/harbor/store";
import { getWatchlist, getHistory, toggleWatchlist, type WatchlistEntry, type HistoryEntry } from "@/lib/harbor/cw";
import {
  getLists,
  createList,
  deleteList,
  renameList,
  listCollage,
  type UserList,
} from "@/lib/harbor/lists";
import { PosterImage } from "../common/poster";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Tab = "watchlist" | "lists" | "history";

export function LibraryView() {
  const push = useNav((s) => s.push);
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("watchlist");
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [lists, setLists] = useState<UserList[]>([]);

  // create dialog state
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  useEffect(() => {
    const t = setTimeout(() => {
      setWatchlist(getWatchlist());
      setHistory(getHistory());
      setLists(getLists());
      const saved = window.localStorage.getItem("harbor-web.library.tab") as Tab | null;
      if (saved === "history" || saved === "watchlist" || saved === "lists") setTab(saved);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  const switchTab = (t: Tab) => {
    setTab(t);
    window.localStorage.setItem("harbor-web.library.tab", t);
  };

  const removeWatch = (id: string) => {
    const entry = watchlist.find((w) => w.id === id);
    if (entry) {
      toggleWatchlist(entry);
      setWatchlist(getWatchlist());
    }
  };

  const create = () => {
    const name = newName.trim();
    if (!name) return;
    const list = createList(name, newDesc);
    setLists(getLists());
    setCreateOpen(false);
    setNewName("");
    setNewDesc("");
    toast({ title: `Created “${list.name}”` });
    push({ kind: "list-detail", listId: list.id });
  };

  return (
    <div className="pb-16 px-4 md:px-8">
      <PageHeader view="library" />

      {/* M3 filter-chip group (acts as the collection sort/tabs) */}
      <div className="flex gap-2 mt-5 mb-7 flex-wrap">
        {(
          [
            { id: "watchlist", label: "Watchlist", icon: Bookmark, count: watchlist.length },
            { id: "lists", label: "Lists", icon: ListVideo, count: lists.length },
            { id: "history", label: "History", icon: History, count: history.length },
          ] as const
        ).map((t) => {
          const active = tab === t.id;
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => switchTab(t.id)}
              aria-pressed={active}
              className={cn(
                "md-chip harbor-tv-focus !h-11 px-4",
                active && "md-chip-selected border-transparent",
              )}
            >
              <Icon className="w-4 h-4" /> {t.label} ({t.count})
            </button>
          );
        })}
      </div>

      {tab === "watchlist" && (
        <>
          {watchlist.length === 0 ? (
            <div className="text-center py-20 text-ink-subtle">
              <span
                className="w-12 h-12 rounded-2xl bg-accent-soft border border-edge-soft flex items-center justify-center mx-auto mb-3"
                aria-hidden
              >
                <Bookmark className="w-5 h-5 text-accent" />
              </span>
              <p className="text-sm">Your watchlist is empty. Add titles from any detail page.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {watchlist.map((w) => (
                <div
                  key={w.id}
                  className="md-card-outlined md-state harbor-lift-card group flex gap-3 rounded-[var(--md-sys-shape-corner-large)] p-3 hover:-translate-y-0.5"
                >
                  <button
                    type="button"
                    onClick={() => push({ kind: "detail", type: w.type, id: w.id })}
                    className="harbor-poster w-16 h-24 shrink-0 relative block"
                    aria-label={w.name}
                  >
                    <PosterImage src={w.poster} alt={w.name} className="absolute inset-0" />
                  </button>
                  <div className="min-w-0 flex-1 flex flex-col">
                    <p className="harbor-clamp-2 md-body-medium font-semibold text-ink">{w.name}</p>
                    <p className="md-body-small text-ink-muted mt-0.5">{w.releaseInfo ?? w.type}</p>
                    {w.imdbRating && <p className="md-body-small text-amber-300 mt-0.5">★ {w.imdbRating}</p>}
                    <div className="mt-auto flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => push({ kind: "detail", type: w.type, id: w.id })}
                        className="md-btn-filled !h-9 !px-3.5 text-xs"
                      >
                        Open
                      </button>
                      <button
                        type="button"
                        onClick={() => removeWatch(w.id)}
                        className="md-icon-btn harbor-tv-focus !w-11 !h-11 text-ink-muted hover:!text-danger"
                        aria-label={`Remove ${w.name} from watchlist`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "lists" && (
        <>
          <div className="flex justify-end mb-4">
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="md-btn-filled harbor-tv-focus"
            >
              <ListPlus className="w-4 h-4" /> New list
            </button>
          </div>
          {lists.length === 0 ? (
            <div className="text-center py-20 text-ink-subtle">
              <span
                className="w-12 h-12 rounded-2xl bg-accent-soft border border-edge-soft flex items-center justify-center mx-auto mb-3"
                aria-hidden
              >
                <ListVideo className="w-5 h-5 text-accent" />
              </span>
              <p className="text-sm">No lists yet. Curate themed collections like “Comfort watches”.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {lists.map((l) => (
                <ListCard
                  key={l.id}
                  list={l}
                  onOpen={() => push({ kind: "list-detail", listId: l.id })}
                  onDelete={() => {
                    deleteList(l.id);
                    setLists(getLists());
                    toast({ title: "List deleted" });
                  }}
                  onRename={() => {
                    setLists(getLists());
                  }}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "history" && (
        <>
          {history.length === 0 ? (
            <div className="text-center py-20 text-ink-subtle">
              <span
                className="w-12 h-12 rounded-2xl bg-accent-soft border border-edge-soft flex items-center justify-center mx-auto mb-3"
                aria-hidden
              >
                <History className="w-5 h-5 text-accent" />
              </span>
              <p className="text-sm">No watch history yet.</p>
            </div>
          ) : (
            <div className="md-card-outlined rounded-[var(--md-sys-shape-corner-large)] max-h-[70vh] overflow-y-auto harbor-scroll">
              <div className="divide-y divide-edge-soft">
                {history.slice(0, 100).map((h, i) => (
                  <button
                    key={`${h.id}-${h.t}-${i}`}
                    type="button"
                    onClick={() => push({ kind: "detail", type: h.type, id: h.id })}
                    className="md-state w-full flex items-center gap-3 p-3 text-start"
                  >
                    <div className="w-10 h-14 shrink-0 relative rounded-md overflow-hidden">
                      <PosterImage src={h.poster} alt={h.name} className="absolute inset-0" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="harbor-clamp-1 text-sm font-medium text-ink">{h.name}</p>
                      <p className="text-xs text-ink-subtle">
                        {h.season ? `S${h.season}:E${h.episode} · ` : ""}
                        {new Date(h.t).toLocaleString()}
                      </p>
                      {h.durationMs > 0 && (
                        <div className="mt-1 h-1 rounded-full bg-white/10 overflow-hidden max-w-[200px]">
                          <div
                            className="h-full bg-accent"
                            style={{ width: `${Math.min(100, (h.positionMs / h.durationMs) * 100)}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Create-list dialog */}
      {createOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Create list"
          onClick={(e) => {
            if (e.target === e.currentTarget) setCreateOpen(false);
          }}
        >
          <div className="md-dialog w-full max-w-md p-5 harbor-pop-in">
            <h2 className="md-title-medium font-display font-bold text-ink mb-4">Create a new list</h2>
            <label className="block md-label-medium text-ink-muted mb-1.5" htmlFor="new-list-name">
              Name
            </label>
            <input
              id="new-list-name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && create()}
              maxLength={80}
              autoFocus
              className="md-field-outlined w-full px-3.5 py-2.5 text-sm text-ink"
              placeholder="e.g. Space epics"
            />
            <label className="block md-label-medium text-ink-muted mb-1.5 mt-4" htmlFor="new-list-desc">
              Description <span className="text-ink-subtle">(optional)</span>
            </label>
            <textarea
              id="new-list-desc"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              maxLength={200}
              rows={2}
              className="md-field-outlined w-full resize-none px-3.5 py-2.5 text-sm text-ink"
              placeholder="What belongs here?"
            />
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="md-btn-text"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={create}
                disabled={!newName.trim()}
                className="md-btn-filled disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Create list
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- List card with poster collage ----------
function ListCard({
  list,
  onOpen,
  onDelete,
  onRename,
}: {
  list: UserList;
  onOpen: () => void;
  onDelete: () => void;
  onRename: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState(list.name);
  const [descDraft, setDescDraft] = useState(list.description ?? "");
  const collage = listCollage(list);

  return (
    <div className="group harbor-lift-card relative rounded-2xl border border-edge-soft bg-elevated overflow-hidden hover:-translate-y-0.5">
      {/* Collage */}
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left"
        aria-label={`Open list ${list.name}`}
      >
        <div className="relative h-36 overflow-hidden">
          <div className="absolute inset-0 grid grid-cols-3 gap-px bg-black/20" aria-hidden>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="relative bg-raised overflow-hidden">
                {collage[i] ? (
                  <PosterImage src={collage[i]} alt="" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center text-ink-subtle">
                    <ListVideo className="w-6 h-6 opacity-30" />
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="absolute inset-0 bg-gradient-to-t from-elevated via-elevated/20 to-transparent" aria-hidden />
          <span className="absolute top-2.5 right-2.5 rounded-full bg-black/60 backdrop-blur px-2.5 py-1 text-[11px] font-semibold text-white">
            {list.items.length} {list.items.length === 1 ? "title" : "titles"}
          </span>
        </div>
        <div className="p-4">
          <p className="harbor-clamp-1 font-semibold text-ink group-hover:text-accent transition-colors">
            {list.name}
          </p>
          {list.description ? (
            <p className="harbor-clamp-2 text-xs text-ink-muted mt-1 min-h-[2rem]">{list.description}</p>
          ) : (
            <p className="text-xs text-ink-subtle mt-1 min-h-[2rem] italic">No description</p>
          )}
          <p className="text-[11px] text-ink-subtle mt-2">
            Updated {new Date(list.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </button>

      {/* Hover actions */}
      <div className="absolute top-2.5 left-2.5 flex gap-1.5 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => {
            setNameDraft(list.name);
            setDescDraft(list.description ?? "");
            setEditOpen(true);
          }}
          className="w-7 h-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white/85 hover:text-accent"
          aria-label={`Rename list ${list.name}`}
        >
          <Pencil className="w-3.5 h-3.5" />
        </button>
        {confirmDelete ? (
          <span className="flex items-center gap-1 rounded-full bg-black/75 backdrop-blur px-2 py-1">
            <span className="text-[11px] text-danger font-semibold">Delete?</span>
            <button
              type="button"
              onClick={onDelete}
              className="w-5 h-5 rounded-full bg-danger flex items-center justify-center text-white"
              aria-label="Confirm delete"
            >
              <Check className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="w-5 h-5 rounded-full bg-raised flex items-center justify-center text-ink-muted"
              aria-label="Cancel delete"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className="w-7 h-7 rounded-full bg-black/60 backdrop-blur flex items-center justify-center text-white/85 hover:text-danger"
            aria-label={`Delete list ${list.name}`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Rename dialog */}
      {editOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Edit list"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditOpen(false);
          }}
        >
          <div className="w-full max-w-md rounded-2xl border border-edge-soft bg-elevated p-5 shadow-2xl harbor-pop-in">
            <h2 className="font-display text-lg font-bold text-ink mb-4">Edit list</h2>
            <input
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={80}
              className="w-full rounded-xl bg-raised border border-edge-soft px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent"
              aria-label="List name"
            />
            <textarea
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              maxLength={200}
              rows={2}
              className="w-full resize-none rounded-xl bg-raised border border-edge-soft px-3.5 py-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-accent mt-3"
              placeholder="Description (optional)"
              aria-label="List description"
            />
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="rounded-xl bg-raised px-4 py-2 text-sm font-semibold text-ink-muted hover:text-ink"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (nameDraft.trim()) {
                    renameList(list.id, nameDraft, descDraft);
                    onRename();
                  }
                  setEditOpen(false);
                }}
                disabled={!nameDraft.trim()}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-bold text-black hover:brightness-110 disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
