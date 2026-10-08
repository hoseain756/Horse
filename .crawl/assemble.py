import json, os, re, datetime

def load(name):
    raw = open(f".crawl/{name}.json").read().strip()
    d = json.loads(json.loads(raw)) if raw.startswith('"') else json.loads(raw)
    return d["lines"]

GLOBAL_PREFIXES = (
    '[nav \u201cPrimary navigation\u201d]', '- [tab] Settings', '- [tab] Kids',
    '- [tab] Anime', '- [tab] Home', '[footer]', '- Horse \u2014 an open-source media center',
    '- Inspired by the Harbor desktop app', '- TMDBThis product uses the TMDB API',
    '- input (placeholder: Search\u2026; label: Search movies, series, people and addons)',
)
def strip_global(lines, extra=()):
    out = []
    for l in lines:
        if any(l.startswith(p) for p in GLOBAL_PREFIXES + extra):
            continue
        out.append(l)
    return out

HUB_CHROME = ('[nav \u201cBreadcrumb\u201d]', '- [button] Settings', '## Settings', '- [tab] Basics',
              '- [tab] Player', '- [tab] Theme', '- [tab] Language', '- [tab] Integrations',
              '- [tab] Data', '- [tab] About', '- [cards x9] under \u201cQuick Access', '- [button] Sign in')

def page(title, lines, note=None):
    s = [f"\n## {title}\n"]
    if note: s.append(f"*{note}*\n")
    s.extend(lines)
    return s

doc = []
doc.append("# Horse \u2014 Complete Website Text Content")
doc.append("")
doc.append("> Extracted for content review and translation. Source: `http://localhost:3000` (the Horse web app, rendered SPA), captured with a real browser at 1280\u00d7800, EN / dark / LTR. Every page below reflects the actual rendered DOM in visual order.")
doc.append(f"> Generated: {datetime.date.today().isoformat()} \u00b7 Method: DOM walk (headings \u2192 controls \u2192 text), repeated poster-card groups compressed into one-line data samples.")
doc.append("")
doc.append("**Conventions:** `##`/`###` = page & section headings \u00b7 `[button]`/`[link]`/`[tab]` = interactive controls \u00b7 `chip:` = small pill labels \u00b7 `[cards xN] under \u2026` = **dynamic catalog data** (poster rows; titles are content, not UI strings) \u00b7 `(aria: \u2026)` = accessibility labels.")
doc.append("")
toc = ["## Table of contents", "",
 "1. Global chrome (persists on every page)",
 "2. Home",
 "3. Discover", "4. Movies", "5. Shows", "6. Anime", "7. Kids", "8. Live TV", "9. Calendar",
 "10. Library", "11. Addons", "12. Catalogs", "13. Wrapped",
 "14. Settings \u2014 Basics \u00b7 Player \u00b7 Theme \u00b7 Language \u00b7 Integrations \u00b7 Data \u00b7 About",
 "15. Sign in to Stremio (modal)", "16. Search (docked dropdown + full-screen view)",
 "17. Title details \u2014 Movie", "18. Title details \u2014 Series (with Episodes)",
 "19. Stream picker (dialog)", "20. Add-to-list popover", "21. Player controls (dialog)", ""]
doc.extend(toc)

# 1. global chrome
g = load("01-home")
nav = [l for l in g if l.startswith(('[nav \u201cPrimary navigation\u201d]', '- [tab] '))]
search = [l for l in g if l.startswith('- input (placeholder: Search\u2026')]
foot = [l for l in g if l.startswith(('[footer]', '- Horse \u2014 an open-source', '- Inspired by')) or l.startswith('- TMDBThis product uses the TMDB API')]
hero_btns = [l for l in g if 'Go to slide' in l or 'Pause autoplay' in l]
doc.extend(page("Global chrome (persists on every page)", nav + search +
  ["- [button] AI  *(AI ask, inside the search bar)*"] + foot,
  "Shown on every view: navigation tabs, the search bar, and the footer."))
doc.append("")

# 2. home rest
home_rest = strip_global(g)
home_rest = [l for l in home_rest if l not in foot and not l.startswith('- [button] AI') and not l.startswith('- [tab] ')]
home_rest = [l for l in home_rest if 'Pause autoplay' not in l]
doc.extend(page("Home", home_rest))
doc.append("")

# 3-13. hub pages
for f, name in [("05-hub-discover","Discover"),("05-hub-movies","Movies"),("05-hub-shows","Shows"),
                ("02-anime","Anime"),("03-kids","Kids"),("05-hub-live-tv","Live TV"),
                ("05-hub-calendar","Calendar"),("05-hub-library","Library"),
                ("05-hub-addons","Addons"),("05-hub-catalogs","Catalogs"),("05-hub-wrapped","Wrapped")]:
    lines = strip_global(load(f))
    lines = [l for l in lines if not any(l.startswith(p) for p in HUB_CHROME)]
    if name == "Anime": lines = [l for l in lines if l != '- [button] Back']
    doc.extend(page(name, lines))
    doc.append("")

# 14. settings
sec_names = {"basics":"Basics","player":"Player","theme":"Theme","language":"Language",
             "integrations":"Integrations","data":"Data","about":"About"}
first = True
for sid, nm in sec_names.items():
    lines = strip_global(load(f"04-settings-{sid}"))
    lines = [l for l in lines if not any(l.startswith(p) for p in HUB_CHROME) and not l.startswith('- [cards x')]
    if not first:
        lines = [l for l in lines if not l.startswith('### Quick Access') and not l.startswith('- Everything that used to live')]
    title = f"Settings \u2014 {nm}"
    doc.extend(page(title, lines))
    doc.append("")
    first = False

# 15. sign-in modal
doc.extend(page("Sign in to Stremio (modal)", strip_global(load("12-account")),
  "Opened from the Sign in button in Settings."))
doc.append("")

# 16. search
drop = strip_global(load("10-search"))
full = strip_global(load("10b-search-full"))
drop_x = [l for l in drop if l.startswith(('- [option]', '- Movies', '- Series', '- [button] AI', '- [button] Clear search', '- [button] See all')) or 'See all results' in l]
full_x = [l for l in full if l.startswith(('- [button] AI', '- [button] Clear search', '- Trending now', '- [cards x8]')) or l.startswith('- [cards x8] under \u201cTrending now')]
doc.extend(page("Search", 
  ["**State A \u2014 docked dropdown (desktop, after typing a query):**"] + drop_x +
  ["", "**State B \u2014 full-screen search view:**"] + full_x +
  ["", "*(idle state additionally shows the Horse logo + wordmark lockup; back and clear buttons; the same overlay doubles as the command palette via `/` or Ctrl/Cmd+K; results grouped Movies / Series)*"],
  "Two captured states, query = \u201cbatman\u201d."))
doc.append("")

# 17-18. details
doc.extend(page("Title details \u2014 Movie", strip_global(load("06-detail-movie")),
  "Example: \u201cAvengers: Endgame\u201d. Hero order: title logo \u2192 meta chips \u2192 ratings \u2192 description \u2192 actions."))
doc.append("")
doc.extend(page("Title details \u2014 Series (with Episodes)", strip_global(load("07-detail-series")),
  "Example: \u201cBreaking Bad\u201d."))
doc.append("")

# 19. picker
doc.extend(page("Stream picker (dialog)", strip_global(load("08-picker")),
  "No addons installed in this environment, so no stream rows \u2014 filters and actions are the stable UI. With addons, rows list quality/size/source per stream."))
doc.append("")

# 20. add-to-list
doc.extend(page("Add-to-list popover", [
  "- No lists yet \u2014 create your first one below.",
  "- [button] New list",
], "Opens from the Add to list button on a title details page; with existing lists it shows them as checkable rows."))
doc.append("")

# 21. player
doc.extend(page("Player controls (dialog)", strip_global(load("09-player")),
  "Control bar auto-shows on pointer move. Time display toggles between elapsed and remaining; shows \u201clength unknown\u201d when a stream hides its duration."))
doc.append("")

doc.append("---")
doc.append("*End of extraction \u2014 21 sections. Dynamic catalog rows (titles/years/ratings) change with the installed addons and Stremio/TMDB catalogs; all UI strings above are stable.*")

out = "\n".join(doc)
open("website-content.md", "w").write(out)
print("written", len(out), "chars,", out.count("\n"), "lines")
