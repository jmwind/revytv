import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { routes } from '../routes.ts'
import type { CalendarData, CalendarDay } from '../server/calendar-data.ts'
import { ChevronRight } from '../ui/public/icons.tsx'
import { Nav } from '../ui/nav.tsx'
import { signed } from '../ui/public/format.ts'
import { Sparkline } from '../ui/public/sparkline.tsx'
import type { Loaded } from './controller.tsx'
import { Document, type Shell } from './document.tsx'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

const style = css({
  '& .head': {
    display: 'flex',
    alignItems: 'center',
    gap: '20px',
    margin: '24px 0 16px',
    flexWrap: 'wrap',
  },
  '& .year-nav': { display: 'flex', alignItems: 'center', gap: '8px' },
  '& .year-nav h1': { fontSize: '34px', fontWeight: 600, letterSpacing: '-0.02em', minWidth: '4ch', textAlign: 'center' },
  '& .year-nav a': {
    width: '32px',
    height: '32px',
    display: 'grid',
    placeItems: 'center',
    border: '1px solid var(--rule)',
    borderRadius: 'var(--radius-s)',
    color: 'var(--ink-2)',
  },
  '& .year-nav a:hover': { color: 'var(--ink)', borderColor: 'var(--ink-3)' },
  '& .year-nav a.prev svg': { transform: 'rotate(180deg)' },
  '& .legend': { display: 'flex', gap: '16px', color: 'var(--ink-2)', fontSize: '13px', marginLeft: 'auto', flexWrap: 'wrap' },
  '& .legend i': { display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', marginRight: '6px', verticalAlign: '1px' },
  '& .chart': { padding: '14px 16px 8px', marginBottom: '20px' },
  '& .chart .title': { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px' },
  '& .chart .title h2': { fontSize: '15px', fontWeight: 600 },
  '& .chart .title b': { fontFamily: 'var(--font-cond)', fontSize: '23px', fontWeight: 600 },
  '& .chart svg': { width: '100%', height: 'auto', fontSize: '11px' },
  '& .months': { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' },
  '& .month': { padding: '12px 12px 10px' },
  '& .month h3': { fontSize: '15px', fontWeight: 600, marginBottom: '8px' },
  '& .grid': { display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: '2px' },
  '& .dow': { textAlign: 'center', color: 'var(--ink-3)', fontSize: '11px', padding: '2px 0 4px' },
  '& .cell': {
    minHeight: '58px',
    padding: '4px 5px',
    borderRadius: 'var(--radius-s)',
    background: 'var(--panel-2)',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    fontSize: '11px',
    lineHeight: 1.2,
  },
  '& .cell.empty': { background: 'transparent' },
  '& .cell.none': { color: 'var(--ink-3)' },
  '& .cell .n': { fontWeight: 600, fontSize: '12px', display: 'flex', justifyContent: 'space-between' },
  '& .cell .n .actual': { color: 'var(--route)', fontFamily: 'var(--font-cond)', fontSize: '13px' },
  '& .cell .fc': { fontFamily: 'var(--font-cond)', fontSize: '15px', fontWeight: 600 },
  '& .cell .fc small': { fontSize: '10px', color: 'var(--ink-3)', fontWeight: 500, marginLeft: '1px' },
  '& .cell .row': { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' },
  '& .cell .d': { fontWeight: 600 },
  '& .cell.up': { boxShadow: 'inset 2px 0 0 var(--up)' },
  '& .cell.down': { boxShadow: 'inset 2px 0 0 var(--down)' },
  '& .empty-year': { padding: '40px', textAlign: 'center', color: 'var(--ink-2)' },
  '& .hint': { color: 'var(--ink-2)', margin: '-6px 0 16px' },
})

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function SeasonTotalChart(handle: Handle<{ calendar: CalendarData }>) {
  return () => {
    let points = Object.values(handle.props.calendar.snowfall).sort((a, b) => a.date.localeCompare(b.date))
    if (points.length < 2) return null
    let width = 1000
    let height = 150
    let pad = { t: 10, r: 16, b: 22, l: 40 }
    let minT = new Date(points[0]!.date).getTime()
    let maxT = new Date(points[points.length - 1]!.date).getTime()
    let span = maxT - minT || 1
    let maxV = Math.max(...points.map((p) => p.seasonTotal)) || 1
    let x = (d: string) => pad.l + ((new Date(d).getTime() - minT) / span) * (width - pad.l - pad.r)
    let y = (v: number) => pad.t + (height - pad.t - pad.b) - (v / maxV) * (height - pad.t - pad.b)
    let line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.date).toFixed(1)} ${y(p.seasonTotal).toFixed(1)}`).join('')
    let seen = new Set<string>()
    let monthTicks = points.filter((p) => {
      let m = p.date.slice(0, 7)
      if (seen.has(m)) return false
      seen.add(m)
      return true
    })
    let latest = points[points.length - 1]!
    return (
      <section class="panel chart" aria-labelledby="season-total-heading">
        <div class="title">
          <h2 id="season-total-heading">Season total, as recorded daily</h2>
          <b>{latest.seasonTotal} cm</b>
        </div>
        <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Season total over time">
          {[0, Math.round(maxV / 2), maxV].map((v) => (
            <g key={v}>
              <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="var(--rule-2)" />
              <text x={pad.l - 6} y={y(v) + 3} text-anchor="end" fill="var(--ink-3)">
                {v}
              </text>
            </g>
          ))}
          {monthTicks.map((p) => (
            <text key={p.date} x={x(p.date)} y={height - 6} fill="var(--ink-3)">
              {SHORT_MONTHS[Number(p.date.slice(5, 7)) - 1]}
            </text>
          ))}
          <path d={line} fill="none" stroke="var(--route)" stroke-width="2" stroke-linejoin="round" />
          {points.map((p) => (
            <circle key={p.date} cx={x(p.date)} cy={y(p.seasonTotal)} r="2.5" fill="var(--route)">
              <title>
                {p.date}: {p.seasonTotal} cm
              </title>
            </circle>
          ))}
        </svg>
      </section>
    )
  }
}

function Cell(handle: Handle<{ day: number; data?: CalendarDay; actual?: number; title: string }>) {
  return () => {
    let { day, data, actual, title } = handle.props
    if (!data && actual == null) {
      return (
        <div class="cell none">
          <span class="n">{day}</span>
        </div>
      )
    }
    let cls = ['cell', data ? (data.delta > 0 ? 'up' : data.delta < 0 ? 'down' : 'flat') : ''].join(' ')
    return (
      <div class={cls} title={title}>
        <span class="n">
          {day}
          {actual != null ? <span class="actual">{actual} cm</span> : null}
        </span>
        {data ? (
          <>
            <span class="fc">
              {data.lastAmount}
              <small>cm fc</small>
            </span>
            <span class="row">
              <Sparkline history={data.history} width={34} height={10} />
              <span class={`d ${data.delta > 0 ? 'delta-up' : data.delta < 0 ? 'delta-down' : 'delta-flat'}`}>{signed(data.delta)}</span>
            </span>
          </>
        ) : null}
      </div>
    )
  }
}

export function CalendarPage(handle: Handle<{ shell: Shell; year: number; calendar: Loaded<CalendarData> }>) {
  return () => {
    let { shell, year, calendar } = handle.props
    let cal = calendar.value
    let now = new Date()
    let months: number[] = []
    if (cal) {
      for (let m = 0; m < 12; m++) {
        let future = year > now.getFullYear() || (year === now.getFullYear() && m > now.getMonth())
        let days = new Date(year, m + 1, 0).getDate()
        let has = false
        for (let d = 1; d <= days && !has; d++) {
          let k = dateKey(year, m, d)
          has = Boolean(cal.data[k] || cal.newSnow[k] || cal.snowfall[k])
        }
        if (has || !future) months.push(m)
      }
    }

    return (
      <Document shell={shell} path="/calendar" title={`${year} forecast calendar · Truflake`} description="Every day's forecast revisions and what actually fell.">
        <div class="page" mix={style}>
          <Nav current="calendar" />
          <div class="head">
            <div class="year-nav">
              <a class="prev" href={`${routes.calendar.href()}?year=${year - 1}`} aria-label={`${year - 1}`}>
                <ChevronRight />
              </a>
              <h1>{year}</h1>
              <a href={`${routes.calendar.href()}?year=${year + 1}`} aria-label={`${year + 1}`}>
                <ChevronRight />
              </a>
            </div>
            <div class="legend">
              <span>
                <i style={{ background: 'var(--route)' }}></i>Actual new snow
              </span>
              <span>
                <i style={{ background: 'var(--up)' }}></i>Forecast rose
              </span>
              <span>
                <i style={{ background: 'var(--down)' }}></i>Forecast fell
              </span>
              <span>fc = final forecast for that day, with its revisions</span>
            </div>
          </div>

          {cal ? <SeasonTotalChart calendar={cal} /> : null}
          {cal && cal.count === 0 && cal.newSnowCount === 0 ? (
            <p class="hint">Days fill in as the season's forecasts and snowfall are recorded.</p>
          ) : null}

          {!cal ? (
            <div class="panel empty-year">Calendar data could not be loaded. {calendar.error}</div>
          ) : months.length === 0 ? (
            <div class="panel empty-year">No forecasts were recorded in {year}.</div>
          ) : (
            <div class="months">
              {months.map((m) => {
                let first = new Date(year, m, 1).getDay()
                let count = new Date(year, m + 1, 0).getDate()
                let cells = []
                for (let i = 0; i < first; i++) cells.push(<div key={`e${i}`} class="cell empty"></div>)
                for (let d = 1; d <= count; d++) {
                  let k = dateKey(year, m, d)
                  let data = cal.data[k]
                  let actual = cal.newSnow[k]?.newSnow
                  let title = data
                    ? `${k}: forecast ${data.firstAmount} → ${data.lastAmount} cm over ${data.historyCount} revisions${actual != null ? `, actual ${actual} cm` : ''}`
                    : actual != null
                      ? `${k}: actual ${actual} cm`
                      : k
                  cells.push(<Cell key={k} day={d} data={data} actual={actual} title={title} />)
                }
                return (
                  <section key={m} class="panel month" aria-label={`${MONTHS[m]} ${year}`}>
                    <h3>{MONTHS[m]}</h3>
                    <div class="grid">
                      {DAYS.map((d) => (
                        <div key={d} class="dow">
                          {d}
                        </div>
                      ))}
                      {cells}
                    </div>
                  </section>
                )
              })}
            </div>
          )}
        </div>
      </Document>
    )
  }
}
