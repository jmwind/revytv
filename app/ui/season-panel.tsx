import { css } from 'remix/component'
import type { Handle } from 'remix/component'

import { routes } from '../routes.ts'
import type { SeasonComparison } from '../server/historical.ts'
import { ChevronRight } from './public/icons.tsx'
import { signed } from './public/format.ts'
import { SeasonBand } from './public/season-band.tsx'

export interface SeasonPanelProps {
  label: string
  dates: string[]
  current: (number | null)[]
  comparison: SeasonComparison
  todayIndex: number
  inSeason: boolean
}

const panelStyle = css({
  display: 'flex',
  flexDirection: 'column',
  textDecoration: 'none',
  color: 'inherit',
  transition: 'border-color 150ms var(--ease-out)',
  '&:hover': { borderColor: 'var(--ink-3)' },
  '& .head': {
    display: 'flex',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '14px 18px 0',
  },
  '& .head h2': { fontSize: '14px', fontWeight: 600 },
  '& .head .more': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '2px',
    color: 'var(--route)',
    fontSize: '13px',
    fontWeight: 500,
    whiteSpace: 'nowrap',
  },
  '& .verdict': {
    padding: '4px 18px 0',
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
    flexWrap: 'wrap',
  },
  '& .verdict .figure': {
    fontFamily: 'var(--font-cond)',
    fontWeight: 600,
    fontSize: '30px',
    lineHeight: 1,
    letterSpacing: '-0.02em',
  },
  '& .verdict .vs': { color: 'var(--ink-2)', fontSize: '13px' },
  '& .verdict .vs b': { fontWeight: 600 },
  '& .chart': { padding: '6px 10px 0', flex: '1 1 auto', display: 'flex', alignItems: 'flex-end' },
  '& .chart svg': { width: '100%', height: 'auto' },
  '& .chart .narrow': { display: 'none' },
  '& .legend': {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px 14px',
    padding: '2px 18px 8px',
    color: 'var(--ink-3)',
    fontSize: '12px',
  },
  '& .legend span': { whiteSpace: 'nowrap' },
  '& .legend i': {
    display: 'inline-block',
    width: '14px',
    height: '0',
    borderTop: '2px solid var(--route)',
    verticalAlign: 'middle',
    marginRight: '5px',
  },
  '& .legend i.mean': { borderTopStyle: 'dashed', borderTopColor: 'var(--ink-2)', borderTopWidth: '1.5px' },
  '& .legend i.range': {
    height: '9px',
    borderTop: 0,
    border: '1px solid var(--rule)',
    background: 'repeating-linear-gradient(45deg, var(--ink-3) 0 1px, transparent 1px 4px)',
    opacity: 0.8,
  },
  // Four facts in a row, hairline seams from the grid gap.
  '& .facts': {
    margin: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: '1px',
    background: 'var(--rule-2)',
    borderTop: '1px solid var(--rule-2)',
    borderRadius: '0 0 var(--radius-m) var(--radius-m)',
    overflow: 'hidden',
  },
  '& .facts div': {
    background: 'var(--panel)',
    padding: '8px 14px 10px',
    minWidth: 0,
  },
  '& .facts dt': { color: 'var(--ink-2)', fontSize: '12px', whiteSpace: 'nowrap' },
  '& .facts dd': {
    margin: 0,
    fontFamily: 'var(--font-cond)',
    fontSize: '19px',
    fontWeight: 600,
    lineHeight: 1.1,
    whiteSpace: 'nowrap',
  },
  '& .facts dd small': { fontFamily: 'var(--font)', fontSize: '12px', color: 'var(--ink-3)', fontWeight: 400, marginLeft: '4px' },
  '@media (max-width: 720px)': {
    '& .chart .wide': { display: 'none' },
    '& .chart .narrow': { display: 'block' },
    '& .facts': { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' },
  },
})

export function SeasonPanel(handle: Handle<SeasonPanelProps>) {
  return () => {
    let { label, dates, current, comparison: c, todayIndex, inSeason } = handle.props
    let diff = c.current != null && c.mean != null ? c.current - c.mean : null
    let verdictClass = diff == null ? '' : diff > 0 ? 'delta-up' : diff < 0 ? 'delta-down' : 'delta-flat'
    let date = c.dateLabel.replace('-', ' ')

    return (
      <a class="panel" href={routes.history.href()} aria-labelledby="season-heading" mix={panelStyle}>
        <div class="head">
          <h2 id="season-heading">Historical trend</h2>
          <span class="more">
            All seasons <ChevronRight />
          </span>
        </div>
        <div class="verdict">
          <span class="figure">{c.current != null ? `${c.current} cm` : '–'}</span>
          <span class="vs">
            {inSeason ? (
              <>
                by {date}, <b class={verdictClass}>{diff != null ? `${signed(diff)} cm` : '–'}</b> vs. the {c.mean} cm
                mean
              </>
            ) : (
              <>off-season; last season closed at {c.current ?? '–'} cm</>
            )}
          </span>
        </div>
        <div class="chart">
          <span class="wide">
            <SeasonBand dates={dates} band={c.band} current={current} todayIndex={todayIndex} width={520} height={112} compact />
          </span>
          <span class="narrow">
            <SeasonBand dates={dates} band={c.band} current={current} todayIndex={todayIndex} width={340} height={128} compact />
          </span>
        </div>
        <div class="legend">
          <span>
            <i></i>
            {label}
          </span>
          <span>
            <i class="mean"></i>Mean
          </span>
          <span>
            <i class="range"></i>Range since 07-08
          </span>
        </div>
        <dl class="facts">
          <div>
            <dt>Rank by {date}</dt>
            <dd>{c.rank != null ? `${c.rank} of ${c.comparedCount + 1}` : '–'}</dd>
          </div>
          <div>
            {c.projectedTotal != null && inSeason ? (
              <>
                <dt>On pace for</dt>
                <dd>
                  {c.projectedTotal} cm
                  {c.endOfSeason.mean != null ? <small>mean {c.endOfSeason.mean}</small> : null}
                </dd>
              </>
            ) : (
              <>
                <dt>Record season</dt>
                <dd>
                  {c.endOfSeason.max ? (
                    <>
                      {c.endOfSeason.max.value} cm<small>{c.endOfSeason.max.label}</small>
                    </>
                  ) : (
                    '–'
                  )}
                </dd>
              </>
            )}
          </div>
          <div>
            <dt>Most by {date}</dt>
            <dd>
              {c.max ? (
                <>
                  {c.max.value} cm<small>{c.max.label}</small>
                </>
              ) : (
                '–'
              )}
            </dd>
          </div>
          <div>
            <dt>Least by {date}</dt>
            <dd>
              {c.min ? (
                <>
                  {c.min.value} cm<small>{c.min.label}</small>
                </>
              ) : (
                '–'
              )}
            </dd>
          </div>
        </dl>
      </a>
    )
  }
}
