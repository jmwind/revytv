import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import type { AvalancheForecast, DangerRating } from '../server/avalanche.ts'
import { formatDateTime } from './public/format.ts'
import { ChevronRight } from './public/icons.tsx'

const style = css({
  display: 'grid',
  gridTemplateColumns: 'minmax(300px, 2fr) minmax(0, 3fr)',
  textDecoration: 'none',
  color: 'inherit',
  overflow: 'hidden',
  transition: 'border-color 150ms var(--ease-out)',
  '&:hover': { borderColor: 'var(--ink-3)' },
  '& .ratings': {
    padding: '14px 16px 12px',
    borderRight: '1px solid var(--rule)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  '& table': { width: '100%', borderCollapse: 'separate', borderSpacing: '3px', margin: '0 -3px' },
  '& th': { fontSize: '12px', fontWeight: 500, color: 'var(--ink-2)', textAlign: 'left', padding: '0 4px 2px' },
  '& th.day': { textAlign: 'center' },
  '& td.band': { fontSize: '12px', color: 'var(--ink-2)', whiteSpace: 'nowrap', padding: '0 6px 0 4px' },
  '& td.cell': {
    textAlign: 'center',
    padding: '6px 4px',
    borderRadius: 'var(--radius-s)',
    background: 'var(--fill)',
    color: 'var(--on-fill)',
    lineHeight: 1.05,
    minWidth: '64px',
  },
  '& td.cell b': { display: 'block', fontFamily: 'var(--font-cond)', fontSize: '22px', fontWeight: 600 },
  '& td.cell small': { fontSize: '11px', fontWeight: 500, display: 'block' },
  '& .level-0': { '--fill': 'var(--panel-2)', '--on-fill': 'var(--ink-3)' },
  '& .level-1': { '--fill': 'var(--danger-1)', '--on-fill': '#10301a' },
  '& .level-2': { '--fill': 'var(--danger-2)', '--on-fill': '#3a3100' },
  '& .level-3': { '--fill': 'var(--danger-3)', '--on-fill': '#ffffff' },
  '& .level-4': { '--fill': 'var(--danger-4)', '--on-fill': '#ffffff' },
  '& .level-5': { '--fill': 'var(--danger-5)', '--on-fill': '#ffffff' },
  '& .confidence': { fontSize: '13px', color: 'var(--ink-2)' },
  '& .confidence b': { color: 'var(--ink)', fontWeight: 600 },
  '& .confidence ul': { margin: '4px 0 0', paddingLeft: '16px', fontSize: '12px', color: 'var(--ink-3)' },
  '& .text': { padding: '14px 18px 12px', display: 'flex', flexDirection: 'column', gap: '10px', minWidth: 0 },
  '& .highlight': { fontSize: '15px', lineHeight: 1.45, margin: 0 },
  '& .highlight + .highlight': { marginTop: '-4px' },
  '& .summaries': { margin: 0, display: 'grid', gap: '8px', fontSize: '13px', lineHeight: 1.45 },
  '& .summaries dt': { color: 'var(--ink-2)', fontSize: '12px', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.04em' },
  '& .summaries dd': { margin: 0, color: 'var(--ink)' },
  '& .problems': { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  '& .problem': {
    display: 'inline-flex',
    alignItems: 'baseline',
    gap: '6px',
    padding: '4px 10px',
    borderRadius: '999px',
    border: '1px solid var(--rule)',
    fontSize: '12px',
    fontWeight: 500,
  },
  '& .problem small': { color: 'var(--ink-3)', fontWeight: 400 },
  '& .foot': {
    marginTop: 'auto',
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: '4px 14px',
    fontSize: '12px',
    color: 'var(--ink-3)',
  },
  '& .foot .more': { display: 'inline-flex', alignItems: 'center', gap: '2px', color: 'var(--route)', fontWeight: 500, marginLeft: 'auto' },
  '@media (max-width: 720px)': {
    gridTemplateColumns: '1fr',
    '& .ratings': { borderRight: 0, borderBottom: '1px solid var(--rule)' },
    '& td.cell': { minWidth: 0 },
    '& td.cell b': { fontSize: '19px' },
    '& td.cell small': { display: 'none' },
    '& .highlight': { fontSize: '14px' },
  },
})

function Cell(handle: Handle<{ rating: DangerRating }>) {
  return () => {
    let { level, label } = handle.props.rating
    return (
      <td class={`cell level-${level}`} title={label}>
        <b>{level > 0 ? level : '–'}</b>
        <small>{label}</small>
      </td>
    )
  }
}

// Avalanche Canada's forecast for the point the resort sits on. The whole card is a link to it.
export function AvalancheCard(handle: Handle<{ forecast: AvalancheForecast }>) {
  return () => {
    let f = handle.props.forecast
    return (
      <a class="panel" href={f.url} target="_blank" rel="noopener" aria-label="Avalanche Canada forecast" mix={style}>
        <div class="ratings">
          <table>
            <thead>
              <tr>
                <th></th>
                {f.days.map((d) => (
                  <th key={d.date} class="day">
                    {d.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="band">Alpine</td>
                {f.days.map((d) => (
                  <Cell key={d.date} rating={d.alp} />
                ))}
              </tr>
              <tr>
                <td class="band">Treeline</td>
                {f.days.map((d) => (
                  <Cell key={d.date} rating={d.tln} />
                ))}
              </tr>
              <tr>
                <td class="band">Below treeline</td>
                {f.days.map((d) => (
                  <Cell key={d.date} rating={d.btl} />
                ))}
              </tr>
            </tbody>
          </table>
          <div class="confidence">
            Confidence <b>{f.confidence.label}</b>
            {f.confidence.statements.length ? (
              <ul>
                {f.confidence.statements.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>
        <div class="text">
          {f.highlights.map((p) => (
            <p key={p} class="highlight">
              {p}
            </p>
          ))}
          {f.summaries.filter((x) => x.key !== 'weather-summary').length ? (
            <dl class="summaries">
              {f.summaries
                .filter((x) => x.key !== 'weather-summary')
                .map((x) => (
                  <div key={x.key}>
                    <dt>{x.title}</dt>
                    <dd>{x.paragraphs[0]}</dd>
                  </div>
                ))}
            </dl>
          ) : null}
          {f.problems.length ? (
            <div class="problems">
              {f.problems.map((p) => (
                <span key={p.type} class="problem">
                  {p.type}
                  {p.elevations.length ? <small>{p.elevations.join(', ')}</small> : null}
                </span>
              ))}
            </div>
          ) : null}
          <div class="foot">
            <span>Issued {formatDateTime(f.dateIssued)}</span>
            {f.validUntil ? <span>Valid until {formatDateTime(f.validUntil)}</span> : null}
            <span class="more">
              avalanche.ca <ChevronRight />
            </span>
          </div>
        </div>
      </a>
    )
  }
}
