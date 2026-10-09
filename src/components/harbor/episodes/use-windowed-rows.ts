"use client";

// Harbor Web — lightweight windowing for the episodes section (list + grid).
//
// Design: the scroller hosts an absolutely-positioned body whose height is the
// prefix sum of row heights; only visible rows (+overscan) render. Row heights
// are estimated first (per-view estimate fn) and corrected by real
// measurements (getBoundingClientRect + ResizeObserver), so variable text
// heights (1- vs 2-line titles, optional story) are handled without layout
// thrash — measurements are rAF-coalesced and only re-anchor when a row
// actually changed by ≥1px.
//
// 1000+ episodes render ~10 rows of DOM, flat memory, instant season/sort/
// view switches (resetKey clears measurements; the section re-anchors the
// previously-visible item via scrollToItem when toggling views).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const INITIAL_WINDOW = 10;
const REFINE_MS = 600;

export type WindowedRowsApi = {
  /** Attach to the scrollable element. */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** Attach to the inner absolutely-positioned body. */
  bodyRef: React.RefObject<HTMLDivElement | null>;
  /** Measured scroller width (prop-fed; 0 before first observation). */
  containerW: number;
  /** Total height of the virtualized body (px). */
  spacerH: number;
  /** Y offset of a row inside the body (measured-or-estimated prefix). */
  rowTop: (row: number) => number;
  /** Inclusive rendered row window. */
  startRow: number;
  endRow: number;
  rowCount: number;
  /** The current reset key (season/sort/view identity). */
  resetKey: string;
  /** Callback-ref factory: `ref={registerRow(row)}` on each row wrapper. */
  registerRow: (row: number) => (el: HTMLElement | null) => void;
  /** Scroll so the given ITEM index is at the top of the viewport. */
  scrollToItem: (itemIndex: number) => void;
  /** First visible ITEM index (row start). */
  firstVisibleItem: () => number;
};

export function useWindowedRows(opts: {
  count: number;
  cols: number;
  /** Measured scroller width, owned by the caller (drives cols/estimates). */
  containerW: number;
  /** Shared scroller ref — the caller attaches it to the scrollable div. */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** Estimated row height before measurement lands. */
  estimateRowH: (cols: number, containerW: number) => number;
  overscan?: number;
  /** Change → drop measurements + jump to top (season / sort / view switch). */
  resetKey: string;
}): WindowedRowsApi {
  const { count, cols, containerW, scrollRef, estimateRowH, overscan = 4, resetKey } = opts;
  const safeCols = Math.max(1, cols);

  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [heights, setHeights] = useState<number[]>([]);
  const [startRow, setStartRow] = useState(0);
  const [endRow, setEndRow] = useState(INITIAL_WINDOW - 1);
  const rowElsRef = useRef(new Map<number, HTMLElement>());
  const scrollRafRef = useRef(0);
  const measureRafRef = useRef(0);
  const rowRORef = useRef<ResizeObserver | null>(null);
  const pendingRefineRef = useRef<number | null>(null);
  const refineUntilRef = useRef(0);

  const rowCount = count > 0 ? Math.ceil(count / safeCols) : 0;
  const estimate = estimateRowH(safeCols, containerW);

  // Prefix sums (tops[i] = top of row i). Recomputed when measurements land.
  const tops = useMemo(() => {
    const arr = new Array<number>(rowCount + 1);
    arr[0] = 0;
    for (let i = 0; i < rowCount; i++) {
      const measured = heights[i];
      arr[i + 1] = arr[i] + (Number.isFinite(measured) ? (measured as number) : estimate);
    }
    return arr;
  }, [rowCount, estimate, heights]);
  const spacerH = tops[rowCount] ?? 0;

  const rowAtOffset = useCallback(
    (offset: number): number => {
      let lo = 0;
      let hi = rowCount - 1;
      let ans = 0;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (tops[mid] <= offset) {
          ans = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      return ans;
    },
    [tops, rowCount],
  );

  const scheduleMeasure = useCallback(() => {
    if (measureRafRef.current) return;
    measureRafRef.current = requestAnimationFrame(() => {
      measureRafRef.current = 0;
      // Measure OUTSIDE the state updater (DOM reads are impure); the updater
      // itself stays pure. Unmeasured rows keep NaN → tops falls back to the
      // estimate for them.
      const measured = new Map<number, number>();
      for (const [row, el] of rowElsRef.current) {
        const h = Math.round(el.getBoundingClientRect().height);
        if (h > 0) measured.set(row, h);
      }
      if (measured.size === 0) return;
      setHeights((prev) => {
        let changed = false;
        const out = prev.slice(0, rowCount);
        while (out.length < rowCount) out.push(Number.NaN);
        for (const [row, h] of measured) {
          const cur = out[row];
          if (!(Number.isFinite(cur) && Math.abs(cur - h) < 1)) {
            out[row] = h;
            changed = true;
          }
        }
        return changed ? out : prev;
      });
    });
  }, [rowCount]);

  const registerRow = useCallback(
    (row: number) =>
      (el: HTMLElement | null) => {
        if (el) {
          rowElsRef.current.set(row, el);
          rowRORef.current?.observe(el);
          scheduleMeasure();
        } else {
          rowElsRef.current.delete(row);
        }
      },
    [scheduleMeasure],
  );

  const recomputeWindow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const viewport = el.clientHeight || 1;
    const first = rowAtOffset(el.scrollTop);
    const last = rowAtOffset(el.scrollTop + viewport);
    setStartRow(Math.max(0, first - overscan));
    setEndRow(Math.min(Math.max(0, rowCount - 1), last + overscan));
  }, [overscan, rowCount, rowAtOffset, scrollRef]);

  const handleScroll = useCallback(() => {
    if (scrollRafRef.current) return;
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = 0;
      recomputeWindow();
    });
  }, [recomputeWindow]);

  const scrollToItem = useCallback(
    (itemIndex: number) => {
      const el = scrollRef.current;
      if (!el) return;
      const row = Math.min(rowCount - 1, Math.max(0, Math.floor(itemIndex / safeCols)));
      el.scrollTop = tops[row] ?? 0;
      pendingRefineRef.current = itemIndex;
      refineUntilRef.current = Date.now() + REFINE_MS;
      recomputeWindow();
    },
    [recomputeWindow, rowCount, safeCols, tops, scrollRef],
  );

  const firstVisibleItem = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return 0;
    return rowAtOffset(el.scrollTop) * safeCols;
  }, [rowAtOffset, safeCols, scrollRef]);

  // Own a shared row RO (rows register before effects run, so observe the
  // already-registered ones here too).
  useEffect(() => {
    rowRORef.current = new ResizeObserver(() => scheduleMeasure());
    for (const el of rowElsRef.current.values()) rowRORef.current.observe(el);
    return () => {
      rowRORef.current?.disconnect();
      if (measureRafRef.current) cancelAnimationFrame(measureRafRef.current);
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
      rowRORef.current = null;
    };
  }, [scheduleMeasure]);

  // Scroll listener (recompute window on scroll).
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.addEventListener("scroll", handleScroll, { passive: true });
    return () => el.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  // First window + refresh when counts change.
  useEffect(() => {
    recomputeWindow();
  }, [recomputeWindow]);

  // One-shot refinement right after a programmatic anchor (view toggle):
  // the first jump used estimates — snap to the measured layout once, inside
  // the small time window.
  useEffect(() => {
    const refine = pendingRefineRef.current;
    if (refine == null) return;
    if (Date.now() < refineUntilRef.current) {
      const el = scrollRef.current;
      if (el) {
        const row = Math.min(rowCount - 1, Math.max(0, Math.floor(refine / safeCols)));
        el.scrollTop = tops[row] ?? 0;
      }
    } else {
      pendingRefineRef.current = null;
    }
  }, [heights, tops, rowCount, safeCols, scrollRef]);

  // Season / sort / view switch — the official render-phase adjustment
  // pattern: when resetKey changes, drop measurements and collapse the
  // window DURING render (no cascading effect renders).
  const [prevResetKey, setPrevResetKey] = useState(resetKey);
  if (prevResetKey !== resetKey) {
    setPrevResetKey(resetKey);
    setHeights([]);
    setStartRow(0);
    setEndRow(INITIAL_WINDOW - 1);
  }
  // DOM side of the reset (jump to top, drop any pending anchor refinement)
  // belongs in an effect — external system, no setState.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = 0;
    pendingRefineRef.current = null;
  }, [resetKey, scrollRef]);

  const rowTop = useCallback((row: number) => tops[row] ?? 0, [tops]);

  return {
    scrollRef,
    bodyRef,
    containerW,
    spacerH,
    rowTop,
    startRow,
    endRow,
    rowCount,
    resetKey,
    registerRow,
    scrollToItem,
    firstVisibleItem,
  };
}
