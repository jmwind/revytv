import { createController } from 'remix/router'

import { routes } from '../routes.ts'
import { getCalendarData } from '../server/calendar-data.ts'
import { getHistoricalSnowData } from '../server/historical.ts'
import { loadSeasonContext } from '../server/season-context.ts'
import { getSnowReport } from '../server/snow-report.ts'
import { getSummerForecast } from '../server/summer-forecast.ts'

function json(data: unknown, cacheControl: string) {
  return Response.json(data, {
    headers: { 'Cache-Control': cacheControl, 'Access-Control-Allow-Origin': '*' },
  })
}

function failure(error: unknown, what: string) {
  console.error(`Error fetching ${what}:`, error)
  return Response.json(
    { error: `Failed to fetch ${what}`, message: error instanceof Error ? error.message : String(error) },
    { status: 500 },
  )
}

// JSON endpoints, kept for the nerds and for TV mode's periodic refresh.
export default createController(routes.api, {
  actions: {
    async snowReport() {
      try {
        return json(await getSnowReport(), 's-maxage=60, stale-while-revalidate=30')
      } catch (error) {
        return failure(error, 'snow report')
      }
    },
    async summerForecast() {
      try {
        return json(await getSummerForecast(), 's-maxage=1800, stale-while-revalidate=600')
      } catch (error) {
        return failure(error, 'summer forecast')
      }
    },
    async calendarData(context) {
      try {
        let year = Number.parseInt(context.url.searchParams.get('year') ?? '', 10)
        if (!Number.isFinite(year)) year = new Date().getFullYear()
        return json(await getCalendarData(year), 's-maxage=300, stale-while-revalidate=60')
      } catch (error) {
        return failure(error, 'calendar data')
      }
    },
    async historical(context) {
      try {
        let now = new Date()
        if (context.url.searchParams.get('raw') != null) {
          return json(await getHistoricalSnowData(now), 's-maxage=3600, stale-while-revalidate=600')
        }
        let total = Number.parseInt(context.url.searchParams.get('total') ?? '', 10)
        let season = await loadSeasonContext(now, Number.isFinite(total) ? total : null)
        return json(
          {
            season: season.label,
            index: season.index,
            inSeason: season.inSeason,
            dates: season.data.dates,
            current: season.current,
            comparison: season.comparison,
            fetchedAt: season.data.fetchedAt,
            source: season.data.source,
          },
          's-maxage=600, stale-while-revalidate=300',
        )
      } catch (error) {
        return failure(error, 'historical snowfall')
      }
    },
  },
})
