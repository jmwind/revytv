# Truflake — Revy Snow for Nerds

Live conditions dashboard for Revelstoke Mountain Resort: snow report, the 10-day alpine
forecast with every revision tracked, freezing level against the mountain's elevations,
webcams, the Windy snow map, and this season plotted against every season since 2007-08.
Free, no accounts.

## Pages

- `/` — the dashboard
- `/tv` — TV mode: muted ski video, cameras, forecast, ticker. Summer mode (May–Oct) switches to
  temperatures and bike videos; force it with `/tv?summer` or `/tv?winter`.
- `/history` — this season against the historical range, with every season toggleable
- `/calendar?year=2026` — a year of forecast revisions and what actually fell
- `/about` — the origin story
- JSON: `/api/snow-report`, `/api/historical`, `/api/historical?raw`, `/api/calendar-data?year=`, `/api/summer-forecast`

## Running locally

Node 24.3 or newer (`nvm use` reads `.nvmrc`).

```bash
npm install
npm run dev
```

Opens on http://localhost:3000. Without Upstash credentials the app stores data in
`data/forecast-history.json` and invents forecast history so sparklines have something to show.
To use the real store, put `KV_REST_API_URL` and `KV_REST_API_TOKEN` in `.env.local`
(`vercel env pull .env.local` fetches them); `npm run dev` loads that file if present.

```bash
npm test          # remix test: parsers, date mapping, historical comparison
npm run typecheck
```

## How it works

Remix v3. Each page is a controller action that loads data on the server and renders Remix
components; only the interactive parts hydrate (`clientEntry` components under `app/**/public/`).

```
server.ts                 Node entry (local)
api/index.js              Vercel entry: the same router as one function
app/routes.ts             route map
app/router.ts             middleware + controllers
app/assets.ts             asset server (compiles browser TS/CSS on demand)
app/actions/              page controllers and page components
app/ui/                   server-rendered components
app/ui/public/            hydrated components, shared browser code
app/server/               data: storage, snow report, historical, season, calendar, summer
test/                     remix tests + HTML fixtures
```

Data flow: `snow-report.ts` fetches the resort's snow report, parses it, assigns real dates to the
day names in order, and records every forecast change under `forecast:YYYY-MM-DD[:day|:night]`
in Upstash Redis, plus the daily season total (`snowfall:`) and new-snow high-water mark
(`newsnow:`). `historical.ts` scrapes the resort's historical snowfall tracker (an ECharts config
with one cumulative series per season), caches it under `historical:snowfall` for 12 hours, and
`summarizeSeason` computes the mean, range, rank, and pace for any day of the season.

## Deploying

Vercel. `vercel.json` rewrites every path to `api/index.js`, which registers the Remix TypeScript
loader and imports the app; `includeFiles` ships the `app/` sources and the Remix package so the
asset server can compile browser modules at runtime. Static files in `public/` are served by
Vercel directly. Push to `main` to deploy, or `vercel --prod`.
