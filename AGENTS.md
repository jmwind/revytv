# AGENTS.md

Context for AI agents working on this codebase.

## Project

Truflake ("Revy Snow for Nerds"): a Remix v3 dashboard for Revelstoke Mountain Resort snow
conditions. See README.md for pages, commands, and the file map; PRODUCT.md for product truth;
DESIGN.md for the visual system; `.impeccable/surfaces/` for the home page's direction contract.

## Stack and conventions

- Remix v3 (`remix` 3.3.0), TypeScript strict with `noUncheckedIndexedAccess`, Node 24.3+.
  Relative imports keep their `.ts`/`.tsx` extensions. No React: components are
  `(handle) => () => JSX`; state is a plain variable plus `handle.update()`.
- Browser code lives only under `public/` directories (`app/actions/public`, `app/ui/public`).
  A hydrated component is `clientEntry(import.meta.url, function Name(...) {...})` and may only
  import other `public/` modules or the `remix` package. Its props must be JSON-serializable.
- Server-only code lives in `app/server/`. Page actions load data there and pass plain objects to
  page components.
- Styling: tokens in `app/actions/public/app.css` (`--paper`, `--panel`, `--ink`, `--route`, `--up`,
  `--down`, hairline `--rule`); component styles via `css()` from `remix/component`, scoped with
  nested selectors. Light and dark both come from `light-dark()`; never hardcode a scheme colour.
- Tests: `remix test` runs `test/**/*.test.ts` with `remix/test` and `remix/assert`. Parsers are
  tested against HTML fixtures in `test/fixtures/`; refresh a fixture when the resort's markup
  changes and the regexes in `app/server/snow-report.ts` or `historical.ts` need updating.
- Run `npm run typecheck` and `npm test` before finishing.

## Data model

Redis keys (unchanged from the original site so history carries over):

- `forecast:YYYY-MM-DD`, `forecast:YYYY-MM-DD:day`, `forecast:YYYY-MM-DD:night` — a record with
  `history: [{ firstSeen, amount, freezingLevel }]`, appended only when the forecast changes.
- `snowfall:YYYY-MM-DD` — `{ date, seasonTotal, recordedAt }`, first reading of the day.
- `newsnow:YYYY-MM-DD` — `{ date, newSnow, recordedAt }`, high-water mark for the day.
- `snow-report:cache` — the parsed report, 10-minute TTL.
- `historical:snowfall` — the parsed historical tracker with `fetchedAt`; refetched after 12 hours.

Day names map to dates in document order (`assignForecastDates`): "Today"/"Tonight" are the
resort-local date; each weekday takes the next date on or after the running cursor. The resort's
historical series are index-aligned to Nov 1 and the current season's array can run ahead of the
calendar, so "today" is anchored on the live season total and our own dated `snowfall:` records.

## Gotchas

- The asset server compiles on request and reads source from disk, which is why `vercel.json`
  ships `app/**` and the Remix packages verbatim and `api/index.js` imports the router dynamically.
- `handle.update()` throws during server rendering; browser-only work goes in `handle.queueTask`
  or event handlers.
- Windy and YouTube are third-party scripts rendered as plain `<script>` tags; they are not
  modules and cannot be imported.

## Session learnings

Read `.agent/` before starting; it holds retros from earlier sessions.
