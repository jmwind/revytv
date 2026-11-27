// Everything recorded for a calendar year: forecast revisions per date,
// daily season totals for the ski season, and daily new-snow actuals.
import type { ForecastRecord, NewSnowRecord, SeasonTotalRecord } from './snow-report.ts'
import { storage as defaultStorage, type ForecastRevision, type KeyValueStore, type StorageMode } from './storage.ts'

export interface CalendarDay {
  date: string
  history: ForecastRevision[]
  firstAmount: number
  lastAmount: number
  delta: number
  historyCount: number
}

export interface CalendarData {
  year: number
  data: Record<string, CalendarDay>
  snowfall: Record<string, SeasonTotalRecord>
  newSnow: Record<string, NewSnowRecord>
  count: number
  snowfallCount: number
  newSnowCount: number
  fetchedAt: string
  storageMode: StorageMode
}

const SEASON_START_MONTH = 10 // October

export async function getCalendarData(year: number, storage: KeyValueStore = defaultStorage): Promise<CalendarData> {
  let allRecords = await storage.getAllByPrefix<ForecastRecord>('forecast:')

  let groups: Record<string, { plain: ForecastRevision[]; day: ForecastRevision[]; night: ForecastRevision[] }> = {}

  for (let [key, record] of Object.entries(allRecords)) {
    if (!record?.history?.length) continue
    let dateMatch = key.match(/forecast:(\d{4}-\d{2}-\d{2})/)
    let dateStr = dateMatch?.[1]
    if (!dateStr || parseInt(dateStr.slice(0, 4), 10) !== year) continue

    let group = (groups[dateStr] ??= { plain: [], day: [], night: [] })
    if (key.includes(':day')) group.day = record.history
    else if (key.includes(':night')) group.night = record.history
    else group.plain = record.history
  }

  let data: Record<string, CalendarDay> = {}
  for (let [dateStr, group] of Object.entries(groups)) {
    let history = [...group.plain, ...group.day, ...group.night].sort(
      (a, b) => new Date(a.firstSeen).getTime() - new Date(b.firstSeen).getTime(),
    )
    let first = history[0]
    let last = history[history.length - 1]
    if (!first || !last) continue
    data[dateStr] = {
      date: dateStr,
      history,
      firstAmount: first.amount,
      lastAmount: last.amount,
      delta: last.amount - first.amount,
      historyCount: history.length,
    }
  }

  // Season totals: this year, plus the previous autumn so the season reads whole.
  let snowfall: Record<string, SeasonTotalRecord> = {}
  for (let record of Object.values(await storage.getAllByPrefix<SeasonTotalRecord>('snowfall:'))) {
    if (!record?.date) continue
    let recordYear = parseInt(record.date.slice(0, 4), 10)
    let recordMonth = parseInt(record.date.slice(5, 7), 10)
    let isCurrentYear = recordYear === year
    let isPreviousFall = recordYear === year - 1 && recordMonth >= SEASON_START_MONTH
    if (!isCurrentYear && !isPreviousFall) continue
    snowfall[record.date] = { date: record.date, seasonTotal: record.seasonTotal, recordedAt: record.recordedAt }
  }

  let newSnow: Record<string, NewSnowRecord> = {}
  for (let record of Object.values(await storage.getAllByPrefix<NewSnowRecord>('newsnow:'))) {
    if (!record?.date || parseInt(record.date.slice(0, 4), 10) !== year) continue
    newSnow[record.date] = { date: record.date, newSnow: record.newSnow, recordedAt: record.recordedAt }
  }

  return {
    year,
    data,
    snowfall,
    newSnow,
    count: Object.keys(data).length,
    snowfallCount: Object.keys(snowfall).length,
    newSnowCount: Object.keys(newSnow).length,
    fetchedAt: new Date().toISOString(),
    storageMode: storage.storageMode(),
  }
}
