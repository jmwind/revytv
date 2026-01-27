# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Project Overview

A lightweight dashboard for monitoring real-time conditions at Revelstoke Mountain Resort. Displays weather, snow reports, forecasts, and live webcam feeds. Built with vanilla HTML/CSS/JavaScript - no build tools or dependencies.

## Running the Project

Serve files with any HTTP server (required for CORS):

```bash
# Python 3
python -m http.server 8000

# Node.js (if http-server installed)
http-server -p 8000

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000`. Add `?tv` query param for TV mode (`http://localhost:8000?tv`).

## Architecture

### File Structure
- `index.html` - Two view modes: `.dashboard-view` (default) and `.video-view` (TV mode with YouTube embed + ticker)
- `app.js` - All application logic in a single file
- `styles.css` - Dark theme with responsive breakpoints for mobile through 4K TVs

### Data Flow
1. `fetchSnowReport()` fetches HTML from revelstokemountainresort.com via CORS proxies
2. `parseSnowReportHTML()` extracts weather/snow data using regex patterns on the raw HTML
3. `extractForecastData()` parses forecast by finding day headings and "Snow: X cm" patterns
4. `updateWebcams()` loads webcam images with cache-busting timestamps
5. Auto-refresh runs every 10 minutes via `CONFIG.refreshInterval`

### CORS Proxy Chain
The app tries multiple CORS proxies in order (in `CONFIG.corsProxies`) since free proxies can be unreliable. If direct fetch fails, it tries each proxy with retries before moving to the next.

### View Modes
- **Dashboard** (default): Grid of webcams, weather overlay, forecast cards, snow stats
- **TV Mode** (`?tv`): YouTube video background with webcams on sides, forecast overlay, scrolling ticker at bottom

## Key Patterns

### DOM Elements
All DOM references are cached in the `elements` object at startup. When adding new UI elements, add them to this object.

### Regex-Based Parsing
Weather and snow data is extracted via regex from the raw HTML text (not DOM traversal). Patterns are in `parseSnowReportHTML()`. If the resort changes their HTML structure, these patterns may need updating.

### Cache-Busting
Webcam images append `?t=${timestamp}` to URLs to ensure fresh images on each refresh.

## Configuration

All configurable values are in the `CONFIG` object at the top of `app.js`:
- `snowReportUrl` - Source URL for weather/snow data
- `corsProxies` - Array of CORS proxy endpoints to try
- `fetchTimeout` - Request timeout in ms
- `webcams` - Object mapping webcam IDs to their URLs
- `refreshInterval` - Auto-refresh interval in ms (default: 600000 = 10 min)
