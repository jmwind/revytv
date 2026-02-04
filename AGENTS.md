# AGENTS.md

Context for AI agents working on this codebase.

## Project Overview

Real-time dashboard for Revelstoke Mountain Resort. Shows weather, snow reports, forecasts with historical tracking, and live webcams.

**Stack:** Vanilla HTML/CSS/JS frontend + Vercel serverless functions + Upstash Redis

## Running Locally

```bash
vercel dev
```

Opens at http://localhost:3000. Vercel CLI pulls environment variables (Upstash credentials) automatically.

## File Structure

```
├── index.html           # Main dashboard (two modes: default + TV)
├── calendar.html        # Forecast history calendar
├── app.js               # Dashboard logic, DOM updates, sparklines
├── calendar.js          # Calendar rendering, year navigation
├── styles.css           # All styles (dark theme, responsive)
├── api/
│   ├── snow-report.js   # Main API - fetches resort data, tracks history
│   ├── calendar-data.js # Returns all historical forecast data
│   └── lib/
│       └── storage.js   # Upstash Redis abstraction
└── data/
    └── forecast-history.json  # Local fallback (not used with Upstash)
```

## Architecture

### Data Flow

1. **Frontend** calls `/api/snow-report`
2. **snow-report.js** fetches HTML from revelstokemountainresort.com
3. Parses weather/snow/forecast data via regex
4. Stores forecast history in **Upstash Redis** (tracks changes over time)
5. Returns JSON with current data + history arrays
6. **Frontend** renders data with sparklines showing forecast trends

### API Endpoints

- `GET /api/snow-report` - Current conditions + forecast with history
- `GET /api/calendar-data?year=2026` - All historical data for calendar view

### View Modes

- `/` - Dashboard with webcams, weather, forecast cards, snow stats
- `/?tv` - TV mode: YouTube background, webcams on sides, ticker at bottom
- `/calendar.html` - Year calendar showing forecast change history

## Key Patterns

### DOM Elements

All DOM refs cached in `elements` object in app.js. Add new elements there.

### Sparklines

Generated via `generateSparkline(history, width, height)` in app.js. Returns SVG string. Color based on delta (green=up, red=down, blue=unchanged).

### Forecast History

Each forecast day stores an array of historical predictions:
```javascript
{
  date: "2026-02-04",
  history: [
    { firstSeen: "2026-01-28T...", amount: 5, freezingLevel: 1400 },
    { firstSeen: "2026-01-29T...", amount: 8, freezingLevel: 1200 },
    // ... more entries as forecast changes
  ]
}
```

Delta = last amount - first amount (how much the forecast changed).

### Storage Keys

Redis keys follow pattern: `forecast:YYYY-MM-DD` or `forecast:YYYY-MM-DD:night`

### Regex Parsing

Weather/snow data extracted via regex in `parseSnowReport()` and `extractForecast()` in snow-report.js. If resort changes HTML structure, these patterns need updating.

### Cache Busting

- Webcam images: append `?t=${Date.now()}`
- CSS/JS files: version query params in HTML (`styles.css?v=28`)

## Styling Conventions

- Dark theme: `#1a1a1a` background, `#2d2d2d` cards, `#4a9eff` accent
- Colors: green `#4ade80` (up), red `#f87171` (down), blue `#4a9eff` (unchanged)
- Responsive breakpoints at 768px, 1024px, 1920px, 2560px

## Configuration

In `app.js` CONFIG object:
- `snowReportApi` - API endpoint
- `webcams` - Webcam URL mapping
- `refreshInterval` - Auto-refresh (default 10 min)
- `videoPlaylist` - YouTube videos for TV mode
