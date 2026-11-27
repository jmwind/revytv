# DESIGN.md — Truflake

The visual system of Truflake, as built. World: a ski-touring guidebook page (Rogers Pass
Uptracks, Summits & Icefields): matte paper, black type, one route ink, compact stat blocks,
elevation profiles. Operate surfaces (dashboard, seasons, calendar) keep standard web
controls; the world contributes type, palette, density, and one signature move.

## Tokens

Defined in `app/actions/public/app.css`; every colour is `light-dark()` so both schemes come
from one token.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--paper` | #f4f4f0 | #0f141c | page ground |
| `--panel` | #ffffff | #161c26 | panels, tables |
| `--panel-2` | #f7f7f3 | #1b2230 | hover rows, calendar cells |
| `--ink` | #15181c | #e8ebef | text, strong rules |
| `--ink-2` | #4a5058 | #a3abb8 | labels, secondary text (≥ 4.5:1) |
| `--ink-3` | #6f7682 | #7c8594 | muted captions, axis labels (large/secondary only) |
| `--rule` | #d9dbd4 | #2a3240 | panel borders, hairline seams |
| `--rule-2` | #e8e9e3 | #1f2633 | row dividers, chart grid |
| `--route` | #1d4fd8 | #7aa2ff | the one accent: this season, links, selection, freezing line |
| `--route-soft` | #e7edfc | #1c2a4a | selected/shaded fills |
| `--up` / `--down` | #1a7f4b / #c2311f | #5fd39a / #ff7b6b | forecast rose / fell; always paired with an arrow or sign |
| `--warn` | #a8690f | #f0b84a | unavailable-data notices |

Radii: `--radius-s` 2px (controls, chips, cells), `--radius-m` 8px (panels). No shadows:
elevation is a 1px hairline (`--rule`) and, for selection, an inset 2px route-ink line.
Dialog backdrops use `--scrim` with a 2px blur; TV overlays sit on a bottom gradient scrim,
never in boxes.

## Type

One family, Barlow (Google Fonts): 400 body, 500 labels, 600 headings and figures, 700 unused.
Barlow Semi Condensed 600 carries large figures and dense numeric cells (stat table values,
forecast amounts, chart readouts). `font-variant-numeric: tabular-nums` on `body`.

Fixed rem-ish scale in px: 11 (axis, captions), 12 (meta), 13 (labels, table body), 14 (body),
15 (panel titles), 17 (brand), 19 (section headings), 23, 28 (forecast amount), 34 (page titles,
season figure), 41 (About h1), 56 (seasons-page figure), 72 (new-snow figure). Headings track
-0.015em to -0.03em, never beyond. Measure on Read pages is 68ch.

## Layout

Page container `min(100%, 1440px)` with `clamp(16px, 2.5vw, 32px)` gutters. Section headings sit
on a 1px `--ink` rule (`.section-head`), 28px above, 10px below, 16px before content. Panels are
`.panel` (ground `--panel`, hairline border, 8px radius). Panels never nest.

Home grid: stats block 1.55fr, season panel 1fr, collapsing to one column under 980px. The
forecast strip is a 72px gutter plus one equal column per day; under 900px it scrolls
horizontally with snap. Cameras are a 4-up (2-up under 900px) grid separated by 1px of `--rule`.

## Signature move

Freezing level drawn against the resort's elevations: a profile strip under the ten-day
forecast with hairlines at 2225 Summit, 1950 Ripper, 1713 Top Gon, 800 Mid Gon, 512 Village.
Each day's column shades `--route-soft` from the top down to its freezing level and marks the
level with a 2px `--route` line; "valley bottom" shades the whole column.

Historical ranges are hatched (45° 1px `--ink-3` lines at 55% opacity, 6px pitch) with a
`--rule` outline; the mean is a dashed `--ink-2` line; the current season is `--route` at 2–2.5px
with a filled dot at today. Both the home mini-chart and the seasons page share the fixed
Nov 1 to Apr 20 axis so they register.

## Components

- Deltas: arrow glyph (drawn SVG) + absolute value, coloured `--up`/`--down`; unchanged shows
  "±0" in `--ink-3`. Revision sparklines use the same colours.
- Forecast day: a `<button>` with `aria-expanded`; selected state is `--route-soft` fill with a
  2px inset route line; details expand inline beneath the strip (no modal).
- Nav: brand mark in `--route`, links in `--ink-2`, current page underlined with a 2px route
  line via inset box-shadow.
- Tables: header row on a 1px `--ink` rule, body rows on `--rule-2`, numeric cells right-aligned
  in Barlow Semi Condensed 600.
- Webcam lightbox: native `<dialog>` with scrim backdrop.
- Icons: authored SVG, 1.75px stroke on a 24 grid, one weight; no emoji.
- Focus: 2px `--route` outline, 2px offset. Selection: `--route` on `--route-ink`.

## Motion

150–300ms, `cubic-bezier(0.16, 1, 0.3, 1)`. Only state changes animate: hover fills, image
fade-in when loaded, ticker scroll on TV (60s linear), summer quotes cross-fade. Reduced motion
collapses every transition.

## TV mode

Experience surface over full-bleed video: white text with a 1px text shadow on a bottom
gradient scrim, cameras in two side columns, forecast centred, ticker as a 40px dark band.
Sizes use `clamp()` against viewport width so a 4K living-room TV and a 1080p one both read.
