(() => {
  const out = [];
  const lineCounts = new Map();
  const emit = (s) => {
    const c = lineCounts.get(s) || 0;
    lineCounts.set(s, c + 1);
    if (c < 4) out.push(s);
    else if (c === 4) out.push(s + " …(repeats)");
  };
  const vis = (el) => {
    if (!el || el.closest('[aria-hidden="true"]')) return false;
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    const cs = getComputedStyle(el);
    return cs.display !== "none" && cs.visibility !== "hidden" && cs.opacity !== "0";
  };
  const clean = (s) => (s || "").replace(/\s+/g, " ").trim();
  const root = document.body;
  const handled = new WeakSet();

  // Repeat-group compression: containers with >=8 same-shaped children
  root.querySelectorAll("*").forEach((el) => {
    if (!vis(el)) return;
    const kids = [...el.children].filter((k) => vis(k));
    if (kids.length >= 5) {
      const sig = kids[0].tagName + "." + kids[0].className;
      if (kids.every((k) => k.tagName + "." + k.className === sig) && clean(el.textContent).length > 120) {
        const label = el.getAttribute("aria-label") || (el.previousElementSibling ? clean(el.previousElementSibling.textContent).slice(0, 60) : "") || "";
        const strip = (t) => t
          .replace(/(?:19|20)\d\d[–-]?/g, "")
          .replace(/\d\.\d/g, "")
          .replace(/^\d{1,2}(?=[A-Z\u0600-\u06FF])/, "")
          .replace(/\s+/g, " ").trim();
        const items = [...new Set(kids.slice(0, 14).map((k) => strip(clean(k.textContent))).filter((t) => t && t.length > 1))];
        emit("- [cards x" + kids.length + "]" + (label ? " under “" + label + "”" : "") + ": " + items.join(" | ") + (kids.length > 14 ? " | …" : ""));
        kids.forEach((k) => handled.add(k));
      }
    }
  });

  // Ordered walk of meaningful elements
  const sel = 'h1,h2,h3,h4,h5,h6,p,button,a,label,li,input,textarea,select,.md-chip,[role="button"],[role="tab"],[role="menuitem"],[role="option"],[role="dialog"],section[aria-label],nav[aria-label],header[aria-label],footer,td,th,summary';
  root.querySelectorAll(sel).forEach((el) => {
    if (!vis(el)) return;
    for (let a = el; a && a !== document.body; a = a.parentElement) { if (handled.has(a)) return; }
    const tag = el.tagName.toLowerCase();
    const role = el.getAttribute("role");
    if (tag === "select") {
      const opts = [...el.options].map((o) => clean(o.textContent)).filter(Boolean);
      emit("- select" + (el.getAttribute("aria-label") ? " (“" + el.getAttribute("aria-label") + "”)" : "") + ": " + opts.join(" | "));
      return;
    }
    if (tag === "input" || tag === "textarea") {
      const parts = [];
      if (el.placeholder) parts.push("placeholder: " + el.placeholder);
      if (el.getAttribute("aria-label")) parts.push("label: " + el.getAttribute("aria-label"));
      emit("- input" + (parts.length ? " (" + parts.join("; ") + ")" : ""));
      return;
    }
    const txt = clean(el.textContent);
    const al = clean(el.getAttribute("aria-label"));
    let name = txt || al;
    if (!name) return;
    // avoid duplicating ancestors' text from children already emitted
    if (el.querySelector("h1,h2,h3,h4,h5,h6,button,a,p,label,li") && !al) {
      if (tag !== "footer" && !(tag === "section" || tag === "nav")) return;
    }
    const inter = tag === "button" || tag === "a" || role === "button" || role === "tab" || role === "menuitem" || role === "option";
    if (el.classList.contains("md-chip")) { emit("- chip: " + name); return; }
    if (/^h[1-6]$/.test(tag)) emit("#".repeat(+tag[1] + 1) + " " + name);
    else if (inter) emit("- [" + (tag === "a" ? "link" : role || "button") + "] " + name + (txt && al && txt !== al ? " (aria: " + al + ")" : ""));
    else if (tag === "p" || tag === "li" || tag === "label" || tag === "td" || tag === "th" || tag === "summary") emit("- " + name);
    else if (tag === "footer") emit("[footer] " + name.slice(0, 400));
    else if ((tag === "section" || tag === "nav" || tag === "header") && al) emit("[" + tag + " “" + al + "”]");
    else if (role === "dialog") emit("[dialog “" + (al || name.slice(0, 60)) + "”]");
    else if (al) emit("- [" + tag + " aria] " + name);
    else emit("- " + name.slice(0, 300));
  });
  return JSON.stringify({ state: location.hash || "#/", title: document.title, lines: out });
})()
