# Revelstoke Mountain Dashboard

Real-time conditions dashboard for Revelstoke Mountain Resort. Shows weather, snow reports, forecasts with historical tracking, and live webcams.

## Features

- **Live Weather & Snow Data** - Current conditions, snowfall amounts, forecasts
- **Forecast History Tracking** - See how predictions change over time with sparklines
- **Live Webcams** - Four camera angles with auto-refresh
- **TV Mode** - Full-screen view with YouTube background (`?tv` parameter)
- **Calendar View** - Year-view of historical forecast changes
- **Dark Theme** - Easy on the eyes

## Running Locally

1. Login to Vercel (one-time):
   ```bash
   vercel login
   ```

2. Run the dev server:
   ```bash
   vercel dev
   ```

3. Open http://localhost:3000

That's it. Vercel automatically pulls environment variables (Upstash Redis credentials) from your project settings.

## URLs

- `/` - Main dashboard
- `/?tv` - TV mode with video background
- `/calendar.html` - Forecast history calendar

## Project Structure

```
├── index.html          # Main dashboard
├── calendar.html       # History calendar view
├── app.js              # Dashboard logic
├── calendar.js         # Calendar logic
├── styles.css          # All styling
└── api/
    ├── snow-report.js  # Fetches & parses resort data
    ├── calendar-data.js # Returns historical data
    └── lib/
        └── storage.js  # Upstash Redis abstraction
```

## Data Flow

1. `snow-report.js` fetches HTML from Revelstoke Mountain Resort
2. Parses weather, snow, and forecast data via regex
3. Stores forecast history in Upstash Redis (tracks changes over time)
4. Frontend displays data with sparklines showing forecast trends

## Deployment

Deployed on Vercel. Push to main branch to deploy.

```bash
vercel --prod
```
