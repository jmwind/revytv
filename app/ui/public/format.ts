// Shared formatting for server-rendered and hydrated components.

export interface Revision {
  firstSeen: string
  amount: number
  freezingLevel: number | 'valley bottom' | null
}

export type TrendDirection = 'up' | 'down' | 'flat'

export interface Trend {
  direction: TrendDirection
  change: number
}

export function trendOf(history: Revision[] | undefined): Trend {
  if (!history || history.length < 2) return { direction: 'flat', change: 0 }
  let first = history[0]!.amount
  let last = history[history.length - 1]!.amount
  let change = last - first
  return { direction: change > 0 ? 'up' : change < 0 ? 'down' : 'flat', change }
}

export function signed(n: number): string {
  if (n > 0) return `+${n}`
  if (n < 0) return `${n}`
  return '0'
}

export function freezingLabel(level: number | 'valley bottom' | null | undefined): string | null {
  if (level == null) return null
  if (level === 'valley bottom') return 'Freezing at valley bottom'
  return `Freezing ${level} m`
}

export function freezingShort(level: number | 'valley bottom' | null | undefined): string {
  if (level == null) return '–'
  if (level === 'valley bottom') return 'Valley'
  return `${level} m`
}

const RESORT_TZ = 'America/Vancouver'

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-CA', {
    timeZone: RESORT_TZ,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-CA', {
    timeZone: RESORT_TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

export function formatShortDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00`).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
  })
}

export function minutesAgo(iso: string, now = Date.now()): number {
  return Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000))
}

export function agoLabel(iso: string, now = Date.now()): string {
  let m = minutesAgo(iso, now)
  if (m < 1) return 'just now'
  if (m === 1) return '1 min ago'
  if (m < 60) return `${m} min ago`
  let h = Math.round(m / 60)
  return h === 1 ? '1 hr ago' : `${h} hr ago`
}
