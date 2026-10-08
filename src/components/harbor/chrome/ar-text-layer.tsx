"use client";

// Harbor Web — ArabicTextLayer
// When the UI language is Arabic, walks the live DOM and swaps user-facing
// strings using the approved EN→AR dictionary (ar-text.ts). A MutationObserver
// keeps React re-renders, toasts, portals and late data translated. Switching
// back to English restores every original string byte-for-byte.
//
// Safety: exact full-node matching only — titles, addon names and anything the
// user types are never in the dictionary, so they can never be altered.
// Opt-outs: add data-no-ar (or translate="no") on any subtree.

import { useEffect } from "react";
import { useSettings } from "@/lib/harbor/store";
import { isArabic } from "@/lib/harbor/i18n";
import {
  translateSubtree,
  restoreSubtree,
  translateTextNode,
  translateElementAttrs,
  translateSplitRuns,
} from "@/lib/harbor/ar-text";

export function ArabicTextLayer() {
  const uiLanguage = useSettings((s) => s.settings.uiLanguage);
  const loaded = useSettings((s) => s.loaded);
  const ar = isArabic(uiLanguage);

  useEffect(() => {
    if (!loaded) return;

    if (!ar) {
      restoreSubtree(document);
      return;
    }

    // Initial pass over everything already mounted
    translateSubtree(document);

    const pending: MutationRecord[] = [];
    let queued = false;

    const process = () => {
      queued = false;
      const batch = pending.splice(0, pending.length);
      for (const m of batch) {
        if (m.type === "characterData") {
          const t = m.target as Text;
          translateTextNode(t);
          if (t.parentElement) translateSplitRuns(t.parentElement);
        } else if (m.type === "attributes") {
          translateElementAttrs(m.target as Element);
        } else if (m.type === "childList") {
          m.addedNodes.forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
              translateTextNode(node as Text);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
              translateSubtree(node as Element);
            }
          });
          // removed nodes: nothing to do (their originals die with them)
        }
      }
    };

    const mo = new MutationObserver((muts) => {
      pending.push(...muts);
      if (!queued) {
        queued = true;
        requestAnimationFrame(process);
      }
    });
    mo.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "title", "aria-label", "aria-description"],
    });

    return () => {
      mo.disconnect();
      restoreSubtree(document);
    };
  }, [ar, loaded]);

  return null;
}
