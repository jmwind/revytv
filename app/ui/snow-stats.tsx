import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import type { SnowReport } from '../server/snow-report.ts'
import { WeatherScene } from './public/weather-scene.tsx'

const blockStyle = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.35fr)',
  '& .lead': {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 'var(--radius-m) 0 0 var(--radius-m)',
    padding: '16px 20px 14px',
    borderRight: '1px solid var(--rule)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    gap: '6px',
  },
  // The weather scene paints behind everything in the lead cell.
  '& .lead > :not(canvas)': { position: 'relative', zIndex: 1 },
  '& .lead .label': {
    color: 'var(--ink-2)',
    fontSize: '13px',
    fontWeight: 500,
  },
  '& .lead .figure': {
    fontFamily: 'var(--font-cond)',
    fontWeight: 600,
    fontSize: '60px',
    lineHeight: 0.95,
    letterSpacing: '-0.03em',
    display: 'flex',
    alignItems: 'baseline',
    gap: '5px',
  },
  '& .lead .figure.snow': { color: 'var(--up)' },
  '& .lead .figure.none': { color: 'var(--ink-3)' },
  '& .lead .figure small': {
    fontSize: '18px',
    fontWeight: 500,
    color: 'var(--ink-2)',
    letterSpacing: 0,
  },
  '& .weather': {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '2px 12px',
    color: 'var(--ink-2)',
    fontSize: '13px',
  },
  '& .weather b': { color: 'var(--ink)', fontWeight: 600 },
  // Hairline seams between tiles come from the grid gap over the rule colour.
  '& .stats': {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
    gridAutoRows: 'minmax(0, 1fr)',
    gap: '1px',
    background: 'var(--rule-2)',
    borderRadius: '0 var(--radius-m) var(--radius-m) 0',
    overflow: 'hidden',
  },
  '& .stat': {
    background: 'var(--panel)',
    padding: '10px 16px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '2px',
    minWidth: 0,
  },
  '& .stat .k': { color: 'var(--ink-2)', fontSize: '12px', fontWeight: 500 },
  '& .stat .v': {
    fontFamily: 'var(--font-cond)',
    fontSize: '24px',
    fontWeight: 600,
    lineHeight: 1.05,
    whiteSpace: 'nowrap',
  },
  '& .stat .v small': { fontSize: '12px', color: 'var(--ink-3)', fontWeight: 500, marginLeft: '3px' },
  '& .stat.zero .v': { color: 'var(--ink-3)' },
  '@media (max-width: 720px)': {
    gridTemplateColumns: '1fr',
    '& .lead': {
      borderRadius: 'var(--radius-m) var(--radius-m) 0 0',
      borderRight: 0,
      borderBottom: '1px solid var(--rule)',
      display: 'grid',
      gridTemplateColumns: 'auto minmax(0, 1fr)',
      alignItems: 'center',
      columnGap: '20px',
      rowGap: '4px',
      padding: '12px 16px 12px',
    },
    '& .lead .label': { gridColumn: '1 / -1' },
    '& .lead .figure': { fontSize: '52px' },
    '& .weather': { flexDirection: 'column', gap: '1px' },
    '& .stats': { gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', borderRadius: '0 0 var(--radius-m) var(--radius-m)' },
    '& .stat': { padding: '8px 12px' },
    '& .stat .v': { fontSize: '21px' },
  },
})

function Stat(handle: Handle<{ label: string; value: number | undefined }>) {
  return () => {
    let v = handle.props.value ?? 0
    return (
      <div class={v === 0 ? 'stat zero' : 'stat'}>
        <span class="k">{handle.props.label}</span>
        <span class="v">
          {v}
          <small>cm</small>
        </span>
      </div>
    )
  }
}

export function SnowStats(handle: Handle<{ report: SnowReport }>) {
  return () => {
    let { snow, weather } = handle.props.report
    let newSnow = snow.newSnow ?? 0
    return (
      <section class="panel" aria-labelledby="now-heading" mix={blockStyle}>
        <div class="lead">
          <WeatherScene
            condition={weather.condition}
            newSnow={newSnow}
            last24={snow.twentyFourHour ?? 0}
            windSpeed={weather.windSpeed}
            windDirection={weather.windDirection}
          />
          <span id="now-heading" class="label">
            New snow overnight
          </span>
          <div class={`figure ${newSnow > 0 ? 'snow' : 'none'}`}>
            {newSnow}
            <small>cm</small>
          </div>
          <div class="weather">
            <span>
              Alpine <b>{weather.alpineTemp != null ? `${weather.alpineTemp}°` : '–'}</b>
            </span>
            <span>
              Ridge wind{' '}
              <b>
                {weather.windSpeed != null ? `${weather.windSpeed} km/h` : '–'}
                {weather.windDirection ? ` ${weather.windDirection}` : ''}
              </b>
            </span>
            <span>
              Sky <b>{weather.condition ?? '–'}</b>
            </span>
          </div>
        </div>
        <div class="stats">
          <Stat label="Last hour" value={snow.lastHour} />
          <Stat label="24 hours" value={snow.twentyFourHour} />
          <Stat label="48 hours" value={snow.fortyEightHour} />
          <Stat label="7 days" value={snow.sevenDay} />
          <Stat label="Base depth" value={snow.baseDepth} />
          <Stat label="Season total" value={snow.seasonTotal} />
        </div>
      </section>
    )
  }
}
