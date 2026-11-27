import type { Handle } from 'remix/component'

export interface Band {
  min: (number | null)[]
  max: (number | null)[]
  mean: (number | null)[]
}

export interface Overlay {
  label: string
  values: (number | null)[]
  color: string
  width?: number
  dash?: string
}

export interface SeasonBandProps {
  dates: string[]
  band: Band
  current: (number | null)[]
  todayIndex: number | null
  overlays?: Overlay[]
  hoverIndex?: number | null
  width?: number
  height?: number
  compact?: boolean
  yMax?: number
}

// Month starts along the fixed Nov 1 to Apr 20 axis.
export const MONTH_TICKS: Array<{ index: number; label: string }> = [
  { index: 0, label: 'Nov' },
  { index: 30, label: 'Dec' },
  { index: 61, label: 'Jan' },
  { index: 92, label: 'Feb' },
  { index: 120, label: 'Mar' },
  { index: 151, label: 'Apr' },
]

export function niceMax(values: Array<number | null | undefined>): number {
  let max = 0
  for (let v of values) if (v != null && v > max) max = v
  let step = max > 1200 ? 400 : 200
  return Math.max(step, Math.ceil((max * 1.04) / step) * step)
}

function path(values: (number | null)[], x: (i: number) => number, y: (v: number) => number, upTo?: number): string {
  let d = ''
  let pen = false
  let end = upTo ?? values.length - 1
  for (let i = 0; i <= end && i < values.length; i++) {
    let v = values[i]
    if (v == null) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(v).toFixed(1)}`
    pen = true
  }
  return d
}

function area(band: Band, x: (i: number) => number, y: (v: number) => number): string {
  let top = ''
  let bottom: string[] = []
  let pen = false
  for (let i = 0; i < band.max.length; i++) {
    let hi = band.max[i]
    let lo = band.min[i]
    if (hi == null || lo == null) {
      pen = false
      continue
    }
    top += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(hi).toFixed(1)}`
    bottom.push(`L${x(i).toFixed(1)} ${y(lo).toFixed(1)}`)
    pen = true
  }
  return top + bottom.reverse().join('') + 'Z'
}

// Every season since 2007-08 as a hatched range, the mean dashed, this season in route ink.
// The axis never changes: Nov 1 to Apr 20, so the small and large charts register.
export function SeasonBand(handle: Handle<SeasonBandProps>) {
  return () => {
    let {
      dates,
      band,
      current,
      todayIndex,
      overlays = [],
      hoverIndex = null,
      width = 600,
      height = 220,
      compact = false,
    } = handle.props
    let pad = compact ? { t: 8, r: 8, b: 18, l: 34 } : { t: 12, r: 16, b: 24, l: 44 }
    let n = dates.length
    let yMax = handle.props.yMax ?? niceMax([...band.max, ...current, ...overlays.flatMap((o) => o.values)])
    let plotW = width - pad.l - pad.r
    let plotH = height - pad.t - pad.b
    let x = (i: number) => pad.l + (i / (n - 1)) * plotW
    let y = (v: number) => pad.t + plotH - (v / yMax) * plotH
    let hatchId = `${handle.id}-hatch`

    let yTicks: number[] = []
    let step = yMax > 1200 ? 400 : 200
    for (let v = 0; v <= yMax; v += step) yTicks.push(v)

    let todayValue = todayIndex != null ? current[todayIndex] : null
    let hover = hoverIndex != null && hoverIndex >= 0 && hoverIndex < n ? hoverIndex : null

    return (
      <svg
        class="season-band"
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label="Season snowfall compared with the historical range"
        style={{ fontFamily: 'var(--font)', fontSize: '11px' }}
      >
        <defs>
          <pattern id={hatchId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="var(--ink-3)" stroke-width="1" stroke-opacity="0.55" />
          </pattern>
        </defs>

        {yTicks.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={width - pad.r} y1={y(v)} y2={y(v)} stroke="var(--rule-2)" stroke-width="1" />
            <text x={pad.l - 6} y={y(v) + 3} text-anchor="end" fill="var(--ink-3)">
              {v}
            </text>
          </g>
        ))}
        {MONTH_TICKS.map((t) => (
          <g key={t.label}>
            <line x1={x(t.index)} x2={x(t.index)} y1={pad.t} y2={pad.t + plotH} stroke="var(--rule-2)" stroke-width="1" />
            <text x={x(t.index) + 3} y={height - 6} fill="var(--ink-3)">
              {t.label}
            </text>
          </g>
        ))}

        <path d={area(band, x, y)} fill={`url(#${hatchId})`} stroke="var(--rule)" stroke-width="1" />
        <path d={path(band.mean, x, y)} fill="none" stroke="var(--ink-2)" stroke-width="1.25" stroke-dasharray="4 3" />

        {overlays.map((o) => (
          <path
            key={o.label}
            d={path(o.values, x, y)}
            fill="none"
            stroke={o.color}
            stroke-width={o.width ?? 1.5}
            stroke-dasharray={o.dash}
            stroke-linejoin="round"
          />
        ))}

        <path
          d={path(current, x, y, todayIndex ?? undefined)}
          fill="none"
          stroke="var(--route)"
          stroke-width={compact ? 2 : 2.5}
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        {todayIndex != null && todayValue != null ? (
          <g>
            <circle cx={x(todayIndex)} cy={y(todayValue)} r={compact ? 3 : 4} fill="var(--route)" stroke="var(--panel)" stroke-width="1.5" />
            {!compact ? (
              <text
                x={x(todayIndex) + (todayIndex > n * 0.8 ? -8 : 8)}
                y={y(todayValue) - 8}
                text-anchor={todayIndex > n * 0.8 ? 'end' : 'start'}
                fill="var(--route)"
                font-weight="600"
              >
                {todayValue} cm
              </text>
            ) : null}
          </g>
        ) : null}

        {hover != null ? (
          <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + plotH} stroke="var(--ink)" stroke-width="1" stroke-dasharray="2 2" />
        ) : null}

        <line x1={pad.l} x2={width - pad.r} y1={pad.t + plotH} y2={pad.t + plotH} stroke="var(--rule-strong)" stroke-width="1" />
      </svg>
    )
  }
}
