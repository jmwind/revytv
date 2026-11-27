import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'

import { agoLabel, formatDateTime, formatTime } from './format.ts'

const REFRESH_MS = 10 * 60 * 1000

const style = css({
  color: 'var(--ink-3)',
  fontSize: '12px',
  whiteSpace: 'nowrap',
  '& b': { color: 'var(--ink-2)', fontWeight: 500 },
})

export interface FreshnessProps {
  /** When the resort's figures last changed. */
  changedAt: string
  /** When Environment Canada issued the forecast, if the page says. */
  issuedAt: string | null
  /** When our server last read the page. */
  fetchedAt: string
}

// "Forecast 1:00 a.m.", with the rest in the tooltip; reloads the page every ten minutes.
export const Freshness = clientEntry(import.meta.url, function Freshness(handle: Handle<FreshnessProps>) {
  let now: number | null = null

  handle.queueTask(() => {
    if (handle.signal.aborted) return
    now = Date.now()
    handle.update()
    let tick = setInterval(() => {
      now = Date.now()
      handle.update()
    }, 30_000)
    let reload = setInterval(() => {
      if (document.visibilityState === 'visible') handle.frames.top.reload()
    }, REFRESH_MS)
    handle.signal.addEventListener('abort', () => {
      clearInterval(tick)
      clearInterval(reload)
    })
  })

  return () => {
    let { changedAt, issuedAt, fetchedAt } = handle.props
    let title = [
      issuedAt ? `Environment Canada forecast issued ${formatDateTime(issuedAt)}` : null,
      `Resort figures last changed ${formatDateTime(changedAt)}`,
      `Page checked ${formatTime(fetchedAt)}, every 10 minutes`,
    ]
      .filter(Boolean)
      .join(' · ')
    return (
      <span mix={style} title={title}>
        {issuedAt ? (
          <>
            Forecast <b>{formatTime(issuedAt)}</b>
          </>
        ) : (
          <>
            Checked <b>{now ? agoLabel(fetchedAt, now) : formatTime(fetchedAt)}</b>
          </>
        )}
      </span>
    )
  }
})
