"use client";

// Harbor Web — Letterboxd import dialog (Settings → Integrations → Letterboxd)
// Two ToS-safe sources: the official Letterboxd CSV data export (file upload)
// and a public profile's RSS feed (username). The server parses + matches
// every film to TMDB; the client previews the result and saves it as a
// Horse collection (localStorage lists, cloud-synced like any other list).
import { useRef, useState } from "react";
import { Clapperboard, FileUp, Loader2, Rss, Save, TriangleAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useT } from "@/hooks/use-t";
import { useToast } from "@/hooks/use-toast";
import { createList, addToList } from "@/lib/harbor/lists";
import { cn } from "@/lib/utils";

type LbItem = {
  id: string;
  type: "movie";
  name: string;
  year: number | null;
  poster: string | null;
  rating5: number | null;
  watchedDate: string | null;
};
type LbResponse =
  | { ok: true; items: LbItem[]; matched: number; total: number; unmatched: string[]; handle?: string }
  | { ok: false; error: string };

export function LetterboxdImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const tr = useT();
  const { toast } = useToast();
  const [source, setSource] = useState<"csv" | "rss">("csv");
  const [csvName, setCsvName] = useState<string | null>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [user, setUser] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Extract<LbResponse, { ok: true }> | null>(null);
  const [listName, setListName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setResult(null);
    setErr(null);
    setCsvName(null);
    setCsvText(null);
    setUser("");
    setBusy(false);
  };

  const pickFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result ?? ""));
      setCsvName(file.name);
      setErr(null);
    };
    reader.onerror = () => setErr(tr("lbErrCsv"));
    reader.readAsText(file.slice(0, 2_000_000));
  };

  async function runImport() {
    if (source === "csv" && !csvText) {
      setErr(tr("lbNeedFile"));
      return;
    }
    if (source === "rss" && !user.trim()) {
      setErr(tr("lbNeedUser"));
      return;
    }
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/letterboxd/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(source === "csv" ? { source: "csv", csv: csvText } : { source: "rss", user: user.trim() }),
        signal: AbortSignal.timeout(120_000),
      });
      const data = (await res.json()) as LbResponse;
      if (!res.ok || data.ok !== true) {
        // error payloads are { error: "csv" | "rss" | "tmdb" } with no ok field
        const code = typeof (data as { error?: string }).error === "string" ? (data as { error: string }).error : "";
        setErr(code === "rss" ? tr("lbErrRss") : code === "csv" ? tr("lbErrCsv") : code === "tmdb" ? tr("lbErrTmdb") : tr("lbErrGeneric"));
        return;
      }
      setResult(data);
      setListName(tr("lbCardTitle") + (data.handle ? ` — ${data.handle}` : " — CSV"));
    } catch {
      setErr(tr("lbErrGeneric"));
    } finally {
      setBusy(false);
    }
  }

  function saveAsList() {
    if (!result) return;
    const list = createList(listName.trim() || tr("lbCardTitle"), "Letterboxd import");
    // addToList unshifts — walk in reverse so the first imported film stays first
    let added = 0;
    for (let i = result.items.length - 1; i >= 0; i--) {
      const it = result.items[i];
      const ok = addToList(list.id, {
        id: it.id,
        type: it.type,
        name: it.name,
        poster: it.poster ?? undefined,
        releaseInfo: it.year ? String(it.year) : undefined,
        imdbRating: it.rating5 != null ? `★ ${it.rating5.toFixed(1)}/5` : undefined,
      });
      if (ok) added++;
    }
    toast({ title: tr("lbSaved") });
    onOpenChange(false);
    reset();
    void added;
  }

  const canImport = !busy && (source === "csv" ? !!csvText : !!user.trim());

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v);
        if (!v) reset();
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clapperboard className="h-5 w-5 text-[#00e054]" aria-hidden />
            {tr("lbDialogTitle")}
          </DialogTitle>
          <DialogDescription>{tr("lbDialogDesc")}</DialogDescription>
        </DialogHeader>

        {!result && (
          <>
            {/* source switch */}
            <div className="grid grid-cols-2 gap-2" role="tablist" aria-label={tr("lbDialogTitle")}>
              {(
                [
                  { id: "csv", label: tr("lbSourceCsv"), icon: FileUp },
                  { id: "rss", label: tr("lbSourceRss"), icon: Rss },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="tab"
                  aria-selected={source === s.id}
                  onClick={() => {
                    setSource(s.id);
                    setErr(null);
                  }}
                  className={cn(
                    "harbor-tv-focus flex min-h-11 items-center justify-center gap-2 rounded-xl border px-3 text-sm font-semibold transition-colors",
                    source === s.id
                      ? "border-[#00e054]/50 bg-[#00e054]/10 text-ink"
                      : "border-edge-soft bg-raised text-ink-muted hover:text-ink",
                  )}
                >
                  <s.icon className="h-4 w-4" aria-hidden />
                  {s.label}
                </button>
              ))}
            </div>

            {source === "csv" ? (
              <div className="space-y-2">
                <p className="md-body-small text-ink-muted">{tr("lbCsvPick")}</p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv"
                  className="hidden"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                  aria-hidden
                />
                <Button type="button" variant="outline" className="w-full min-h-11" onClick={() => fileRef.current?.click()}>
                  <FileUp className="h-4 w-4" aria-hidden />
                  {csvName ? tr("lbCsvPicked", { name: csvName }) : tr("lbCsvChoose")}
                </Button>
                <p className="text-[11px] text-ink-subtle">{tr("lbCsvHow")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                <label htmlFor="lb-user" className="md-label-large block text-ink">
                  {tr("lbRssLabel")}
                </label>
                <Input
                  id="lb-user"
                  value={user}
                  onChange={(e) => setUser(e.target.value)}
                  placeholder="username"
                  dir="ltr"
                  className="min-h-11"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && canImport) void runImport();
                  }}
                />
                <p className="text-[11px] text-ink-subtle">{tr("lbRssHint")}</p>
              </div>
            )}

            {err && (
              <p role="alert" className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-300">
                <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                {err}
              </p>
            )}

            <Button type="button" className="min-h-11 w-full" disabled={!canImport} onClick={() => void runImport()}>
              {busy ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  {tr("lbImporting")}
                </>
              ) : (
                tr("lbImportBtn")
              )}
            </Button>
          </>
        )}

        {result && (
          <div className="space-y-3">
            <p className="md-body-medium font-semibold text-ink">
              {tr("lbMatched", { matched: result.matched, total: result.total })}
            </p>

            {result.items.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto pb-1" aria-hidden>
                {result.items.slice(0, 12).map((it) =>
                  it.poster ? (
                    <img
                      key={it.id}
                      src={it.poster}
                      alt=""
                      loading="lazy"
                      className="h-24 w-16 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span key={it.id} className="grid h-24 w-16 shrink-0 place-items-center rounded-md bg-raised text-ink-subtle">
                      <Clapperboard className="h-4 w-4" />
                    </span>
                  ),
                )}
              </div>
            )}

            {result.unmatched.length > 0 && (
              <div className="rounded-xl border border-edge-soft bg-raised/60 p-3">
                <p className="text-xs font-semibold text-ink-muted">{tr("lbUnmatchedTitle")}</p>
                <ul className="mt-1 max-h-28 overflow-y-auto text-[11px] leading-relaxed text-ink-subtle">
                  {result.unmatched.map((u) => (
                    <li key={u} className="truncate">
                      • {u}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="space-y-2">
              <label htmlFor="lb-list-name" className="md-label-large block text-ink">
                {tr("lbListName")}
              </label>
              <Input id="lb-list-name" value={listName} onChange={(e) => setListName(e.target.value)} className="min-h-11" />
            </div>

            <div className="flex gap-2">
              <Button type="button" className="min-h-11 flex-1" onClick={saveAsList}>
                <Save className="h-4 w-4" aria-hidden />
                {tr("lbSave")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-11"
                onClick={() => {
                  reset();
                  setSource(source);
                }}
              >
                {tr("lbImportMore")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
