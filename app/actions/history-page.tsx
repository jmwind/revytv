import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import type { SeasonContext } from '../server/season-context.ts'
import { Nav } from '../ui/nav.tsx'
import { signed } from '../ui/public/format.ts'
import { SeasonExplorer } from '../ui/public/season-explorer.tsx'
import type { Loaded } from './controller.tsx'
import { Document, type Shell } from './document.tsx'

const style = css({
  '& .intro': {
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: '24px',
    margin: '28px 0 16px',
    flexWrap: 'wrap',
  },
  '& .intro h1': { fontSize: '34px', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05 },
  '& .intro p': { color: 'var(--ink-2)', maxWidth: '60ch', marginTop: '8px' },
  '& .intro .verdict': {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
    textAlign: 'right',
  },
  '& .intro .verdict .figure': {
    fontFamily: 'var(--font-cond)',
    fontWeight: 600,
    fontSize: '56px',
    lineHeight: 0.95,
    letterSpacing: '-0.03em',
  },
  '& .intro .verdict .figure small': { fontSize: '20px', color: 'var(--ink-2)', letterSpacing: 0, marginLeft: '4px' },
  '& .intro .verdict span': { color: 'var(--ink-2)', fontSize: '13px', marginTop: '4px' },
  '& .intro .verdict b': { fontWeight: 600 },
  '@media (max-width: 720px)': {
    '& .intro': { flexDirection: 'column-reverse', alignItems: 'flex-start' },
    '& .intro .verdict': { alignItems: 'flex-start', textAlign: 'left' },
  },
  '& table': { width: '100%', marginTop: '16px', fontSize: '13px' },
  '& th': {
    textAlign: 'left',
    fontWeight: 500,
    color: 'var(--ink-2)',
    padding: '8px 12px',
    borderBottom: '1px solid var(--rule-strong)',
  },
  '& td': { padding: '7px 12px', borderBottom: '1px solid var(--rule-2)' },
  '& th.n, & td.n': { textAlign: 'right', fontFamily: 'var(--font-cond)', fontSize: '15px', fontWeight: 600 },
  '& th.n': { fontFamily: 'var(--font)', fontSize: '13px', fontWeight: 500 },
  '& tr.current td': { background: 'var(--route-soft)' },
  '& td .bar': { display: 'block', height: '6px', background: 'var(--ink-3)', borderRadius: '1px', opacity: 0.55 },
  '& tr.current td .bar': { background: 'var(--route)', opacity: 1 },
  '& .error': { padding: '24px', color: 'var(--ink-2)' },
})

export function HistoryPage(handle: Handle<{ shell: Shell; season: Loaded<SeasonContext> }>) {
  return () => {
    let { shell, season } = handle.props
    let s = season.value
    let c = s?.comparison
    let diff = c && c.current != null && c.mean != null ? c.current - c.mean : null
    let rows = s
      ? [...s.data.seasons]
          .map((x) => ({
            label: x.label,
            total: x.label === s.label && c?.current != null ? c.current : x.total,
            byDate: x.label === s.label ? c?.current ?? null : valueAt(x.values, s.index),
            isCurrent: x.label === s.label,
          }))
          .sort((a, b) => b.total - a.total)
      : []
    let maxTotal = rows.reduce((m, r) => Math.max(m, r.total), 0)

    return (
      <Document shell={shell} title="Every season since 2007 · Truflake" description="This season's snowfall against every Revelstoke season since 2007-08.">
        <div class="page" mix={style}>
          <Nav current="history" />
          {s && c ? (
            <>
              <div class="intro">
                <div>
                  <h1>Season {s.label} against the record</h1>
                  <p>
                    Cumulative snowfall at the resort, Nov 1 to Apr 20, for every season since 2007-08. The hatched band is the
                    range of past seasons, the dashed line their mean, and {s.label} is drawn in blue up to{' '}
                    {s.inSeason ? 'today' : 'its last reported day'}. Hover or drag across the chart for any date; tick seasons to overlay them.
                  </p>
                </div>
                <div class="verdict">
                  <div class="figure">
                    {c.current ?? '–'}
                    <small>cm</small>
                  </div>
                  <span>
                    {s.inSeason ? `by ${c.dateLabel.replace('-', ' ')}` : 'at season end'},{' '}
                    <b class={diff == null ? '' : diff >= 0 ? 'delta-up' : 'delta-down'}>{diff != null ? `${signed(diff)} cm` : '–'}</b> vs. the{' '}
                    {c.mean ?? '–'} cm mean · rank {c.rank ?? '–'} of {c.comparedCount + 1}
                    {c.projectedTotal != null && s.inSeason ? ` · on pace for ${c.projectedTotal} cm` : ''}
                  </span>
                </div>
              </div>

              <SeasonExplorer
                dates={s.data.dates}
                band={c.band}
                current={s.current}
                currentLabel={s.label}
                todayIndex={s.index}
                inSeason={s.inSeason}
                startYear={s.startYear}
                meanTotal={c.endOfSeason.mean}
                seasons={s.data.seasons.map((x) => ({
                  label: x.label,
                  values: x.values,
                  total: x.label === s.label && c.current != null ? c.current : x.total,
                }))}
              />

              <div class="section-head">
                <h2>Seasons ranked by total</h2>
                <span class="aside">
                  Source: Revelstoke Mountain Resort historical snowfall tracker, fetched {new Date(s.data.fetchedAt).toLocaleDateString('en-CA')}
                </span>
              </div>
              <div class="panel">
                <table>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Season</th>
                      <th class="n">Season total</th>
                      <th style={{ width: '32%' }}></th>
                      <th class="n">By {c.dateLabel.replace('-', ' ')}</th>
                      <th class="n">vs. mean</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.label} class={r.isCurrent ? 'current' : undefined}>
                        <td>{i + 1}</td>
                        <td>
                          {r.label}
                          {r.isCurrent ? ' (this season, so far)' : ''}
                        </td>
                        <td class="n">{r.total}</td>
                        <td>
                          <span class="bar" style={{ width: `${maxTotal ? (r.total / maxTotal) * 100 : 0}%` }}></span>
                        </td>
                        <td class="n">{r.byDate ?? '–'}</td>
                        <td class={`n ${r.byDate != null && c.mean != null ? (r.byDate - c.mean >= 0 ? 'delta-up' : 'delta-down') : ''}`}>
                          {r.byDate != null && c.mean != null ? signed(r.byDate - c.mean) : '–'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div class="panel error">The resort's historical snowfall tracker could not be read. {season.error}</div>
          )}
        </div>
      </Document>
    )
  }
}

function valueAt(values: Array<number | null>, i: number): number | null {
  for (let k = Math.min(i, values.length - 1); k >= 0; k--) {
    let v = values[k]
    if (v != null) return v
  }
  return null
}
