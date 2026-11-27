import { clientEntry, css, on } from 'remix/component'
import type { Handle } from 'remix/component'

import { Arrow, WeatherIcon, summerKind, weatherKind } from './icons.tsx'
import type { ForecastDayLite } from './forecast-strip.tsx'
import { freezingShort, trendOf } from './format.ts'
import { Sparkline } from './sparkline.tsx'
import { bustCache } from './webcams.tsx'

export interface SummerDayLite {
  date: string
  tempMax: number | null
  summitTempMax: number | null
  condition: string
}

export interface TickerItem {
  label: string
  value: string
}

export interface TvBoardProps {
  summer: boolean
  forecast: ForecastDayLite[]
  summerForecast: SummerDayLite[]
  ticker: TickerItem[]
  cams: Array<{ id: string; name: string; url: string }>
  snowReportHref: string
  summerForecastHref: string
  error: string | null
}

const REFRESH_MS = 10 * 60 * 1000

const SUMMER_QUOTES = [
  'Sitting is for chairlifts. Go rip something.',
  'The couch will still be here after your run. Probably.',
  'Loam today, laundry tomorrow.',
  'Send it now, explain it to your knees later.',
  'Gravity is free. Use all of it.',
  "You miss 100% of the sends you don't send.",
  'Brake less, grin more.',
  'The trail called. It said stop scrolling.',
  'Berms before emails. Always.',
  'Dropper post down, standards up.',
  'Fresh loam smells better than any candle.',
  'Your bike is judging you from the garage.',
  'Skip leg day. Do a lap instead.',
  'If in doubt, gas it out.',
  'Mud is just trail glitter.',
  'Elevation gain is the only gain that counts.',
  'Sunscreen, snacks, send. In that order.',
  'The alpine does not care about your inbox.',
  'Ride like the chairlift closes in five minutes.',
  'Type 2 fun is still fun. Eventually.',
  'Go touch grass. At 40 km/h.',
  'The best time to ride was yesterday. Second best is now.',
  'Climb it so you can bomb it.',
  'Your excuses don’t have suspension.',
  'Do it for the after-ride burrito.',
  'Rocks are just nature’s features.',
  'Less doom scrolling, more Doomsday laps.',
  'Ride now. Adult later.',
]

const style = css({
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  color: '#fff',
  textShadow: '0 1px 3px rgb(0 0 0 / 0.7)',
  '& .cams': {
    position: 'absolute',
    top: '18px',
    bottom: '150px',
    width: 'clamp(240px, 22vw, 460px)',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    gap: '14px',
  },
  '& .cams.left': { left: '18px' },
  '& .cams.right': { right: '18px' },
  '& figure': { margin: 0, position: 'relative', aspectRatio: '16 / 9', background: 'rgb(0 0 0 / 0.35)', borderRadius: 'var(--radius-s)', overflow: 'hidden' },
  '& figure img': { width: '100%', height: '100%', objectFit: 'cover', opacity: 0, transition: 'opacity 400ms var(--ease-out)' },
  '& figure.loaded img': { opacity: 1 },
  '& figcaption': {
    position: 'absolute',
    left: '10px',
    bottom: '8px',
    fontSize: 'clamp(14px, 1vw, 18px)',
    fontWeight: 600,
    letterSpacing: '0.01em',
  },
  '&.summer .cams': { width: 'clamp(300px, 28vw, 620px)' },
  '& .board': {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: '120px 24px 54px',
    background: 'linear-gradient(to top, rgb(5 8 12 / 0.92) 0%, rgb(5 8 12 / 0.75) 45%, transparent 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
  },
  '& .quote': {
    fontSize: 'clamp(18px, 1.6vw, 26px)',
    fontWeight: 500,
    fontStyle: 'italic',
    color: 'rgb(255 255 255 / 0.9)',
    transition: 'opacity 500ms var(--ease-out)',
    minHeight: '1.4em',
  },
  '& .days': { display: 'flex', gap: 'clamp(10px, 1.4vw, 28px)', alignItems: 'flex-start' },
  '& .day': { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', minWidth: 'clamp(56px, 6vw, 96px)' },
  '& .day .spark': { height: 'clamp(14px, 1.2vw, 20px)', display: 'flex', alignItems: 'center' },
  '& .day .spark svg': { width: 'clamp(48px, 4vw, 76px)', height: '100%' },
  '& .day .name': { fontSize: 'clamp(13px, 1vw, 17px)', fontWeight: 600, color: 'rgb(255 255 255 / 0.85)' },
  '& .day .icon': { color: 'rgb(255 255 255 / 0.75)', margin: '2px 0' },
  '& .day.snow .icon': { color: '#7ee2ac' },
  '& .day.calm .icon': { color: '#ff9a8c' },
  '& .day.snow .amount': { color: '#7ee2ac' },
  '& .day .amount': {
    fontFamily: 'var(--font-cond)',
    fontWeight: 600,
    fontSize: 'clamp(26px, 2.6vw, 44px)',
    lineHeight: 1,
    letterSpacing: '-0.02em',
    display: 'flex',
    alignItems: 'baseline',
    gap: '2px',
  },
  '& .day .amount small': { fontSize: '0.4em', fontWeight: 500, color: 'rgb(255 255 255 / 0.7)', letterSpacing: 0 },
  '& .day.calm .amount': { color: '#ff9a8c' },
  '& .day .delta': { display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: 'clamp(14px, 1.1vw, 20px)', fontWeight: 600, minHeight: '1.3em' },
  '& .day .delta.up': { color: '#7ee2ac' },
  '& .day .delta.down': { color: '#ff9a8c' },
  '& .day .delta.flat': { color: 'rgb(255 255 255 / 0.5)', fontWeight: 500 },
  '& .day .fl': { fontSize: 'clamp(14px, 1.1vw, 20px)', color: 'rgb(255 255 255 / 0.7)' },
  '& .day .temps': { display: 'flex', gap: '10px', fontSize: 'clamp(13px, 1vw, 18px)', color: 'rgb(255 255 255 / 0.7)' },
  '& .day .temps b': { display: 'block', fontFamily: 'var(--font-cond)', fontSize: 'clamp(22px, 2vw, 34px)', fontWeight: 600, color: '#fff', lineHeight: 1.05 },
  '& .error': { fontSize: 'clamp(14px, 1.1vw, 20px)', color: '#ffb4a8' },
  '& .ticker': {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 'clamp(40px, 3vw, 56px)',
    overflow: 'hidden',
    background: 'rgb(5 8 12 / 0.9)',
    borderTop: '1px solid rgb(255 255 255 / 0.12)',
    display: 'flex',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    fontSize: 'clamp(16px, 1.2vw, 22px)',
  },
  '& .ticker .track': { display: 'inline-flex', animation: 'ticker 60s linear infinite', willChange: 'transform' },
  '& .ticker .item': { display: 'inline-flex', gap: '8px', padding: '0 26px', borderRight: '1px solid rgb(255 255 255 / 0.14)' },
  '& .ticker .label': { color: 'rgb(255 255 255 / 0.6)' },
  '& .ticker .value': { fontWeight: 600 },
  '@keyframes ticker': { from: { transform: 'translateX(0)' }, to: { transform: 'translateX(-50%)' } },
  'body[data-ticker="hidden"] & .ticker': { display: 'none' },
  'body[data-ticker="hidden"] & .board': { paddingBottom: '20px' },
  'body[data-ticker="hidden"] & .cams': { bottom: '110px' },
})

function summerDayLabel(date: string, index: number): string {
  if (index === 0) return 'Today'
  return new Date(`${date}T12:00:00`).toLocaleDateString('en-CA', { weekday: 'short' })
}

export const TvBoard = clientEntry(import.meta.url, function TvBoard(handle: Handle<TvBoardProps>) {
  let forecast = handle.props.forecast
  let summerForecast = handle.props.summerForecast
  let ticker = handle.props.ticker
  let error = handle.props.error
  let stamp = Date.now()
  let loaded = new Set<string>()
  let quote = ''
  let quoteVisible = true

  let refresh = async (signal: AbortSignal) => {
    try {
      if (handle.props.summer) {
        let res = await fetch(handle.props.summerForecastHref, { signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        let data = (await res.json()) as { forecast: SummerDayLite[] }
        summerForecast = data.forecast
      } else {
        let res = await fetch(handle.props.snowReportHref, { signal })
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        let data = (await res.json()) as TickerSource & { forecast: ForecastDayLite[] }
        forecast = data.forecast
        ticker = tickerItems(data)
      }
      error = null
    } catch (caught) {
      if (signal.aborted) return
      error = caught instanceof Error ? caught.message : 'Refresh failed'
    }
    stamp = Date.now()
    loaded.clear()
    handle.update()
  }

  handle.queueTask(() => {
    if (handle.signal.aborted) return
    let timer = setInterval(() => refresh(handle.signal), REFRESH_MS)
    handle.signal.addEventListener('abort', () => clearInterval(timer))

    if (handle.props.summer) {
      let last = -1
      let next = () => {
        let i = Math.floor(Math.random() * SUMMER_QUOTES.length)
        if (i === last) i = (i + 1) % SUMMER_QUOTES.length
        last = i
        quoteVisible = false
        handle.update()
        setTimeout(() => {
          quote = SUMMER_QUOTES[i]!
          quoteVisible = true
          handle.update()
        }, 500)
      }
      next()
      let q = setInterval(next, 12_000)
      handle.signal.addEventListener('abort', () => clearInterval(q))
    }
  })

  return () => {
    let { summer, cams } = handle.props
    let left = cams.slice(0, 2)
    let right = cams.slice(2, 4)
    let cam = (c: { id: string; name: string; url: string }) => (
      <figure key={c.id} class={loaded.has(c.id) ? 'loaded' : undefined}>
        <img
          src={bustCache(c.url, stamp)}
          alt={`${c.name} webcam`}
          mix={on('load', () => {
            loaded.add(c.id)
            handle.update()
          })}
        />
        <figcaption>{c.name}</figcaption>
      </figure>
    )

    return (
      <div class={summer ? 'summer' : undefined} mix={style}>
        <div class="cams left">{left.map(cam)}</div>
        <div class="cams right">{right.map(cam)}</div>
        <div class="board">
          {summer ? <div class="quote" style={{ opacity: quoteVisible ? 1 : 0 }}>{quote}</div> : null}
          {error ? <div class="error">Could not refresh: {error}</div> : null}
          <div class="days">
            {summer
              ? summerForecast.map((d, i) => (
                  <div key={d.date} class="day">
                    <span class="name">{summerDayLabel(d.date, i)}</span>
                    <span class="icon">
                      <WeatherIcon kind={summerKind(d.condition)} size={28} />
                    </span>
                    <span class="temps">
                      <span>
                        <b>{d.tempMax != null ? `${d.tempMax}°` : '–'}</b>Base
                      </span>
                      <span>
                        <b>{d.summitTempMax != null ? `${d.summitTempMax}°` : '–'}</b>Peak
                      </span>
                    </span>
                  </div>
                ))
              : forecast.map((d, i) => {
                  let trend = trendOf(d.history)
                  return (
                    <div key={`${d.actualDate ?? ''}:${d.day}:${i}`} class={`day ${d.amount > 0 ? 'snow' : 'calm'}`}>
                      <span class="name">{d.day}</span>
                      <span class="icon">
                        <WeatherIcon kind={weatherKind(d.description, d.amount)} size={26} />
                      </span>
                      <span class="amount">
                        {d.amount}
                        <small>cm</small>
                      </span>
                      <span class={`delta ${trend.direction}`}>
                        {trend.direction === 'flat' ? (
                          d.history.length > 1 ? '±0' : ''
                        ) : (
                          <>
                            <Arrow dir={trend.direction} />
                            {Math.abs(trend.change)}
                          </>
                        )}
                      </span>
                      <span class="spark">
                        <Sparkline history={d.history} width={48} height={14} />
                      </span>
                      <span class="fl">{freezingShort(d.freezingLevel)}</span>
                    </div>
                  )
                })}
          </div>
        </div>
        {!summer ? (
          <div class="ticker" aria-hidden="true">
            <div class="track">
              {[0, 1].map((rep) =>
                ticker.map((t) => (
                  <span key={`${rep}-${t.label}`} class="item">
                    <span class="label">{t.label}</span>
                    <span class="value">{t.value}</span>
                  </span>
                )),
              )}
            </div>
          </div>
        ) : null}
      </div>
    )
  }
})

export interface TickerSource {
  weather: { alpineTemp?: number; condition?: string; windSpeed?: number; windDirection?: string }
  snow: {
    newSnow?: number
    lastHour?: number
    twentyFourHour?: number
    fortyEightHour?: number
    sevenDay?: number
    baseDepth?: number
    seasonTotal?: number
  }
}

export function tickerItems(data: TickerSource): TickerItem[] {
  let w = data.weather
  let s = data.snow
  return [
    { label: 'Alpine', value: w.alpineTemp != null ? `${w.alpineTemp}°C` : '–' },
    { label: 'Sky', value: w.condition ?? '–' },
    { label: 'Wind', value: w.windSpeed != null ? `${w.windSpeed} km/h ${w.windDirection ?? ''}`.trim() : '–' },
    { label: 'New snow', value: `${s.newSnow ?? 0} cm` },
    { label: 'Last hour', value: `${s.lastHour ?? 0} cm` },
    { label: '24 h', value: `${s.twentyFourHour ?? 0} cm` },
    { label: '48 h', value: `${s.fortyEightHour ?? 0} cm` },
    { label: '7 days', value: `${s.sevenDay ?? 0} cm` },
    { label: 'Base', value: `${s.baseDepth ?? 0} cm` },
    { label: 'Season', value: `${s.seasonTotal ?? 0} cm` },
  ]
}
