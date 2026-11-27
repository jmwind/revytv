import { clientEntry, css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

import { Arrow, Close, WeatherIcon, weatherKind } from './icons.tsx'
import {
  formatDateTime,
  formatShortDate,
  freezingLabel,
  freezingShort,
  signed,
  trendOf,
  type Revision,
} from './format.ts'
import { Sparkline } from './sparkline.tsx'

export interface ForecastDayLite {
  day: string
  amount: number
  freezingLevel: number | 'valley bottom' | null
  description: string | null
  actualDate?: string
  history: Revision[]
}

// Where the lifts top out, in metres, from the resort's own figures. The forecast's
// freezing level is read against them. Subpeak is the hike above the Stoke.
const SUBPEAK = { label: 'Subpeak', m: 2340 }
const ELEVATIONS = [
  { label: 'Stoke', m: 2225 },
  { label: 'Ripper', m: 1960 },
  { label: 'Top Gon', m: 1694 },
  { label: 'Mid Gon', m: 800 },
  { label: 'Village', m: 512 },
]
const LEGEND = [SUBPEAK, ...ELEVATIONS.filter((e) => e.label !== 'Village')]
const Y_MAX = 2350
const Y_MIN = 400
const PLOT_H = 150

function elevationY(m: number): number {
  let clamped = Math.min(Y_MAX, Math.max(Y_MIN, m))
  return ((Y_MAX - clamped) / (Y_MAX - Y_MIN)) * PLOT_H
}

const stripStyle = css({
  '--cols': 10,
  '--gutter': '88px',
  '& .days': {
    display: 'grid',
    gridTemplateColumns: 'var(--gutter) repeat(var(--cols), minmax(0, 1fr))',
    borderBottom: '1px solid var(--rule)',
  },
  '& .days .gutter, & .profile .labels': {
    position: 'sticky',
    left: 0,
    zIndex: 1,
    background: 'var(--panel)',
  },
  '& .days .gutter': {
    borderRight: '1px solid var(--rule)',
    padding: '12px 10px',
    color: 'var(--ink-3)',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'flex-end',
  },
  '& .day': {
    appearance: 'none',
    background: 'none',
    border: 0,
    borderRight: '1px solid var(--rule-2)',
    padding: '12px 8px 10px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    textAlign: 'center',
    cursor: 'pointer',
    minWidth: 0,
    boxShadow: 'inset 0 3px 0 var(--tone)',
    transition: 'filter 150ms var(--ease-out)',
  },
  '& .day:last-child': { borderRight: 0 },
  // Snow day or not, readable from across the room: green means it snows, red means it does not.
  '& .day.snow': { '--tone': 'var(--up)', background: 'var(--up-soft)' },
  '& .day.calm': { '--tone': 'var(--down)', background: 'var(--down-soft)' },
  '& .day:hover': { filter: 'saturate(1.3)' },
  '& .day .name': { fontWeight: 600, fontSize: '13px', lineHeight: 1.2 },
  '& .day .date': { color: 'var(--ink-3)', fontSize: '12px' },
  '& .day .icon': { color: 'var(--tone)', margin: '4px 0 2px' },
  '& .day .amount': {
    fontFamily: 'var(--font-cond)',
    fontWeight: 600,
    fontSize: '32px',
    lineHeight: 1,
    letterSpacing: '-0.02em',
    color: 'var(--tone)',
  },
  '& .day .amount small': { fontSize: '12px', color: 'var(--ink-3)', marginLeft: '2px', letterSpacing: 0 },
  '& .delta': {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '3px',
    fontSize: '12px',
    fontWeight: 600,
    minHeight: '16px',
  },
  '& .delta svg': { flexShrink: 0 },
  '& .delta.flat': { color: 'var(--ink-3)', fontWeight: 500 },
  '& .spark': { height: '18px', marginTop: '2px', display: 'flex', alignItems: 'center' },
  '& .fl': { color: 'var(--ink-2)', fontSize: '12px', marginTop: '2px' },
  '& .fl small': { display: 'none' },
  '& .profile': {
    display: 'grid',
    gridTemplateColumns: 'var(--gutter) minmax(0, 1fr)',
  },
  '& .profile .labels': {
    position: 'relative',
    height: `${PLOT_H}px`,
    borderRight: '1px solid var(--rule)',
    fontSize: '11px',
    color: 'var(--ink-2)',
    overflow: 'hidden',
  },
  '& .profile .labels span': {
    position: 'absolute',
    left: '8px',
    right: '8px',
    textAlign: 'right',
    transform: 'translateY(-50%)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'clip',
    lineHeight: 1,
  },
  '& .profile .labels span b': { color: 'var(--ink)', fontWeight: 600, marginRight: '3px' },
  '& .profile svg': { width: '100%', height: `${PLOT_H}px`, display: 'block' },
  '& .caption': {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    padding: '8px 12px 10px',
    borderTop: '1px solid var(--rule-2)',
    color: 'var(--ink-2)',
    fontSize: '12px',
  },
  '& .elevations': {
    display: 'flex',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    gap: '4px 14px',
    padding: '8px 12px 10px',
    borderTop: '1px solid var(--rule-2)',
    color: 'var(--ink-2)',
    fontSize: '12px',
  },
  '& .elevations .key': { color: 'var(--ink-3)', textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '11px', marginRight: '2px' },
  '& .elevations b': { color: 'var(--ink)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' },
  '& .elevations small': { fontSize: '11px', color: 'var(--ink-3)', marginLeft: '1px' },
  '& .caption i': {
    display: 'inline-block',
    width: '10px',
    height: '10px',
    background: 'var(--route-soft)',
    border: '1px solid var(--route)',
    verticalAlign: '-1px',
    marginRight: '5px',
  },
  // Phones: one row per period, nothing to scroll sideways. The freezing level is read
  // against the lifts in words, since the profile chart needs the width.
  '@media (max-width: 720px)': {
    '& .days': { display: 'block' },
    '& .days .gutter, & .profile, & .caption': { display: 'none' },
    '& .day': {
      width: '100%',
      display: 'grid',
      gridTemplateColumns: '64px 28px 64px minmax(0, 1fr) auto',
      gridTemplateAreas: '"name icon amount delta fl" "date icon amount spark fl"',
      alignItems: 'center',
      columnGap: '10px',
      rowGap: '0',
      textAlign: 'left',
      padding: '8px 14px 8px 16px',
      borderRight: 0,
      borderBottom: '1px solid var(--rule-2)',
      boxShadow: 'inset 3px 0 0 var(--tone)',
    },
    '& .day:last-child': { borderBottom: 0 },
    '& .day .name': { gridArea: 'name', alignSelf: 'end' },
    '& .day .date': { gridArea: 'date', alignSelf: 'start' },
    '& .day .icon': { gridArea: 'icon', margin: 0 },
    '& .day .amount': { gridArea: 'amount', fontSize: '28px' },
    '& .delta': { gridArea: 'delta', alignSelf: 'end', minHeight: 0 },
    '& .spark': { gridArea: 'spark', alignSelf: 'start', marginTop: 0, height: '16px' },
    '& .fl': { gridArea: 'fl', marginTop: 0, textAlign: 'right', lineHeight: 1.25 },
    '& .fl small': { display: 'block', color: 'var(--ink-3)', fontSize: '11px' },
  },
})

// The day detail opens as a modal so the page never has to scroll to it.
const dialogStyle = css({
  padding: 0,
  border: '1px solid var(--rule)',
  borderRadius: 'var(--radius-m)',
  background: 'var(--panel)',
  color: 'var(--ink)',
  width: 'min(94vw, 860px)',
  maxHeight: '90vh',
  overflow: 'auto',
  boxShadow: '0 24px 64px rgb(0 0 0 / 0.35)',
  '&::backdrop': { background: 'var(--scrim)', backdropFilter: 'blur(2px)' },
  '@media (max-width: 720px)': {
    // A sheet from the bottom edge on phones.
    width: '100%',
    maxWidth: '100%',
    margin: 'auto 0 0',
    maxHeight: '88vh',
    borderRadius: 'var(--radius-m) var(--radius-m) 0 0',
    borderBottom: 0,
  },
})

const detailStyle = css({
  padding: '16px 20px 20px',
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.4fr)',
  gap: '16px 32px',
  '& header': {
    gridColumn: '1 / -1',
    display: 'flex',
    alignItems: 'baseline',
    gap: '12px',
  },
  '& header h3': { fontSize: '19px', fontWeight: 600 },
  '& header .date': { color: 'var(--ink-2)' },
  '& header button': {
    marginLeft: 'auto',
    appearance: 'none',
    background: 'none',
    border: '1px solid var(--rule)',
    borderRadius: 'var(--radius-s)',
    width: '28px',
    height: '28px',
    display: 'grid',
    placeItems: 'center',
    cursor: 'pointer',
    color: 'var(--ink-2)',
  },
  '& header button:hover': { color: 'var(--ink)', borderColor: 'var(--ink-3)' },
  '& dl': {
    margin: 0,
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: '6px 16px',
    alignContent: 'start',
  },
  '& dt': { color: 'var(--ink-2)' },
  '& dd': { margin: 0, fontWeight: 600 },
  '& dd.desc': { fontWeight: 400, color: 'var(--ink)', textWrap: 'pretty' },
  '& table': { width: '100%', fontSize: '13px' },
  '& th': {
    textAlign: 'left',
    fontWeight: 500,
    color: 'var(--ink-2)',
    padding: '4px 8px 6px 0',
    borderBottom: '1px solid var(--rule-strong)',
  },
  '& td': { padding: '5px 8px 5px 0', borderBottom: '1px solid var(--rule-2)' },
  '& td.n, & th.n': { textAlign: 'right', paddingRight: 0 },
  '& .big-spark': { margin: '4px 0 12px', color: 'var(--ink)' },
  '& .empty': { color: 'var(--ink-2)' },
  '@media (max-width: 720px)': { gridTemplateColumns: '1fr' },
})

export const ForecastStrip = clientEntry(
  import.meta.url,
  function ForecastStrip(handle: Handle<{ days: ForecastDayLite[] }>) {
    let selected: number | null = null
    let dialog: HTMLDialogElement | undefined

    let show = (i: number) => {
      selected = i
      handle.update()
      handle.queueTask(() => {
        if (dialog && !dialog.open) dialog.showModal()
      })
    }
    let hide = () => {
      dialog?.close()
      if (selected != null) {
        selected = null
        handle.update()
      }
    }

    return () => {
      let { days } = handle.props
      let n = Math.max(days.length, 1)
      let colW = 1000 / n
      let open = selected != null ? days[selected] : undefined

      return (
        <section class="panel" aria-labelledby="forecast-heading" mix={stripStyle} style={{ '--cols': n }}>
          <h2 id="forecast-heading" class="visually-hidden">
            Alpine forecast
          </h2>
          <div class="scroller">
            <div class="days">
              <div class="gutter" aria-hidden="true">
                Alpine
              </div>
              {days.map((d, i) => {
                let trend = trendOf(d.history)
                let kind = weatherKind(d.description, d.amount)
                let cls = ['day', d.amount > 0 ? 'snow' : 'calm'].join(' ')
                return (
                  <button
                    key={`${d.actualDate ?? ''}:${d.day}:${i}`}
                    type="button"
                    class={cls}
                    aria-haspopup="dialog"
                    mix={on('click', () => show(i))}
                  >
                    <span class="name">{d.day}</span>
                    <span class="date">{d.actualDate ? formatShortDate(d.actualDate) : ''}</span>
                    <span class="icon">
                      <WeatherIcon kind={kind} size={22} />
                    </span>
                    <span class="amount">
                      {d.amount}
                      <small>cm</small>
                    </span>
                    <span
                      class={`delta ${trend.direction}`}
                      title={trend.direction === 'flat' ? 'Unchanged since first forecast' : `Changed ${signed(trend.change)} cm since first forecast`}
                    >
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
                      <Sparkline history={d.history} width={72} height={18} />
                    </span>
                    <span class="fl">
                      {freezingShort(d.freezingLevel)}
                      <small>freezing level</small>
                    </span>
                  </button>
                )
              })}
            </div>
            <div class="profile" aria-hidden="true">
              <div class="labels">
                {ELEVATIONS.map((e) => (
                  <span key={e.label} style={{ top: `${elevationY(e.m)}px` }}>
                    <b>{e.m}</b>
                    {e.label}
                  </span>
                ))}
              </div>
              <svg viewBox={`0 0 1000 ${PLOT_H}`} preserveAspectRatio="none">
                {days.map((d, i) => {
                  if (d.freezingLevel == null) {
                    // No freezing level reported: a dashed tick at the base so the column is not mistaken for "very high".
                    return (
                      <line
                        key={`nofl-${i}`}
                        x1={i * colW + 4}
                        x2={(i + 1) * colW - 4}
                        y1={PLOT_H - 2}
                        y2={PLOT_H - 2}
                        stroke="var(--ink-3)"
                        stroke-width="1.5"
                        stroke-dasharray="3 3"
                        vector-effect="non-scaling-stroke"
                      />
                    )
                  }
                  let fl = d.freezingLevel === 'valley bottom' ? Y_MIN : d.freezingLevel
                  let y = elevationY(fl)
                  let x = i * colW
                  return (
                    <g key={`shade-${i}`}>
                      <rect x={x} y={0} width={colW} height={y} fill="var(--route-soft)" />
                      <line
                        x1={x + 4}
                        x2={x + colW - 4}
                        y1={y}
                        y2={y}
                        stroke="var(--route)"
                        stroke-width="2"
                        vector-effect="non-scaling-stroke"
                      />
                    </g>
                  )
                })}
                {ELEVATIONS.map((e) => (
                  <line
                    key={e.label}
                    x1="0"
                    x2="1000"
                    y1={elevationY(e.m)}
                    y2={elevationY(e.m)}
                    stroke={e.label === 'Stoke' || e.label === 'Village' ? 'var(--rule)' : 'var(--ink-3)'}
                    stroke-dasharray={e.label === 'Stoke' || e.label === 'Village' ? undefined : '2 4'}
                    stroke-width="1"
                    vector-effect="non-scaling-stroke"
                  />
                ))}
                {days.map((_, i) =>
                  i === 0 ? null : (
                    <line
                      key={`sep-${i}`}
                      x1={i * colW}
                      x2={i * colW}
                      y1="0"
                      y2={PLOT_H}
                      stroke="var(--rule-2)"
                      stroke-width="1"
                      vector-effect="non-scaling-stroke"
                    />
                  ),
                )}
              </svg>
            </div>
          </div>
          <div class="caption">
            <span class="profile-note">
              <i></i>Snowing above the freezing level
            </span>
          </div>
          <div class="elevations">
            <span class="key">Elevations</span>
            {LEGEND.map((e) => (
              <span key={e.label}>
                <b>{e.m}</b>
                <small>m</small> {e.label}
              </span>
            ))}
          </div>
          <dialog
            mix={[
              dialogStyle,
              ref((node) => (dialog = node)),
              on('click', (event) => {
                if (event.target === event.currentTarget) hide()
              }),
              on('close', () => {
                if (selected != null) {
                  selected = null
                  handle.update()
                }
              }),
            ]}
            aria-labelledby={`${handle.id}-detail-title`}
          >
            {open ? (
              <div mix={detailStyle}>
                <header>
                  <h3 id={`${handle.id}-detail-title`}>{open.day}</h3>
                  <span class="date">{open.actualDate ?? ''}</span>
                  <button type="button" aria-label="Close details" mix={on('click', hide)}>
                    <Close size={14} />
                  </button>
                </header>
                <dl>
                  <dt>Forecast</dt>
                  <dd>{open.amount} cm</dd>
                  <dt>Since first forecast</dt>
                  <dd>
                    {open.history.length > 1
                      ? `${signed(trendOf(open.history).change)} cm over ${open.history.length} revisions`
                      : 'No revisions yet'}
                  </dd>
                  <dt>Freezing level</dt>
                  <dd>{freezingLabel(open.freezingLevel)?.replace('Freezing ', '') ?? '–'}</dd>
                  {open.description ? (
                    <>
                      <dt>Outlook</dt>
                      <dd class="desc">{open.description}</dd>
                    </>
                  ) : null}
                </dl>
                <div>
                  {open.history.length > 1 ? (
                    <div class="big-spark">
                      <Sparkline history={open.history} width={420} height={56} />
                    </div>
                  ) : null}
                  {open.history.length > 0 ? (
                    <table>
                      <thead>
                        <tr>
                          <th>Recorded</th>
                          <th class="n">Snow</th>
                          <th class="n">Change</th>
                          <th class="n">Freezing</th>
                        </tr>
                      </thead>
                      <tbody>
                        {open.history.map((h, i) => {
                          let prev = i > 0 ? open!.history[i - 1]!.amount : h.amount
                          let change = h.amount - prev
                          return (
                            <tr key={h.firstSeen}>
                              <td>{formatDateTime(h.firstSeen)}</td>
                              <td class="n">{h.amount} cm</td>
                              <td class={`n ${change > 0 ? 'delta-up' : change < 0 ? 'delta-down' : 'delta-flat'}`}>
                                {i === 0 ? '–' : signed(change)}
                              </td>
                              <td class="n">{freezingShort(h.freezingLevel)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  ) : (
                    <p class="empty">No recorded revisions for this day yet.</p>
                  )}
                </div>
              </div>
            ) : null}
          </dialog>
        </section>
      )
    }
  },
)
