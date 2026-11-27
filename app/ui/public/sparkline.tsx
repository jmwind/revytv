import type { Handle } from 'remix/component'

import { trendOf, type Revision } from './format.ts'

const COLOR = {
  up: 'var(--up)',
  down: 'var(--down)',
  flat: 'var(--flat)',
} as const

// How a forecast amount moved across its revisions. Flat line when it never changed.
export function Sparkline(handle: Handle<{ history: Revision[]; width?: number; height?: number }>) {
  return () => {
    let { history, width = 96, height = 22 } = handle.props
    if (history.length < 2) return null

    let amounts = history.map((h) => h.amount)
    let min = Math.min(...amounts)
    let max = Math.max(...amounts)
    let range = max - min || 1
    let pad = 2
    let step = (width - pad * 2) / (amounts.length - 1)
    let y = (v: number) => height - pad - ((v - min) / range) * (height - pad * 2)
    let points = amounts.map((v, i) => `${(pad + i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
    let last = amounts[amounts.length - 1]!
    let color = COLOR[trendOf(history).direction]

    return (
      <svg
        class="sparkline"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        style={{ color }}
      >
        <polyline fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" points={points} />
        <circle cx={width - pad} cy={y(last)} r="2.2" fill="currentColor" />
      </svg>
    )
  }
}
