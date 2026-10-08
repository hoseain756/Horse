// Harbor Web — subtitle fetching + parsing (SRT / WebVTT / basic ASS-SSA)
// Ported from Harbor desktop src/lib/subtitles/parser.ts

import { langMatches } from "./languages";
import type { RawSubtitle } from "./types";

export type SubCue = { start: number; end: number; text: string };

export type LoadedSubtitle = {
  label: string;
  lang?: string;
  url: string;
  cues: SubCue[];
  source?: string; // addon / mirror display name
  aiTranslated?: boolean;
};

function timeToSeconds(h: number, m: number, s: number, ms: number): number {
  return h * 3600 + m * 60 + s + ms / 1000;
}

export function parseSRT(input: string): SubCue[] {
  const cues: SubCue[] = [];
  const clean = input.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");
  const blocks = clean.split(/\n\n+/);
  for (const block of blocks) {
    // Some WebVTT files (OpenSubtitles mirrors) re-emit a BOM before cue indexes
    const lines = block
      .split("\n")
      .map((l) => l.replace(/^\uFEFF/, ""))
      .filter((l) => l.trim().length > 0);
    if (lines.length === 0) continue;
    let idx = 0;
    // optional index line
    if (/^\d+$/.test(lines[0].trim())) idx = 1;
    if (idx >= lines.length) continue;
    const timeMatch = lines[idx].match(
      /(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})/,
    );
    if (!timeMatch) continue;
    const start = timeToSeconds(+timeMatch[1], +timeMatch[2], +timeMatch[3], +timeMatch[4]);
    const end = timeToSeconds(+timeMatch[5], +timeMatch[6], +timeMatch[7], +timeMatch[8]);
    const text = lines
      .slice(idx + 1)
      .join("\n")
      .replace(/<\/?[^>]+>/g, "")
      .replace(/\{\\[^}]*\}/g, "")
      .trim();
    if (text) cues.push({ start, end, text });
  }
  return cues;
}

export function parseVTT(input: string): SubCue[] {
  const clean = input.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");
  const body = clean.replace(/^WEBVTT[^\n]*\n/, "");
  return parseSRT(body);
}

export function parseASS(input: string): SubCue[] {
  const cues: SubCue[] = [];
  const clean = input.replace(/\r\n/g, "\n").replace(/^\uFEFF/, "");
  let format: string[] | null = null;
  for (const line of clean.split("\n")) {
    if (line.startsWith("Format:")) {
      format = line
        .slice(7)
        .split(",")
        .map((s) => s.trim().toLowerCase());
      continue;
    }
    if (!line.startsWith("Dialogue:")) continue;
    if (!format) {
      format = ["layer", "start", "end", "style", "name", "marginl", "marginr", "marginv", "effect", "text"];
    }
    const payload = line.slice(9);
    const parts = payload.split(",");
    const startIdx = format.indexOf("start");
    const endIdx = format.indexOf("end");
    const textIdx = format.indexOf("text");
    if (startIdx < 0 || endIdx < 0 || textIdx < 0) continue;
    if (parts.length <= Math.max(startIdx, endIdx, textIdx)) continue;
    const parseAssTime = (t: string): number => {
      const m = t.trim().match(/(\d{1,2}):(\d{2}):(\d{2})\.(\d{1,3})/);
      if (!m) return 0;
      return timeToSeconds(+m[1], +m[2], +m[3], +m[4]);
    };
    const start = parseAssTime(parts[startIdx]);
    const end = parseAssTime(parts[endIdx]);
    const text = parts
      .slice(textIdx)
      .join(",")
      .replace(/\{\\[^}]*\}/g, "")
      .replace(/\\N/gi, "\n")
      .replace(/\s/g, " ")
      .trim();
    if (text) cues.push({ start, end, text });
  }
  return cues;
}

export function parseSubtitle(content: string): SubCue[] {
  const trimmed = content.trimStart();
  if (trimmed.startsWith("WEBVTT")) return parseVTT(trimmed);
  if (trimmed.includes("[Script Info]") || trimmed.includes("[Events]")) return parseASS(trimmed);
  return parseSRT(trimmed);
}

export function findActiveCue(cues: SubCue[], time: number): SubCue | null {
  let lo = 0;
  let hi = cues.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const cue = cues[mid];
    if (time < cue.start) hi = mid - 1;
    else if (time > cue.end) lo = mid + 1;
    else return cue;
  }
  return null;
}

export async function fetchAndParseSubtitle(
  url: string,
  label: string,
  lang?: string,
  extra?: { source?: string; aiTranslated?: boolean },
): Promise<LoadedSubtitle> {
  const res = await fetch(`/api/proxy/raw?url=${encodeURIComponent(url)}`);
  if (!res.ok) throw new Error(`subtitle fetch ${res.status}`);
  let content = await res.text();
  // basic gzip guard (proxy returns text already)
  if (content.startsWith("\u001f\u008b")) throw new Error("gzipped subtitle unsupported");
  const cues = parseSubtitle(content);
  content = ""; // free
  return { label, lang, url, cues, ...extra };
}

// Pick best subtitle for preferred languages
export function pickBestSubtitle<T extends { lang?: string; m?: string }>(
  subs: T[],
  preferred: string[],
): T | null {
  for (const pref of preferred) {
    const match = subs.find((s) => langMatches(s.lang, pref));
    if (match) return match;
  }
  return subs[0] ?? null;
}

/**
 * Human-readable label for a subtitle entry. Providers disagree wildly on
 * where the release name lives (SubSource/SubDL: id, SubSense: label/fileName,
 * OS v3 pro: title, OS mirrors: subtitleFileName/movieReleaseName, legacy: m).
 */
export function subLabel(s: Partial<RawSubtitle>): string {
  const clean = (v: unknown): string => {
    const t = String(v ?? "")
      .replace(/\.srt$/i, "")
      .replace(/[_.\s]+$/, "")
      .trim();
    return t.length > 1 ? t : "";
  };
  const id = clean(s.id);
  const candidate =
    clean(s.label) ||
    clean(s.subtitleFileName) ||
    clean(s.title) ||
    clean(s.movieReleaseName) ||
    clean(s.releaseName) ||
    clean(s.fileName) ||
    clean(s.m) ||
    (!/^(subsense-|v3\+\|)/i.test(id) ? id.replace(/_\d+$/, "") : "");
  return candidate || (s.lang ?? "").toUpperCase() || "Subtitle";
}

// Convert cues to WebVTT for a native <track> fallback
export function cuesToVTT(cues: SubCue[]): string {
  const fmt = (t: number) => {
    const h = Math.floor(t / 3600);
    const m = Math.floor((t % 3600) / 60);
    const s = Math.floor(t % 60);
    const ms = Math.floor((t % 1) * 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
  };
  const lines = ["WEBVTT", ""];
  cues.forEach((cue, i) => {
    lines.push(String(i + 1));
    lines.push(`${fmt(cue.start)} --> ${fmt(cue.end)}`);
    lines.push(cue.text.replace(/\n/g, " "));
    lines.push("");
  });
  return lines.join("\n");
}
