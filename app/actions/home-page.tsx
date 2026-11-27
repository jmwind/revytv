import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import type { AvalancheForecast } from '../server/avalanche.ts'
import type { SeasonContext } from '../server/season-context.ts'
import type { SnowReport } from '../server/snow-report.ts'
import { Nav } from '../ui/nav.tsx'
import { ForecastStrip } from '../ui/public/forecast-strip.tsx'
import { Freshness } from '../ui/public/freshness.tsx'
import { WEBCAMS, WebcamGrid } from '../ui/public/webcams.tsx'
import { WindyMap } from '../ui/public/windy-map.tsx'
import { SeasonPanel } from '../ui/season-panel.tsx'
import { AvalancheCard } from '../ui/avalanche-card.tsx'
import { SnowStats } from '../ui/snow-stats.tsx'
import { ZoneStatus, zoneSummary } from '../ui/zone-status.tsx'
import type { Loaded } from './controller.tsx'
import { Document, type Shell } from './document.tsx'

export interface HomePageProps {
  shell: Shell
  report: Loaded<SnowReport>
  season: Loaded<SeasonContext>
  avalanche: Loaded<AvalancheForecast>
}

const layout = css({
  '& .top': {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.45fr) minmax(320px, 1fr)',
    gap: '16px',
    marginTop: '16px',
    alignItems: 'stretch',
  },
  '& .top > *': { minWidth: 0 },
  '& .forecast': { marginTop: '16px' },
  '& .notice': {
    padding: '14px 18px',
    display: 'flex',
    gap: '12px',
    alignItems: 'baseline',
    color: 'var(--ink-2)',
  },
  '& .notice b': { color: 'var(--warn)', fontWeight: 600 },
  '& .notice code': { fontFamily: 'ui-monospace, monospace', fontSize: '12px' },
  '& footer': {
    marginTop: '40px',
    paddingTop: '14px',
    borderTop: '1px solid var(--rule)',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px 20px',
    color: 'var(--ink-2)',
    fontSize: '12px',
  },
  '& footer a': { color: 'var(--ink-2)' },
  '@media (max-width: 980px)': {
    '& .top': { gridTemplateColumns: '1fr' },
  },
})

function Notice(handle: Handle<{ what: string; error: string | null }>) {
  return () => (
    <div class="panel notice" role="status">
      <b>{handle.props.what} unavailable.</b>
      <span>
        The resort's page could not be read just now; the rest of the dashboard still works.
        {handle.props.error ? (
          <>
            {' '}
            <code>{handle.props.error}</code>
          </>
        ) : null}
      </span>
    </div>
  )
}

export function HomePage(handle: Handle<HomePageProps>) {
  return () => {
    let { shell, report, season, avalanche } = handle.props
    let r = report.value
    let s = season.value
    let a = avalanche.value
    // A report cached before zones were parsed has none; the section simply stays off.
    let zones = r?.zones ?? []

    return (
      <Document
        shell={shell}
        title="Revy Snow for Nerds · Truflake"
        description="Revelstoke Mountain Resort snow, forecast revisions, webcams, and how this season compares with every season since 2007."
      >
        <div class="page" mix={layout}>
          <Nav current="home" meta={r ? <Freshness changedAt={r.statsChangedAt} issuedAt={r.forecastIssuedAt} fetchedAt={r.fetchedAt} /> : undefined} />

          <div class="top">
            {r ? <SnowStats report={r} /> : <Notice what="Snow report" error={report.error} />}
            {s ? (
              <SeasonPanel
                label={s.label}
                dates={s.data.dates}
                current={s.current}
                comparison={s.comparison}
                todayIndex={s.index}
                inSeason={s.inSeason}
              />
            ) : (
              <Notice what="Historical snowfall" error={season.error} />
            )}
          </div>

          <div class="section-head">
            <h2>Alpine forecast</h2>
            <span class="aside">
              {r ? `${r.forecast.length} periods from the resort` : ''}
            </span>
          </div>
          {r ? (
            <ForecastStrip
              days={r.forecast.map((d) => ({
                day: d.day,
                amount: d.amount,
                freezingLevel: d.freezingLevel,
                description: d.description,
                actualDate: d.actualDate,
                history: d.history,
              }))}
            />
          ) : null}

          {zones.length ? (
            <>
              <div class="section-head">
                <h2>Zone status</h2>
                <span class="aside">{zoneSummary(zones)} · from the resort</span>
              </div>
              <ZoneStatus zones={zones} />
            </>
          ) : null}

          <div class="section-head">
            <h2>Cameras</h2>
            <span class="aside">Refresh every 10 minutes · click to enlarge</span>
          </div>
          <WebcamGrid cams={WEBCAMS} />

          <div class="section-head">
            <h2>Avalanche forecast</h2>
            <span class="aside">Avalanche Canada · the forecast area around the resort</span>
          </div>
          {a ? <AvalancheCard forecast={a} /> : <Notice what="Avalanche forecast" error={avalanche.error} />}

          <div class="section-head">
            <h2>Snow accumulation map</h2>
            <span class="aside">Windy · snow forecast, animated</span>
          </div>
          <WindyMap />

          <footer>
            <span>Data: Revelstoke Mountain Resort snow report and historical tracker, Avalanche Canada, Open-Meteo, Windy.</span>
            {r ? <span>Stored in {r.storageMode === 'upstash-redis' ? 'Upstash Redis' : 'a local JSON file'}.</span> : null}
            <span>
              <a href="/about">About this obsession</a>
            </span>
          </footer>
        </div>
      </Document>
    )
  }
}
