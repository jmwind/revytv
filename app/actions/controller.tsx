import { redirect } from 'remix/response/redirect'
import { createController } from 'remix/router'

import { assets } from '../assets.ts'
import { routes } from '../routes.ts'
import { getCalendarData } from '../server/calendar-data.ts'
import { isSummerSeason } from '../server/season.ts'
import { loadSeasonContext, type SeasonContext } from '../server/season-context.ts'
import { getSnowReport, type SnowReport } from '../server/snow-report.ts'
import { getSummerForecast, type SummerForecast } from '../server/summer-forecast.ts'
import { AboutPage } from './about-page.tsx'
import { CalendarPage } from './calendar-page.tsx'
import { loadShell } from './document.tsx'
import { HistoryPage } from './history-page.tsx'
import { HomePage } from './home-page.tsx'
import { TvPage } from './tv-page.tsx'

const NO_STORE = { headers: { 'Cache-Control': 'private, no-store' } }

export interface Loaded<T> {
  value: T | null
  error: string | null
}

async function attempt<T>(what: string, load: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { value: await load(), error: null }
  } catch (error) {
    console.error(`Failed to load ${what}:`, error)
    return { value: null, error: error instanceof Error ? error.message : String(error) }
  }
}

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response('Not Found', { status: 404 })
    },

    async home(context) {
      // `/?tv` was the original TV-mode URL.
      if (context.url.searchParams.has('tv')) return redirect(routes.tv.href(), 301)

      let now = new Date()
      let [shell, report] = await Promise.all([loadShell(), attempt('snow report', getSnowReport)])
      let season = await attempt('historical snowfall', () =>
        loadSeasonContext(now, report.value?.snow.seasonTotal ?? null),
      )
      return context.render(<HomePage shell={shell} report={report} season={season} />, NO_STORE)
    },

    async tv(context) {
      let params = context.url.searchParams
      let summer = params.has('winter') ? false : params.has('summer') ? true : isSummerSeason()
      let [shell, report, summerForecast] = await Promise.all([
        loadShell(),
        summer ? Promise.resolve<Loaded<SnowReport>>({ value: null, error: null }) : attempt('snow report', getSnowReport),
        summer ? attempt('summer forecast', getSummerForecast) : Promise.resolve<Loaded<SummerForecast>>({ value: null, error: null }),
      ])
      return context.render(<TvPage shell={shell} summer={summer} report={report} summerForecast={summerForecast} />, NO_STORE)
    },

    async history(context) {
      let now = new Date()
      let [shell, report] = await Promise.all([loadShell(), attempt('snow report', getSnowReport)])
      let season: Loaded<SeasonContext> = await attempt('historical snowfall', () =>
        loadSeasonContext(now, report.value?.snow.seasonTotal ?? null),
      )
      return context.render(<HistoryPage shell={shell} season={season} />, NO_STORE)
    },

    async calendar(context) {
      let year = Number.parseInt(context.url.searchParams.get('year') ?? '', 10)
      if (!Number.isFinite(year)) year = new Date().getFullYear()
      let [shell, calendar] = await Promise.all([loadShell(), attempt('calendar data', () => getCalendarData(year))])
      return context.render(<CalendarPage shell={shell} year={year} calendar={calendar} />, NO_STORE)
    },

    async about(context) {
      let shell = await loadShell()
      return context.render(<AboutPage shell={shell} />, { headers: { 'Cache-Control': 'public, max-age=300' } })
    },
  },
})
