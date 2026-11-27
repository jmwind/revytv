// Season arithmetic in the resort's timezone. A season runs Nov 1 to Apr 20
// in the historical tracker (index 0 = Nov 1, index 170 = Apr 20).
import { RESORT_TIMEZONE } from './forecast-dates.ts'

export const SEASON_DAYS = 171
export const LAST_SEASON_INDEX = SEASON_DAYS - 1

interface LocalParts {
  year: number
  month: number // 1-12
  day: number
}

export function resortLocalParts(date: Date): LocalParts {
  let parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RESORT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)
  let pick = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0')
  return { year: pick('year'), month: pick('month'), day: pick('day') }
}

// Summer runs May 1 through Oct 31 inclusive.
export function isSummerSeason(date: Date = new Date()): boolean {
  let { month } = resortLocalParts(date)
  return month >= 5 && month <= 10
}

// The season starting in the autumn: Jul 1 2026 .. Jun 30 2027 belongs to 2026.
export function seasonStartYear(date: Date = new Date()): number {
  let { year, month } = resortLocalParts(date)
  return month >= 7 ? year : year - 1
}

export function seasonLabelForStartYear(startYear: number): string {
  let two = (y: number): string => String(y % 100).padStart(2, '0')
  return `${two(startYear)}-${two(startYear + 1)}`
}

export function seasonLabel(date: Date = new Date()): string {
  return seasonLabelForStartYear(seasonStartYear(date))
}

// Days since Nov 1 of the season. Negative before November, >170 after Apr 20.
export function dayOfSeasonIndex(date: Date = new Date()): number {
  let { year, month, day } = resortLocalParts(date)
  let startYear = seasonStartYear(date)
  let local = Date.UTC(year, month - 1, day)
  let nov1 = Date.UTC(startYear, 10, 1)
  return Math.round((local - nov1) / 86_400_000)
}

export function clampSeasonIndex(index: number): number {
  return Math.min(LAST_SEASON_INDEX, Math.max(0, index))
}

// Calendar date (YYYY-MM-DD) for a season index.
export function seasonIndexToDate(startYear: number, index: number): string {
  return new Date(Date.UTC(startYear, 10, 1 + index)).toISOString().slice(0, 10)
}
