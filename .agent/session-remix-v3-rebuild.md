# Session: Remix v3 rebuild (Nov 2026)

## What happened
Rebuilt the vanilla HTML/JS site on Remix v3 (3.3.0), removed the Clerk paywall and user
settings, added the historical-season comparison, and redesigned the UI.

## Things worth knowing next time
- Remix v3 is not React and has no loaders: the controller action loads data and calls
  `context.render(<Page .../>)`. Components are `(handle) => () => JSX`; `handle.update()`
  re-renders and throws on the server, so browser work goes in `handle.queueTask` or `on()`.
- Browser modules must live under a `public/` directory and may only import other `public/`
  modules or allowed packages. A shared `icons.tsx` outside `public/` fails at request time
  with IMPORT_NOT_ALLOWED, not at typecheck. Keep anything a `clientEntry` imports in
  `app/ui/public/`.
- Remix needs Node >= 24.3. This machine's default nvm node is 22; use `nvm use 24`.
- Vercel: `@vercel/node` compiles any `.ts` it traces, which would break the on-demand asset
  server, so `api/index.js` dynamic-imports the router (untraced) and `vercel.json`
  `includeFiles` ships `app/**` and the Remix packages verbatim. `vercel build` locally
  validated the bundle; the files appear in `.vc-config.json`'s `filePathMap`, not copied.
- The resort's stale evening page lists "Tonight" then today's weekday; the old mapper sent
  that weekday a week out and polluted next week's history. `assignForecastDates` walks the
  names in order with a cursor instead.
- The resort's historical tracker series are index-aligned to Nov 1, and the current season's
  array can run ahead of the calendar. Anchor "today" on the live season total.
- The in-app browser's scrolled screenshots under an emulated viewport can come back blank or
  shrunken; `navigate` then screenshot is reliable, scrolling then screenshot is not.

## UX round two (2026-11-26)

- Page-level `css({ '& ul': ... })` on a `.page` wrapper also matches the nav's list and
  silently kills its `margin-left: auto`. Scope page prose styles under `& article`.
- Phones get the forecast as one row per period (no sideways scroll); the elevation profile
  is desktop-only and the freezing level reads as words ("snow from Top Gon up").
- Snow vs no-snow is the loudest signal on the page: green/red tint, top edge, amount colour.

## Current-season line (2026-11-26)

- The resort's historical tracker is not anchored to Nov 1 for the season in progress: on 26 Nov the 26-27 series already had 36 points (it counts from their first logging day). `alignResortSeries` slides such a series back so it ends today, or yesterday when the live season total is already higher. Completed seasons are untouched.
- Our own daily `snowfall:` records win over the resort's points, and the resort fills the days before we started recording (`mergeCurrentSeason`). Before this, one record of our own made the chart drop the resort's line and draw a single dot.

## Vercel deploy (2026-11-26)

- The function must ship `node_modules/**` (vercel.json includeFiles). nft only traces static imports; Remix's asset server loads platform binaries by dynamic require, resolves `@oxc-project/runtime` with `import.meta.resolve`, and walks the full dependency closure of `remix` for its access policy. Cherry-picking packages took three failed deploys; the whole folder is ~70 MB and works.
- `includeFiles` is one glob string capped at 256 characters.
- Preview URLs sit behind Vercel deployment protection: check them with `vercel curl <url>/<path>` and read crashes with `vercel logs --deployment <host> --json`.
