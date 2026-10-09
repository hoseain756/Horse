"use client";

// Harbor Web — detail page for a user-created list ("Collection")
// M3 (m3-3c): header → md-headline-medium, actions → .md-btn-tonal/.md-icon-btn,
// share/edit dialogs → .md-dialog surfaces with .md-field-outlined inputs.
import { useEffect, useState } from "react";
import { ListVideo, Trash2, Pencil, X, Film, Share2, Copy } from "lucide-react";
import { useNav } from "@/lib/harbor/store";
import {
  getList,
  renameList,
  deleteList,
  removeFromList,
  encodeListShare,
  type UserList,
} from "@/lib/harbor/lists";
import { PosterImage } from "../common/poster";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function ListDetailView({ listId }: { listId: string }) {
  const push = useNav((s) => s.push);
  const pop = useNav((s) => s.pop);
  const { toast } = useToast();
  const [list, setList] = useState<UserList | null>(null);
  const [missing, setMissing] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [descDraft, setDescDraft] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Share-link state (manual-copy dialog opens when the clipboard is blocked)
  const [shareOpen, setShareOpen] = useState(false);
  const [shareLink, setShareLink] = useState("");

  // Reload when the list mutates elsewhere (data-changed) or frame becomes active
  useEffect(() => {
    const reload = () => {
      const l = getList(listId);
      if (l) setList(l);
      else setMissing(true);
    };
    const t = setTimeout(reload, 0);
    window.addEventListener("harbor:data-changed", reload);
    return () => {
      clearTimeout(t);
      window.removeEventListener("harbor:data-changed", reload);
    };
  }, [listId]);

  if (missing || (!list && !getList(listId))) {
    return (
      <div className="pt-24 md:pt-20 px-4 md:px-8 max-w-xl">
        <div className="rounded-2xl border border-danger/40 bg-danger/10 text-danger px-5 py-4 text-sm">
          This list no longer exists.
        </div>
      </div>
    );
  }

  if (!list) {
    return (
      <div className="pt-20 md:pt-14 px-4 md:px-8">
        <div className="harbor-skeleton rounded-3xl h-40 mb-6" aria-hidden />
        <div className="grid gap-3 grid-cols-3 sm:grid-cols-4 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="harbor-skeleton aspect-[2/3] rounded-xl" aria-hidden />
          ))}
        </div>
        <div className="sr-only">Loading list…</div>
      </div>
    );
  }

  const collage = list.items.slice(0, 4).map((i) => i.poster).filter(Boolean) as string[];

  const saveEdit = () => {
    if (!nameDraft.trim()) return;
    const updated = renameList(list.id, nameDraft, descDraft);
    setList(updated.find((l) => l.id === list.id) ?? null);
    setEditOpen(false);
    toast({ title: "List updated" });
  };

  // Build a #list= deep link and copy it; fall back to a manual-copy dialog
  const share = async () => {
    if (!list) return;
    const code = encodeListShare(list);
    if (!code) {
      toast({ title: "Could not build share link", variant: "destructive" });
      return;
    }
    const link = `${window.location.origin}/#list=${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: "Share link copied", description: "Anyone opening it can import this list." });
    } catch {
      // Clipboard can be blocked — let the user copy manually
      setShareLink(link);
      setShareOpen(true);
      toast({ title: "Copy blocked — copy the link manually" });
    }
  };

  return (
    <div className="pb-20">
      {/* Header with collage backdrop */}
      <section className="relative overflow-hidden border-b border-edge-soft">
        <div className="absolute inset-0 grid grid-cols-4 opacity-25" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="relative">
              {collage[i] ? (
                <PosterImage src={collage[i]} alt="" className="absolute inset-0 h-full w-full object-cover" />
              ) : (
                <div className="absolute inset-0 bg-raised" />
              )}
            </div>
          ))}
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-canvas via-canvas/70 to-canvas/40" aria-hidden />
        <div className="relative z-10 px-4 md:px-8 pt-20 md:pt-16 pb-8">
          <div className="flex items-start gap-4 flex-wrap">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-ink-subtle uppercase tracking-wider mb-1.5">
                <ListVideo className="w-3.5 h-3.5 text-accent" />
                Custom list · {list.items.length} {list.items.length === 1 ? "title" : "titles"}
              </div>
              <h1 className="md-headline-medium text-ink mb-2 break-words">
                {list.name}
              </h1>
              {list.description && (
                <p className="text-sm text-ink-muted max-w-xl harbor-clamp-2">{list.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setNameDraft(list.name);
                  setDescDraft(list.description ?? "");
                  setEditOpen(true);
                }}
                className="md-btn md-btn-tonal md-state harbor-tv-focus"
              >
                <Pencil className="md-btn-icon" /> Edit
              </button>
              <button
                type="button"
                onClick={() => void share()}
                className="md-btn md-btn-tonal md-state harbor-tv-focus"
                aria-label={`Share list ${list.name}`}
              >
                <Share2 className="md-btn-icon" /> Share
              </button>
              {confirmDelete ? (
                <div className="flex items-center gap-1.5 rounded-xl bg-danger/15 border border-danger/40 px-2 py-1.5">
                  <span className="md-label-small text-danger whitespace-nowrap">Delete list?</span>
                  <button
                    type="button"
                    onClick={() => {
                      deleteList(list.id);
                      toast({ title: "List deleted" });
                      pop();
                    }}
                    className="md-btn md-btn-danger md-state !h-8 !px-3 !text-xs"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="md-icon-btn md-state !w-8 !h-8 text-ink-muted! hover:text-ink! after:content-[''] after:absolute after:-inset-1 after:rounded-full"
                    aria-label="Cancel delete"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="md-icon-btn md-state harbor-tv-focus !w-12 !h-12 text-ink-subtle! hover:text-danger!"
                  aria-label={`Delete list ${list.name}`}
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Items grid */}
      {list.items.length === 0 ? (
        <div className="text-center py-20 text-ink-subtle px-4">
          <span
            className="w-12 h-12 rounded-2xl bg-accent-soft border border-edge-soft flex items-center justify-center mx-auto mb-3"
            aria-hidden
          >
            <ListVideo className="w-5 h-5 text-accent" />
          </span>
          <p className="text-sm">This list is empty. Open any title and choose “Add to list”.</p>
          <button
            type="button"
            onClick={() => push({ kind: "view", view: "home" })}
            className="md-btn md-btn-filled md-state harbor-tv-focus mt-5"
          >
            Browse titles
          </button>
        </div>
      ) : (
        <div className="px-4 md:px-8 mt-6">
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 xl:grid-cols-6 gap-3">
            {list.items.map((item) => (
              <div
                key={item.id}
                className="group/listitem relative rounded-xl overflow-hidden border border-edge-soft bg-elevated hover:border-accent/50 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => push({ kind: "detail", type: item.type, id: item.id })}
                  className="harbor-poster block w-full text-left aspect-[2/3] relative"
                  aria-label={item.name}
                >
                  <PosterImage src={item.poster} alt={item.name} className="absolute inset-0" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 group-hover/listitem:opacity-100 transition-opacity" />
                  <div className="absolute bottom-0 inset-x-0 p-2 translate-y-1 opacity-0 group-hover/listitem:translate-y-0 group-hover/listitem:opacity-100 transition-all">
                    <p className="harbor-clamp-1 text-xs font-semibold text-white">{item.name}</p>
                    {item.releaseInfo && <p className="text-[10px] text-white/70">{item.releaseInfo}</p>}
                  </div>
                  {!item.poster && (
                    <span className="absolute inset-0 flex items-center justify-center text-ink-subtle">
                      <Film className="w-7 h-7 opacity-40" />
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    removeFromList(list.id, item.id);
                    toast({ title: `Removed from ${list.name}` });
                  }}
                  className="absolute top-1.5 end-1.5 w-8 h-8 rounded-full bg-black/65 backdrop-blur flex items-center justify-center text-white/80 hover:text-danger opacity-0 group-hover/listitem:opacity-100 focus:opacity-100 transition-opacity after:content-[''] after:absolute after:-inset-1.5 after:rounded-full"
                  aria-label={`Remove ${item.name} from ${list.name}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Manual-copy fallback for blocked clipboards */}
      {shareOpen && list && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Share list link"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShareOpen(false);
          }}
        >
          <div className="w-full max-w-lg md-dialog p-5 harbor-pop-in">
            <h3 className="md-title-medium text-ink mb-1">Share “{list.name}”</h3>
            <p className="md-body-small text-ink-subtle mb-3">
              Copy this link to share your list. It contains only titles and poster URLs — nothing
              is sent to any server.
            </p>
            <input
              readOnly
              value={shareLink}
              onFocus={(e) => e.currentTarget.select()}
              className="md-field-outlined w-full px-3.5 py-2.5 text-xs font-mono text-ink"
              aria-label="Share link"
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setShareOpen(false)}
                className="md-btn md-btn-text md-state"
              >
                Close
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(shareLink);
                    toast({ title: "Share link copied" });
                    setShareOpen(false);
                  } catch {
                    toast({
                      title: "Still blocked — select the text and copy manually",
                      variant: "destructive",
                    });
                  }
                }}
                className="md-btn md-btn-filled md-state"
              >
                <Copy className="md-btn-icon" /> Copy again
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit dialog */}
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
          <div className="w-full max-w-md md-dialog p-5">
            <h2 className="md-title-medium text-ink mb-4">Edit list</h2>
            <label className="block md-label-medium text-ink-muted mb-1.5" htmlFor="list-name">
              Name
            </label>
            <input
              id="list-name"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              maxLength={80}
              className="md-field-outlined w-full px-3.5 py-2.5 text-sm text-ink"
              placeholder="e.g. Weekend sci-fi"
            />
            <label className="block md-label-medium text-ink-muted mb-1.5 mt-4" htmlFor="list-desc">
              Description <span className="text-ink-subtle">(optional)</span>
            </label>
            <textarea
              id="list-desc"
              value={descDraft}
              onChange={(e) => setDescDraft(e.target.value)}
              maxLength={200}
              rows={2}
              className="md-field-outlined w-full resize-none px-3.5 py-2.5 text-sm text-ink"
              placeholder="What is this list about?"
            />
            <div className="flex justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={() => setEditOpen(false)}
                className="md-btn md-btn-text md-state"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveEdit}
                disabled={!nameDraft.trim()}
                className="md-btn md-btn-filled md-state"
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
