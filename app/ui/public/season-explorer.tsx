import { clientEntry, css, on, ref } from 'remix/component'
import type { Handle } from 'remix/component'

import { formatShortDate } from './format.ts'
import { MONTH_TICKS, SeasonBand, niceMax, type Band, type Overlay } from './season-band.tsx'

export interface ExplorerSeason {
  label: string
  values: (number | null)[]
  total: number
}

export interface SeasonExplorerProps {
  dates: string[]
  band: Band
  current: (number | null)[]
  currentLabel: string
  todayIndex: number
  inSeason: boolean
  seasons: ExplorerSeason[]
  startYear: number
  meanTotal: number | null
}

// Distinguishable inks for overlaid seasons, none of them the route colour.
const INKS = ['#d97706', '#0f9d8a', '#c2417a', '#6d28d9', '#65a30d', '#9a5b2a', '#0284c7', '#dc2626']

const style = css({
  '& .chart': { padding: '14px 12px 6px', position: 'relative' },
  '& .chart svg': { cursor: 'crosshair', touchAction: 'pan-y' },
  '& .readout': {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: '8px 20px',
    padding: '10px 20px 14px',
    borderTop: '1px solid var(--rule-2)',
    fontSize: '13px',
    minHeight: '62px',
  },
  '& .readout .k': { color: 'var(--ink-2)' },
  '& .readout .v': { fontFamily: 'var(--font-cond)', fontSize: '19px', fontWeight: 600, lineHeight: 1.1 },
  '& .readout .v small': { fontFamily: 'var(--font)', fontSize: '12px', fontWeight: 500, color: 'var(--ink-3)', marginLeft: '4px' },
  '& .readout .v i': { display: 'inline-block', width: '10px', height: '3px', verticalAlign: 'middle', marginRight: '6px' },
  '& .seasons': {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(118px, 1fr))',
    gap: '2px',
    padding: '12px 14px 14px',
    borderTop: '1px solid var(--rule-strong)',
  },
  '& .seasons label': {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '6px 8px',
    borderRadius: 'var(--radius-s)',
    cursor: 'pointer',
    fontSize: '13px',
    userSelect: 'none',
  },
  '& .seasons label:hover': { background: 'var(--panel-2)' },
  '& .seasons input': { accentColor: 'var(--route)', margin: 0 },
  '& .seasons .tot': { marginLeft: 'auto', fontFamily: 'var(--font-cond)', fontWeight: 600, fontSize: '14px' },
  '& .seasons label.on .tot': { color: 'var(--swatch)' },
  '& .seasons label.current': { background: 'var(--route-soft)' },
  '& .seasons .hint': { gridColumn: '1 / -1', color: 'var(--ink-3)', fontSize: '12px', padding: '4px 8px 0' },
})

export const SeasonExplorer = clientEntry(import.meta.url, function SeasonExplorer(handle: Handle<SeasonExplorerProps>) {
  let hover: number | null = null
  let selected = new Set<string>()
  let svgEl: SVGSVGElement | undefined
  let narrow = false

  // Phones get a narrower drawing so axis text keeps its size instead of scaling to specks.
  handle.queueTask(() => {
    if (handle.signal.aborted) return
    let mq = window.matchMedia('(max-width: 720px)')
    let apply = () => {
      if (mq.matches !== narrow) {
        narrow = mq.matches
        handle.update()
      }
    }
    apply()
    mq.addEventListener('change', apply, { signal: handle.signal })
  })

  let indexFromEvent = (event: PointerEvent) => {
    if (!svgEl) return null
    let rect = svgEl.getBoundingClientRect()
    let width = narrow ? 420 : 900
    let pad = { l: 44, r: 16 }
    let xUser = ((event.clientX - rect.left) / rect.width) * width
    let frac = (xUser - pad.l) / (width - pad.l - pad.r)
    let n = handle.props.dates.length
    let i = Math.round(frac * (n - 1))
    return i < 0 || i >= n ? null : i
  }

  return () => {
    let { dates, band, current, currentLabel, todayIndex, inSeason, seasons, startYear, meanTotal } = handle.props
    let overlays: Overlay[] = []
    for (let [k, label] of [...selected].entries()) {
      let s = seasons.find((x) => x.label === label)
      if (s) overlays.push({ label, values: s.values, color: INKS[k % INKS.length]!, width: 1.5 })
    }
    let colorOf = (label: string) => overlays.find((o) => o.label === label)?.color
    let yMax = niceMax([...band.max, ...current, ...seasons.map((s) => s.total)])
    let i = hover ?? todayIndex
    let dateIso = seasonIndexToIso(startYear, i)
    let cur = i <= todayIndex ? current[i] : null
    let bandAt = { min: band.min[i], max: band.max[i], mean: band.mean[i] }
    let extremes = extremesAt(seasons, currentLabel, i)

    return (
      <section class="panel" aria-label="Season explorer" mix={style}>
        <div class="chart">
          <div
            mix={[
              ref((node) => {
                svgEl = node.querySelector('svg') ?? undefined
              }),
              on('pointermove', (event) => {
                let next = indexFromEvent(event)
                if (next !== hover) {
                  hover = next
                  handle.update()
                }
              }),
              on('pointerleave', () => {
                hover = null
                handle.update()
              }),
            ]}
          >
            <SeasonBand
              dates={dates}
              band={band}
              current={current}
              todayIndex={inSeason ? todayIndex : todayIndex}
              overlays={overlays}
              hoverIndex={hover}
              width={narrow ? 420 : 900}
              height={narrow ? 260 : 340}
              yMax={yMax}
            />
          </div>
        </div>
        <div class="readout" aria-live="polite">
          <div>
            <div class="k">{hover == null ? 'Today' : formatShortDate(dateIso)}</div>
            <div class="v">
              <i style={{ background: 'var(--route)' }}></i>
              {cur != null ? `${cur} cm` : '–'}
              <small>{currentLabel}</small>
            </div>
          </div>
          <div>
            <div class="k">Mean by this date</div>
            <div class="v">
              {bandAt.mean != null ? `${bandAt.mean} cm` : '–'}
              {cur != null && bandAt.mean != null ? (
                <small class={cur - bandAt.mean >= 0 ? 'delta-up' : 'delta-down'}>
                  {cur - bandAt.mean >= 0 ? '+' : ''}
                  {cur - bandAt.mean}
                </small>
              ) : null}
            </div>
          </div>
          <div>
            <div class="k">Most by this date</div>
            <div class="v">
              {extremes.max ? `${extremes.max.value} cm` : '–'}
              {extremes.max ? <small>{extremes.max.label}</small> : null}
            </div>
          </div>
          <div>
            <div class="k">Least by this date</div>
            <div class="v">
              {extremes.min ? `${extremes.min.value} cm` : '–'}
              {extremes.min ? <small>{extremes.min.label}</small> : null}
            </div>
          </div>
          {overlays.map((o) => {
            let s = seasons.find((x) => x.label === o.label)
            let v = s ? valueAt(s.values, i) : null
            return (
              <div key={o.label}>
                <div class="k">{o.label}</div>
                <div class="v">
                  <i style={{ background: o.color }}></i>
                  {v != null ? `${v} cm` : '–'}
                </div>
              </div>
            )
          })}
        </div>
        <div class="seasons" role="group" aria-label="Overlay seasons">
          {seasons.map((s) => {
            let on_ = selected.has(s.label)
            let isCurrent = s.label === currentLabel
            return (
              <label key={s.label} class={[on_ ? 'on' : '', isCurrent ? 'current' : ''].join(' ').trim() || undefined} style={{ '--swatch': colorOf(s.label) ?? 'var(--ink)' }}>
                <input
                  type="checkbox"
                  checked={on_}
                  disabled={isCurrent}
                  mix={on('change', (event) => {
                    if (event.currentTarget.checked) selected.add(s.label)
                    else selected.delete(s.label)
                    handle.update()
                  })}
                />
                {s.label}
                <span class="tot">{s.total}</span>
              </label>
            )
          })}
          <div class="hint">
            Season totals in cm at the resort's last reported day. Tick seasons to draw them over the range.{' '}
            {meanTotal != null ? `The mean season ends at ${meanTotal} cm.` : ''} Seasons 08-09 and 10-11 through 14-15 began reporting in December.
          </div>
        </div>
      </section>
    )
  }
})

function valueAt(values: (number | null)[], i: number): number | null {
  for (let k = Math.min(i, values.length - 1); k >= 0; k--) {
    let v = values[k]
    if (v != null) return v
  }
  return null
}

function extremesAt(seasons: ExplorerSeason[], currentLabel: string, i: number) {
  let min: { label: string; value: number } | null = null
  let max: { label: string; value: number } | null = null
  for (let s of seasons) {
    if (s.label === currentLabel) continue
    let v = valueAt(s.values, i)
    if (v == null) continue
    if (!min || v < min.value) min = { label: s.label, value: v }
    if (!max || v > max.value) max = { label: s.label, value: v }
  }
  return { min, max }
}

function seasonIndexToIso(startYear: number, index: number): string {
  let d = new Date(Date.UTC(startYear, 10, 1 + index))
  return d.toISOString().slice(0, 10)
}

export { MONTH_TICKS }
