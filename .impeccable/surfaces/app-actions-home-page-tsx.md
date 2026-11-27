---
version: 1
slug: "app-actions-home-page-tsx"
primary_target: "app/actions/home-page.tsx"
related_targets: ["app/actions/tv-page.tsx","app/actions/history-page.tsx"]
---

# Surface: home dashboard (app/actions/home-page.tsx), with TV mode, history, calendar, about inheriting the world

Scope: full redesign of Truflake on Remix v3. Mode: Operate (home, history, calendar), Experience (TV mode over video), Read (About). Audience: Revelstoke snow nerds; owner's household on a wall TV. Task: see what fell, what is forecast and how it moved, what the cams show, how the season compares to 2007-08 onward. Constraint: info-rich, free, no accounts, must not read as a generic AI dashboard. Decision round skipped at the owner's instruction ("go ahead"); direction inferred from the brief and the roll.

## Direction contract

THESIS: A ski-touring guidebook page for today's mountain: the numbers set like a route's stat block, every forecast carrying how it moved, and freezing level drawn against the resort's own elevation profile. Refuses the glowing dark "trading floor" dashboard and the same-size icon-card grid.

OWN-WORLD: Matte cool-white paper ground (#f4f4f0) with white panels divided by 1px hairline seams, no shadows; ink #15181c; one route ink, cobalt (#1d4fd8), for the current season line, links, and selection; trend green/red kept for deltas with signed numbers and arrows. Dark scheme is midnight ink (#0f141c / #161c26) not grey, accent #7aa2ff. Type: Barlow for UI and body, Barlow Semi Condensed for dense stat labels and large figures, tabular numerals everywhere. Radii: 2px controls, 8px panels. Hatched fill for historical min-max bands. Raises: hairline seams and priority collapse (developer console), committed deep ground in dark (transit diagram), hatch for ranges (exposure sheets), one fixed shared Nov 1 to Apr 20 axis on mini and full charts (botanical folio), changed values stay marked in place (gate board), TV text on a scrim not in boxes (vertical feed).

STORY: Open, read today's snow and base in one row, see the season-so-far against the historical band with the mean and record years named, scan ten days of forecast with sparklines of revisions and the freezing line on the mountain, glance at four cams, then the Windy map. Click a day for its revision table; click the season panel for the full chart.

FIRST VIEWPORT (1440): top bar with snowflake mark, "Truflake", nav Now TV Seasons Calendar About, fetched time at right. Row one: left two-thirds, the snow stat block (New snow large, then Last hour, 24h, 48h, 7 days, Base, Season total as a hairline-ruled table with temperature, wind, condition beneath); right third, "This season vs. 18 others": a band chart (hatched range, dashed mean, cobalt current season) and three lines: today vs mean, record high year, record low year, rank. Row two begins: the 10-day forecast strip with the elevation cross-section under it. Primary action: none needed; the page is the answer.

FORM: ski-touring guidebook (Rogers Pass Uptracks / Summits & Icefields), candidate 5 of 7. seed:6db6652683fee961

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
