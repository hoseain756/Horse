#!/usr/bin/env python3
"""Estimate WCAG contrast of text on a translucent glass surface.

The surface (rgba) is composited over each backdrop color, then the text color
(which may also be rgba) is composited over that result. Blur and saturation are
NOT modeled, so treat results as an estimate and confirm on the rendered page.

Usage:
  python contrast.py --text "#ffffff" --surface "rgba(255,255,255,0.12)" \
      --backdrop "#ffffff" "#000000" "#5eabcc"
  python contrast.py --text "rgb(11,27,34)" --surface "rgba(255,255,255,.45)" \
      --backdrop "#f4f4f4" "#2b7a99" --target 4.5

Accepted color formats: #rgb, #rrggbb, rgb(r,g,b), rgba(r,g,b,a).
Exit code is 1 if any backdrop fails the target.
"""
import argparse
import re
import sys


def parse_color(s):
    s = s.strip().lower()
    if s.startswith("#"):
        h = s[1:]
        if len(h) == 3:
            h = "".join(c * 2 for c in h)
        if len(h) != 6:
            raise ValueError(f"bad hex color: {s}")
        return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16), 1.0
    m = re.match(r"rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+%?))?\s*\)", s)
    if not m:
        raise ValueError(f"unsupported color: {s}")
    r, g, b = (float(m.group(i)) for i in (1, 2, 3))
    a = 1.0
    if m.group(4):
        a = float(m.group(4)[:-1]) / 100 if m.group(4).endswith("%") else float(m.group(4))
    return r, g, b, a


def over(fg, bg):
    """Composite fg (r,g,b,a) over an opaque bg (r,g,b)."""
    r, g, b, a = fg
    return tuple(a * c + (1 - a) * d for c, d in zip((r, g, b), bg[:3]))


def lum(rgb):
    def ch(c):
        c = c / 255
        return c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4
    r, g, b = (ch(c) for c in rgb)
    return 0.2126 * r + 0.7152 * g + 0.0722 * b


def ratio(a, b):
    la, lb = lum(a), lum(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--text", required=True, help="text/icon color")
    p.add_argument("--surface", required=True, help="glass fill color, usually rgba")
    p.add_argument("--backdrop", nargs="+", required=True, help="one or more worst-case backdrop colors")
    p.add_argument("--target", type=float, default=4.5, help="required ratio (4.5 text, 3 large text/UI)")
    args = p.parse_args()

    text = parse_color(args.text)
    surface = parse_color(args.surface)
    failed = False
    print(f"{'backdrop':<14}{'effective surface':<22}{'ratio':>7}  result (target {args.target}:1)")
    for bd in args.backdrop:
        b = parse_color(bd)
        base = b[:3]
        eff = over(surface, base)
        txt = over(text, eff)
        r = ratio(txt, eff)
        ok = r >= args.target
        failed = failed or not ok
        eff_s = "#%02x%02x%02x" % tuple(round(c) for c in eff)
        print(f"{bd:<14}{eff_s:<22}{r:>7.2f}  {'PASS' if ok else 'FAIL'}")
    if failed:
        print("\nAt least one backdrop fails: raise surface alpha, change tint, add a scrim, or change text color.")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    main()
