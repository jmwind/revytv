import { clientEntry, css } from 'remix/component'
import type { Handle } from 'remix/component'

import { agoLabel, formatTime } from './format.ts'

const REFRESH_MS = 10 * 60 * 1000

const style = css({
  color: 'var(--ink-3)',
  fontSize: '12px',
  whiteSpace: 'nowrap',
  '& b': { color: 'var(--ink-2)', fontWeight: 500 },
})

// "Fetched 12 min ago" that keeps counting, and reloads the page data every ten minutes.
export const Freshness = clientEntry(import.meta.url, function Freshness(handle: Handle<{ fetchedAt: string; fromCache?: boolean }>) {
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
    let { fetchedAt } = handle.props
    return (
      <span mix={style} title={`Resort report fetched ${formatTime(fetchedAt)}, refreshes every 10 minutes`}>
        Report <b>{now ? agoLabel(fetchedAt, now) : formatTime(fetchedAt)}</b>
      </span>
    )
  }
})
