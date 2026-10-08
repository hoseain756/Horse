// Harbor Web — Wrapped share card generator (client-side canvas, 1200x675 PNG).
// Pure DOM/Canvas: no React, no server. Posters are re-routed through the
// same-origin /api/proxy/raw passthrough so the canvas never taints; if toBlob
// still fails (SecurityError / tainted canvas) we redraw on a FRESH canvas
// without poster images (initial-letter placeholders) so the download always
// succeeds. Taint is permanent per canvas, hence the fresh-canvas retry.

import { HORSE_PATH_D, HORSE_VB_H, HORSE_VB_W } from "@/lib/harbor/brand-asset";

const CARD_W = 1200;
const CARD_H = 675;
const MARGIN = 72;
const FALLBACK_ACCENT = { r: 240, g: 180, b: 41 }; // warm amber, matches default oklch accent

export type ShareCardOpts = {
  watchMs: number;
  movies: number;
  episodes: number;
  activeDays: number;
  topTitles: { name: string; poster?: string; type: string }[];
  accent: string;
  name?: string;
};

type Rgb = { r: number; g: number; b: number };

function fmtDuration(ms: number): string {
  const hours = Math.floor(ms / 3_600_000);
  const mins = Math.floor((ms % 3_600_000) / 60_000);
  const secs = Math.floor((ms % 60_000) / 1000);
  if (hours >= 1) return `${hours}h ${mins}m`;
  if (mins >= 1) return `${mins}m`;
  return `${secs}s`;
}

/**
 * Resolve any CSS color string (hex / oklch / color-mix …) into sRGB bytes by
 * painting it on a detached 1x1 canvas and reading the pixel back. Falls back
 * to the default accent when the value is invalid or Canvas is unavailable.
 */
function accentToRgb(accent: string): Rgb {
  try {
    const probe = document.createElement("canvas");
    probe.width = 1;
    probe.height = 1;
    const pctx = probe.getContext("2d", { willReadFrequently: true });
    if (!pctx) return FALLBACK_ACCENT;
    pctx.fillStyle = "#010203"; // sentinel — an invalid assignment keeps this value
    pctx.fillStyle = accent;
    if (pctx.fillStyle === "#010203") return FALLBACK_ACCENT;
    pctx.fillRect(0, 0, 1, 1);
    const d = pctx.getImageData(0, 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  } catch {
    return FALLBACK_ACCENT;
  }
}

const rgba = (c: Rgb, a: number) => `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;

/** Posters must be same-origin for canvas safety: cross-origin ones go through the raw proxy. */
function proxiedPosterUrl(src: string): string {
  try {
    if (src.startsWith("/")) return src;
    if (src.startsWith("blob:") || src.startsWith("data:")) return src;
    if (new URL(src, window.location.href).origin === window.location.origin) return src;
  } catch {
    return src;
  }
  return `/api/proxy/raw?url=${encodeURIComponent(src)}`;
}

/** Load an image for canvas drawing; resolves null on error or after 4s (caller draws a placeholder). */
function loadImage(src: string, timeoutMs = 4000): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    let settled = false;
    const finish = (v: HTMLImageElement | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      resolve(v);
    };
    const timer = window.setTimeout(() => finish(null), timeoutMs);
    img.onload = () => finish(img.naturalWidth > 0 ? img : null);
    img.onerror = () => finish(null);
    img.src = proxiedPosterUrl(src);
  });
}

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

const FONT_SANS = "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif";

/** Cover-crop an image into a rounded rect. */
function drawPosterImage(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.clip();
  const ir = img.naturalWidth / img.naturalHeight;
  const tr = w / h;
  let dw = w;
  let dh = h;
  let dx = x;
  let dy = y;
  if (ir > tr) {
    dh = h;
    dw = h * ir;
    dx = x - (dw - w) / 2;
  } else {
    dw = w;
    dh = w / ir;
    dy = y - (dh - h) / 2;
  }
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

function drawPosterPlaceholder(
  ctx: CanvasRenderingContext2D,
  letter: string,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  accent: Rgb,
) {
  ctx.save();
  roundRectPath(ctx, x, y, w, h, r);
  ctx.fillStyle = rgba(accent, 0.12);
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(accent, 0.35);
  ctx.stroke();
  ctx.fillStyle = rgba(accent, 0.9);
  ctx.font = `700 ${Math.round(h * 0.28)}px ${FONT_SANS}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(letter.toUpperCase(), x + w / 2, y + h / 2 + 2);
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.restore();
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  opts: ShareCardOpts,
  accent: Rgb,
  images: (HTMLImageElement | null)[],
) {
  const year = String(new Date().getFullYear());

  // Background
  ctx.fillStyle = "#0f1012";
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Soft accent radial glow (top-left) at ~18% alpha
  const glow = ctx.createRadialGradient(200, 100, 40, 200, 100, 640);
  glow.addColorStop(0, rgba(accent, 0.18));
  glow.addColorStop(1, rgba(accent, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // One thin accent ring decoration on the right
  ctx.beginPath();
  ctx.arc(CARD_W - 130, 250, 265, 0, Math.PI * 2);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = rgba(accent, 0.26);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(CARD_W - 130, 250, 236, -0.35 * Math.PI, 0.65 * Math.PI);
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba(accent, 0.14);
  ctx.stroke();

  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";

  // Header: small caps in accent + galloping-horse brand mark (drawn from the
  // primary logo geometry via Path2D; text-only fallback if unsupported)
  try {
    ctx.letterSpacing = "4px";
  } catch {
    /* not supported — cosmetic only */
  }
  ctx.font = `600 20px ${FONT_SANS}`;
  ctx.fillStyle = rgba(accent, 1);
  let headerX = MARGIN;
  try {
    const mark = new Path2D(HORSE_PATH_D);
    const mw = 52;
    const scale = mw / HORSE_VB_W;
    const mh = HORSE_VB_H * scale;
    const my = 92 - mh - 2; // mark bottom sits 2px above the header baseline
    ctx.save();
    ctx.translate(MARGIN, my);
    ctx.scale(scale, scale);
    ctx.fillStyle = rgba(accent, 0.95);
    ctx.fill(mark, "evenodd");
    ctx.restore();
    headerX = MARGIN + mw + 14;
  } catch {
    /* Path2D unsupported — text-only header */
  }
  ctx.fillText("MY HORSE WRAPPED", headerX, 92);

  // Current year, big
  try {
    ctx.letterSpacing = "1px";
  } catch {
    /* cosmetic */
  }
  ctx.font = `700 42px ${FONT_SANS}`;
  ctx.fillStyle = "#f4f4f6";
  ctx.fillText(year, MARGIN, 144);

  // Optional name badge (top right)
  if (opts.name && opts.name.trim()) {
    ctx.font = `500 14px ${FONT_SANS}`;
    ctx.fillStyle = "#8f929c";
    ctx.textAlign = "right";
    ctx.fillText(`SHARED BY ${opts.name.trim().toUpperCase().slice(0, 30)}`, CARD_W - MARGIN, 92);
    ctx.textAlign = "left";
  }

  // Hero stat: total watch time
  try {
    ctx.letterSpacing = "0px";
  } catch {
    /* cosmetic */
  }
  ctx.font = `700 96px ${FONT_SANS}`;
  ctx.fillStyle = "#f4f4f6";
  ctx.fillText(fmtDuration(opts.watchMs), MARGIN, 268);
  ctx.font = `500 17px ${FONT_SANS}`;
  ctx.fillStyle = "#8f929c";
  try {
    ctx.letterSpacing = "3px";
  } catch {
    /* cosmetic */
  }
  ctx.fillText("TOTAL WATCH TIME", MARGIN, 302);
  try {
    ctx.letterSpacing = "0px";
  } catch {
    /* cosmetic */
  }

  // Secondary stat blocks
  const blocks: { value: string; label: string }[] = [
    { value: String(opts.movies), label: "MOVIES" },
    { value: String(opts.episodes), label: "EPISODES" },
    { value: String(opts.activeDays), label: "ACTIVE DAYS" },
  ];
  blocks.forEach((b, i) => {
    const bx = MARGIN + i * 250;
    ctx.font = `700 38px ${FONT_SANS}`;
    ctx.fillStyle = "#f4f4f6";
    ctx.fillText(b.value, bx, 412);
    ctx.font = `500 13px ${FONT_SANS}`;
    ctx.fillStyle = "#8f929c";
    try {
      ctx.letterSpacing = "2px";
    } catch {
      /* cosmetic */
    }
    ctx.fillText(b.label, bx, 438);
    try {
      ctx.letterSpacing = "0px";
    } catch {
      /* cosmetic */
    }
  });

  // Top 3 titles with rounded posters
  const titles = opts.topTitles.slice(0, 3);
  const pw = 104;
  const ph = 156;
  const gap = 28;
  titles.forEach((t, i) => {
    const px = MARGIN + i * (pw + gap);
    const py = 482;
    const img = images[i];
    if (img) {
      drawPosterImage(ctx, img, px, py, pw, ph, 12);
    } else {
      drawPosterPlaceholder(ctx, t.name.charAt(0) || "?", px, py, pw, ph, 12, accent);
    }
    const label = t.name.length > 24 ? `${t.name.slice(0, 23)}…` : t.name;
    ctx.font = `500 15px ${FONT_SANS}`;
    ctx.fillStyle = "#b8bac2";
    ctx.fillText(label, px, py + ph + 26);
  });

  // Footer
  ctx.font = `500 13px ${FONT_SANS}`;
  ctx.fillStyle = "#8f929c";
  ctx.textAlign = "right";
  ctx.fillText("horse — local stats · private by design", CARD_W - MARGIN, CARD_H - 30);
  ctx.textAlign = "left";
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => {
        if (b) resolve(b);
        else reject(new Error("canvas.toBlob returned null (likely a tainted canvas)"));
      }, "image/png");
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

function freshCanvas(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } | null {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  return { canvas, ctx };
}

export async function generateShareCard(opts: ShareCardOpts): Promise<Blob> {
  if (typeof document === "undefined") throw new Error("share card requires a browser document");
  const first = freshCanvas();
  if (!first) throw new Error("Canvas 2D unavailable");
  const accent = accentToRgb(opts.accent);
  const titles = opts.topTitles.slice(0, 3);

  // Best path: draw with posters (cross-origin routed via /api/proxy/raw → same-origin, no taint)
  const images = await Promise.all(titles.map((t) => (t.poster ? loadImage(t.poster) : Promise.resolve(null))));
  drawCard(first.ctx, opts, accent, images);

  let blob: Blob | null = null;
  try {
    blob = await toBlob(first.canvas);
  } catch (e) {
    console.warn("[share-card] toBlob threw (tainted canvas?) — retrying without posters", e);
  }

  // Anti-taint retry on a FRESH canvas (taint is permanent per canvas) with placeholders.
  if (!blob) {
    const retry = freshCanvas();
    if (!retry) throw new Error("Canvas 2D unavailable");
    drawCard(retry.ctx, opts, accent, titles.map(() => null));
    blob = await toBlob(retry.canvas);
  }
  return blob;
}
