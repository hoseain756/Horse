"use client";

// Harbor Web — Live TV (IPTV): M3U playlist management, channel browsing, guide, playback
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Radio, Plus, Trash2, Play, RefreshCw, Tv, Search, ListVideo } from "lucide-react";
import { useNav, useSettings } from "@/lib/harbor/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "../chrome/page-header";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export type IptvChannel = {
  name: string;
  url: string;
  logo?: string;
  group?: string;
  tvgId?: string;
};

export type EpgProgram = {
  title: string;
  start: number; // epoch ms
  stop: number;
  desc?: string;
};

// ---------- M3U parsing (client-side) ----------
export function parseM3U(text: string): IptvChannel[] {
  const lines = text.split("\n");
  const channels: IptvChannel[] = [];
  let pending: Partial<IptvChannel> | null = null;
  for (const raw of lines) {
    const line = raw.trim();
    if (line.startsWith("#EXTINF")) {
      const name = line.split(",").slice(1).join(",").trim();
      const tvgId = line.match(/tvg-id="([^"]*)"/)?.[1];
      const logo = line.match(/tvg-logo="([^"]*)"/)?.[1];
      const group = line.match(/group-title="([^"]*)"/)?.[1];
      pending = { name, tvgId: tvgId || undefined, logo: logo || undefined, group: group || undefined };
    } else if (line.startsWith("#EXTVLCOPT") || line.startsWith("#EXTGRP")) {
      if (pending && line.startsWith("#EXTGRP:")) {
        pending.group = line.slice(8).trim() || pending.group;
      }
    } else if (line.length > 0 && !line.startsWith("#")) {
      if (pending && (line.startsWith("http://") || line.startsWith("https://") || line.startsWith("rtmp"))) {
        channels.push({ name: pending.name ?? "Unknown", url: line, logo: pending.logo, group: pending.group, tvgId: pending.tvgId });
      }
      pending = null;
    }
  }
  return channels;
}

// ---------- XMLTV EPG parsing (minimal) ----------
export function parseXmltv(text: string, tvgId?: string): Record<string, EpgProgram[]> {
  const out: Record<string, EpgProgram[]> = {};
  try {
    const doc = new DOMParser().parseFromString(text, "text/xml");
    const programmes = doc.getElementsByTagName("programme");
    for (let i = 0; i < programmes.length; i++) {
      const p = programmes[i];
      const channel = p.getAttribute("channel") ?? "";
      const start = parseXmltvTime(p.getAttribute("start") ?? "");
      const stop = parseXmltvTime(p.getAttribute("stop") ?? "");
      const title = p.getElementsByTagName("title")[0]?.textContent ?? "Program";
      const desc = p.getElementsByTagName("desc")[0]?.textContent;
      if (!out[channel]) out[channel] = [];
      out[channel].push({ title, start, stop, desc });
    }
  } catch {
    /* invalid epg */
  }
  return out;
}

function parseXmltvTime(s: string): number {
  // e.g. 20240101120000 +0000
  const m = s.match(/(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})?\s*([+-]\d{4})?/);
  if (!m) return 0;
  const [, y, mo, d, h, mi, sec, tz] = m;
  let ms = Date.UTC(+y, +mo - 1, +d, +h, +mi, sec ? +sec : 0);
  if (tz) {
    const sign = tz[0] === "-" ? -1 : 1;
    const offset = parseInt(tz.slice(1, 3), 10) * 60 + parseInt(tz.slice(3, 5), 10);
    ms -= sign * offset * 60_000;
  }
  return ms;
}

// ---------- Main view ----------
export function LiveView() {
  const settings = useSettings((s) => s.settings);
  const update = useSettings((s) => s.update);
  const push = useNav((s) => s.push);

  const [channels, setChannels] = useState<IptvChannel[]>([]);
  const [epg, setEpg] = useState<Record<string, EpgProgram[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState<string>("all");
  const [addOpen, setAddOpen] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [nameInput, setNameInput] = useState("");
  const loadToken = useRef(0);

  const playlists = settings.iptvPlaylists;

  const loadPlaylists = useCallback(async () => {
    if (playlists.length === 0) {
      setChannels([]);
      setEpg({});
      return;
    }
    const token = ++loadToken.current;
    setLoading(true);
    setError(null);
    try {
      const all: IptvChannel[] = [];
      for (const pl of playlists) {
        const res = await fetch(`/api/proxy/raw?url=${encodeURIComponent(pl.url)}`);
        if (!res.ok) continue;
        const text = await res.text();
        const parsed = parseM3U(text);
        all.push(...parsed.map((c) => ({ ...c, group: `${pl.name}: ${c.group ?? "General"}` })));
      }
      if (token !== loadToken.current) return;
      setChannels(all);

      // Load EPG if any channel lists one (first playlist with .xml epg URL)
      const epgUrl = playlists.find((p) => /\.xml(\.gz)?$/.test(p.url))?.url;
      if (epgUrl) {
        try {
          const epgRes = await fetch(`/api/proxy/raw?url=${encodeURIComponent(epgUrl)}`);
          if (epgRes.ok) {
            const text = await epgRes.text();
            if (token === loadToken.current) setEpg(parseXmltv(text));
          }
        } catch {
          /* epg optional */
        }
      }
    } catch {
      if (token === loadToken.current) setError("Failed to load playlists.");
    } finally {
      if (token === loadToken.current) setLoading(false);
    }
  }, [playlists]);

  useEffect(() => {
    loadPlaylists();
  }, [loadPlaylists]);

  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of channels) {
      const g = c.group ?? "General";
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [channels]);

  const filtered = useMemo(() => {
    let list = channels;
    if (group !== "all") list = list.filter((c) => (c.group ?? "General") === group);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q));
    }
    return list.slice(0, 300);
  }, [channels, group, search]);

  const addPlaylist = () => {
    const url = urlInput.trim();
    if (!/^https?:\/\//i.test(url)) return;
    update({
      iptvPlaylists: [
        ...playlists,
        { id: `pl_${Date.now().toString(36)}`, name: nameInput.trim() || `Playlist ${playlists.length + 1}`, url },
      ],
    });
    setUrlInput("");
    setNameInput("");
    setAddOpen(false);
  };

  const nowProgram = (ch: IptvChannel): EpgProgram | null => {
    const list = epg[ch.tvgId ?? ""];
    if (!list) return null;
    const now = Date.now();
    return list.find((p) => p.start <= now && p.stop > now) ?? null;
  };

  return (
    <div className="pb-16 px-4 md:px-8">
      <PageHeader view="live" />
      <div className="flex items-center justify-end flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-2">
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="md-btn-filled md-state rounded-full">
                <Plus className="w-4 h-4 mr-1" /> Add playlist
              </Button>
            </DialogTrigger>
            <DialogContent className="md-dialog border-0">
              <DialogHeader>
                <DialogTitle>Add IPTV playlist</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs text-ink-muted mb-1 block" htmlFor="pl-name">Name</label>
                  <Input
                    id="pl-name"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    placeholder="My playlist"
                    className="md-field-outlined"
                  />
                </div>
                <div>
                  <label className="text-xs text-ink-muted mb-1 block" htmlFor="pl-url">M3U / EPG URL</label>
                  <Input
                    id="pl-url"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://example.com/playlist.m3u"
                    className="md-field-outlined"
                  />
                </div>
                <Button onClick={addPlaylist} className="md-btn-filled md-state w-full rounded-full">
                  Add
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          <Button size="sm" variant="outline" onClick={loadPlaylists} disabled={loading} className="md-state rounded-full">
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {playlists.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {playlists.map((pl) => (
            <span key={pl.id} className="flex items-center gap-2 rounded-full bg-raised border border-edge-soft pl-3 pr-1 py-1 text-xs text-ink-muted">
              <ListVideo className="w-3.5 h-3.5" />
              {pl.name}
              <button
                type="button"
                aria-label={`Remove ${pl.name}`}
                onClick={() => update({ iptvPlaylists: playlists.filter((p) => p.id !== pl.id) })}
                className="md-state w-5 h-5 rounded-full flex items-center justify-center text-ink-subtle hover:text-danger"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-subtle" aria-hidden />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter channels…"
          className="pl-9 md-field-outlined"
          aria-label="Filter channels"
        />
      </div>

      {groups.length > 1 && (
        <div className="harbor-scroll-x overflow-x-auto flex gap-2 mb-5 pb-1">
          <button
            type="button"
            onClick={() => setGroup("all")}
            aria-pressed={group === "all"}
            className={`md-chip md-state shrink-0 ${group === "all" ? "md-chip-selected" : ""}`}
          >
            All ({channels.length})
          </button>
          {groups.map(([g, count]) => (
            <button
              key={g}
              type="button"
              onClick={() => setGroup(g)}
              aria-pressed={group === g}
              className={`md-chip md-state shrink-0 ${group === g ? "md-chip-selected" : ""}`}
            >
              {g} ({count})
            </button>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 text-danger px-4 py-3 text-sm mb-4">{error}</div>
      )}

      {loading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="harbor-skeleton rounded-2xl h-24" aria-hidden />
          ))}
        </div>
      ) : channels.length === 0 ? (
        <div className="text-center py-20 text-ink-subtle">
          <Tv className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No playlists yet. Add an M3U playlist to watch live TV.</p>
          <p className="text-xs mt-1">Harbor is a neutral client — bring your own playlists.</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((ch, i) => {
            const prog = nowProgram(ch);
            return (
              <button
                key={`${ch.url}-${i}`}
                type="button"
                onClick={() =>
                  push({
                    kind: "player",
                    payload: {
                      url: ch.url,
                      title: ch.name,
                      type: "movie",
                      metaId: `iptv:${i}`,
                      episodeName: prog?.title,
                    },
                  })
                }
                className="harbor-tv-focus md-state flex items-center gap-3 rounded-[var(--md-sys-shape-corner-medium)] bg-[var(--md-sys-color-surface-container)] p-3.5 text-left transition-colors"
              >
                <div className="w-12 h-12 rounded-[var(--md-sys-shape-corner-medium)] bg-raised flex items-center justify-center shrink-0 overflow-hidden">
                  {ch.logo ? (
                     
                    <img src={ch.logo} alt="" className="w-full h-full object-contain" loading="lazy" />
                  ) : (
                    <Radio className="w-5 h-5 text-ink-subtle" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="harbor-clamp-1 text-sm font-semibold text-ink">{ch.name}</p>
                  <p className="harbor-clamp-1 text-xs text-ink-subtle">{prog ? `Now: ${prog.title}` : ch.group ?? "Live"}</p>
                </div>
                <Play className="w-4 h-4 text-accent shrink-0" />
              </button>
            );
          })}
        </div>
      )}
      {!loading && filtered.length === 0 && channels.length > 0 && (
        <div className="text-center py-16 text-ink-subtle text-sm">No channels match your filters.</div>
      )}
    </div>
  );
}
