import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { routes } from '../routes.ts'
import type { SnowReport } from '../server/snow-report.ts'
import type { SummerForecast } from '../server/summer-forecast.ts'
import { Snowflake } from '../ui/public/icons.tsx'
import { TvBoard, tickerItems } from '../ui/public/tv-board.tsx'
import { SUMMER_PLAYLIST, TvPlayer, WINTER_PLAYLIST } from '../ui/public/tv-player.tsx'
import { WEBCAMS } from '../ui/public/webcams.tsx'
import type { Loaded } from './controller.tsx'
import { Document, type Shell } from './document.tsx'

export interface TvPageProps {
  shell: Shell
  summer: boolean
  report: Loaded<SnowReport>
  summerForecast: Loaded<SummerForecast>
}

const style = css({
  position: 'fixed',
  inset: 0,
  background: '#000',
  overflow: 'hidden',
  '& .small-screen': {
    display: 'none',
    position: 'absolute',
    inset: 0,
    zIndex: 50,
    background: 'var(--paper)',
    color: 'var(--ink)',
    padding: '48px 24px',
    textAlign: 'center',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
  },
  '& .small-screen svg': { color: 'var(--route)' },
  '& .small-screen h1': { fontSize: '23px', fontWeight: 600 },
  '& .small-screen p': { color: 'var(--ink-2)', maxWidth: '36ch' },
  '& .small-screen a': {
    marginTop: '8px',
    display: 'inline-block',
    padding: '10px 18px',
    background: 'var(--route)',
    color: 'var(--route-ink)',
    borderRadius: 'var(--radius-s)',
    textDecoration: 'none',
    fontWeight: 600,
  },
  '@media (max-width: 820px), (max-height: 480px)': {
    '& .small-screen': { display: 'flex' },
  },
})

// TV mode: muted ski video, four cameras, the forecast on a scrim, and a ticker. Designed for a wall.
export function TvPage(handle: Handle<TvPageProps>) {
  return () => {
    let { shell, summer, report, summerForecast } = handle.props
    let r = report.value
    return (
      <Document shell={shell} title={`TV mode · Truflake`} bodyClass="tv">
        <main mix={style} aria-label="TV mode">
          <TvPlayer playlist={summer ? SUMMER_PLAYLIST : WINTER_PLAYLIST} />
          <TvBoard
            summer={summer}
            forecast={
              r
                ? r.forecast.map((d) => ({
                    day: d.day,
                    amount: d.amount,
                    freezingLevel: d.freezingLevel,
                    description: d.description,
                    actualDate: d.actualDate,
                    history: d.history,
                  }))
                : []
            }
            summerForecast={
              summerForecast.value
                ? summerForecast.value.forecast.map((d) => ({
                    date: d.date,
                    tempMax: d.tempMax,
                    summitTempMax: d.summitTempMax,
                    condition: d.condition,
                  }))
                : []
            }
            ticker={r ? tickerItems(r) : []}
            cams={WEBCAMS}
            snowReportHref={routes.api.snowReport.href()}
            summerForecastHref={routes.api.summerForecast.href()}
            error={report.error ?? summerForecast.error}
          />
          <div class="small-screen">
            <Snowflake size={40} />
            <h1>TV mode wants a big screen</h1>
            <p>This view is laid out for a television across the room. On a phone, the dashboard has everything.</p>
            <a href={routes.home.href()}>Open the dashboard</a>
          </div>
        </main>
      </Document>
    )
  }
}
