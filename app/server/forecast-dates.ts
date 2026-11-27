// Map the resort's day names ("Today", "Tonight", "Saturday") onto real dates.
export const RESORT_TIMEZONE = 'America/Vancouver'

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export interface DateKey {
  date: string
  key: string
}

// The resort-local calendar date, as a UTC-midnight Date so day arithmetic is DST-proof.
export function getLocalDate(referenceDate: Date): Date {
  let localDateStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: RESORT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(referenceDate)
  return new Date(localDateStr + 'T00:00:00Z')
}

export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

// weekOffset handles 10-day forecasts where day names repeat: the second
// occurrence of "Saturday" is the following week.
export function dayNameToDateKey(
  dayName: string,
  referenceDate: Date = new Date(),
  weekOffset = 0,
): DateKey | null {
  let today = getLocalDate(referenceDate)

  if (dayName === 'Today' || dayName === 'Tonight') {
    let d = new Date(today)
    d.setUTCDate(d.getUTCDate() + weekOffset * 7)
    let date = formatDate(d)
    return { date, key: `${date}:${dayName === 'Today' ? 'day' : 'night'}` }
  }

  let targetIndex = WEEKDAYS.indexOf(dayName)
  if (targetIndex === -1) return null

  let daysUntil = targetIndex - today.getUTCDay()
  if (daysUntil <= 0) daysUntil += 7
  daysUntil += weekOffset * 7

  let targetDate = new Date(today)
  targetDate.setUTCDate(targetDate.getUTCDate() + daysUntil)
  let date = formatDate(targetDate)
  return { date, key: date }
}

// Assign dates to a forecast's day names in document order. "Today" and "Tonight"
// are the resort-local date. Each weekday name takes the first date on or after
// the running cursor with that weekday, and the cursor then moves past it, so a
// stale evening page listing "Tonight" then today's own weekday maps that
// weekday to today (not next week), and a repeated weekday name in a 10-day
// forecast lands a week later.
export function assignForecastDates(dayNames: string[], referenceDate: Date = new Date()): Array<DateKey | null> {
  let today = getLocalDate(referenceDate)
  let cursor = new Date(today)
  let result: Array<DateKey | null> = []

  for (let dayName of dayNames) {
    if (dayName === 'Today' || dayName === 'Tonight') {
      let date = formatDate(today)
      result.push({ date, key: `${date}:${dayName === 'Today' ? 'day' : 'night'}` })
      continue
    }

    let targetIndex = WEEKDAYS.indexOf(dayName)
    if (targetIndex === -1) {
      result.push(null)
      continue
    }

    let daysUntil = (targetIndex - cursor.getUTCDay() + 7) % 7
    let target = new Date(cursor)
    target.setUTCDate(target.getUTCDate() + daysUntil)
    let date = formatDate(target)
    result.push({ date, key: date })

    cursor = new Date(target)
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return result
}
