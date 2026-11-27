// The resort's historical snowfall tracker: one cumulative series per season
// since 2007-08, Nov 1 to Apr 20. Cached in storage so we rarely refetch.
import type { SeasonTotalRecord } from './snow-report.ts'
import { LAST_SEASON_INDEX, SEASON_DAYS, seasonIndexToDate } from './season.ts'
import { storage as defaultStorage, type KeyValueStore } from './storage.ts'

export const HISTORICAL_URL = 'https://www.revelstokemountainresort.com/plugins/historical-snow-data/index.php'
const CACHE_KEY = 'historical:snowfall'
const MAX_AGE_MS = 12 * 60 * 60 * 1000
const MIN_SEASONS = 5
const USER_AGENT = 'Mozilla/5.0 (compatible; RevyTV/1.0)'

export type SeriesValues = Array<number | null>

export interface SeasonSeries {
  label: string
  startYear: number
  values: SeriesValues
  total: number
  lastIndex: number
}

export interface ParsedHistoricalData {
  dates: string[]
  seasons: SeasonSeries[]
}

export interface HistoricalData extends ParsedHistoricalData {
  fetchedAt: string
  source: string
  fromCache: boolean
}

export interface LabeledValue {
  label: string
  value: number
}

export interface SeasonComparison {
  index: number
  dateLabel: string
  current: number | null
  comparedCount: number
  mean: number | null
  median: number | null
  min: LabeledValue | null
  max: LabeledValue | null
  rank: number | null
  pctOfMean: number | null
  seasons: LabeledValue[]
  endOfSeason: { mean: number | null; min: LabeledValue | null; max: LabeledValue | null }
  projectedTotal: number | null
  band: { min: SeriesValues; max: SeriesValues; mean: SeriesValues }
}

export interface HistoricalDeps {
  storage?: KeyValueStore
  fetch?: typeof fetch
}

function parseQuotedList(source: string): string[] {
  return [...source.matchAll(/'([^']*)'/g)].map((m) => m[1] ?? '')
}

function parseNumberList(source: string): SeriesValues {
  return source
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v.length > 0)
    .map((v) => (v === 'null' ? null : Number(v)))
    .map((v) => (v !== null && Number.isNaN(v) ? null : v))
}

function normalizeLength(values: SeriesValues, length: number): SeriesValues {
  let out = values.slice(0, length)
  while (out.length < length) out.push(null)
  return out
}

// '07-08' -> 2007. Labels before '70' are assumed to be 21st century.
export function startYearFromLabel(label: string): number {
  let two = parseInt(label.slice(0, 2), 10)
  return two >= 70 ? 1900 + two : 2000 + two
}

export function parseHistoricalSnowData(html: string): ParsedHistoricalData {
  let xAxisMatch = html.match(/xAxis:\s*\[\s*\{[\s\S]*?data:\s*\[([\s\S]*?)\]/)
  if (!xAxisMatch?.[1]) throw new Error('Historical snow data: xAxis dates not found')
  let dates = parseQuotedList(xAxisMatch[1])
  if (dates.length === 0) throw new Error('Historical snow data: no dates')

  let seriesPattern = /name:\s*'([^']+)'\s*,\s*type:\s*'line'\s*,\s*data:\s*\[([\s\S]*?)\]/g
  let seasons: SeasonSeries[] = []

  for (let match of html.matchAll(seriesPattern)) {
    let label = match[1] ?? ''
    let values = normalizeLength(parseNumberList(match[2] ?? ''), dates.length)
    let lastIndex = -1
    for (let i = values.length - 1; i >= 0; i--) {
      if (values[i] !== null) {
        lastIndex = i
        break
      }
    }
    let total = lastIndex >= 0 ? (values[lastIndex] as number) : 0
    seasons.push({ label, startYear: startYearFromLabel(label), values, total, lastIndex })
  }

  return { dates, seasons }
}

export function createHistoricalService(deps: HistoricalDeps = {}) {
  let storage = deps.storage ?? defaultStorage
  let fetchFn = deps.fetch ?? fetch

  async function fetchFresh(now: Date): Promise<HistoricalData> {
    let response = await fetchFn(HISTORICAL_URL, { headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    let parsed = parseHistoricalSnowData(await response.text())
    if (parsed.seasons.length < MIN_SEASONS) {
      throw new Error(`Historical snow data: only ${parsed.seasons.length} seasons parsed`)
    }
    return { ...parsed, fetchedAt: now.toISOString(), source: HISTORICAL_URL, fromCache: false }
  }

  async function getHistoricalSnowData(now: Date = new Date()): Promise<HistoricalData> {
    let cached = await storage.get<HistoricalData>(CACHE_KEY)
    let cachedAge = cached ? now.getTime() - new Date(cached.fetchedAt).getTime() : Infinity

    if (cached && cachedAge < MAX_AGE_MS) return { ...cached, fromCache: true }

    try {
      let fresh = await fetchFresh(now)
      await storage.set(CACHE_KEY, { ...fresh, fromCache: false })
      return fresh
    } catch (error) {
      if (cached) {
        console.error('Historical snow data refresh failed, serving stale cache:', error)
        return { ...cached, fromCache: true }
      }
      throw error
    }
  }

  // Our own daily season-total records, placed on the season's Nov 1 .. Apr 20 axis.
  async function getCurrentSeasonSeries(startYear: number): Promise<SeriesValues> {
    let values: SeriesValues = new Array<number | null>(SEASON_DAYS).fill(null)
    let first = seasonIndexToDate(startYear, 0)
    let last = seasonIndexToDate(startYear, LAST_SEASON_INDEX)
    let records = await storage.getAllByPrefix<SeasonTotalRecord>('snowfall:')

    for (let record of Object.values(records)) {
      if (!record?.date || record.date < first || record.date > last) continue
      let index = Math.round((Date.parse(record.date + 'T00:00:00Z') - Date.parse(first + 'T00:00:00Z')) / 86_400_000)
      if (index >= 0 && index < SEASON_DAYS) values[index] = record.seasonTotal
    }

    return values
  }

  return { getHistoricalSnowData, getCurrentSeasonSeries }
}

const defaultService = createHistoricalService()

export function getHistoricalSnowData(now?: Date): Promise<HistoricalData> {
  return defaultService.getHistoricalSnowData(now)
}

export function getCurrentSeasonSeries(startYear: number): Promise<SeriesValues> {
  return defaultService.getCurrentSeasonSeries(startYear)
}

// Carry the last known value forward over gaps. Leading nulls stay null.
export function fillForward(values: SeriesValues): SeriesValues {
  let out: SeriesValues = []
  let last: number | null = null
  for (let v of values) {
    if (v !== null) last = v
    out.push(last)
  }
  return out
}

function valueAt(filled: SeriesValues, index: number): number | null {
  return filled[index] ?? null
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  let sorted = [...values].sort((a, b) => a - b)
  let mid = Math.floor(sorted.length / 2)
  let lo = sorted[mid - 1]
  let hi = sorted[mid]
  if (hi === undefined) return null
  return sorted.length % 2 === 0 && lo !== undefined ? Math.round((lo + hi) / 2) : hi
}

function extremes(entries: LabeledValue[]): { min: LabeledValue | null; max: LabeledValue | null } {
  let min: LabeledValue | null = null
  let max: LabeledValue | null = null
  for (let entry of entries) {
    if (!min || entry.value < min.value) min = entry
    if (!max || entry.value > max.value) max = entry
  }
  return { min, max }
}

export function summarizeSeason(
  data: ParsedHistoricalData,
  opts: { currentLabel: string; index: number; currentTotal: number | null },
): SeasonComparison {
  let length = data.dates.length
  let index = Math.min(length - 1, Math.max(0, Math.round(opts.index)))
  let past = data.seasons.filter((s) => s.label !== opts.currentLabel)
  let filledPast = past.map((s) => ({ season: s, filled: fillForward(s.values) }))

  let atIndex: LabeledValue[] = []
  let remaining: number[] = []
  for (let { season, filled } of filledPast) {
    let value = valueAt(filled, index)
    if (value === null) continue
    atIndex.push({ label: season.label, value })
    remaining.push(season.total - value)
  }
  atIndex.sort((a, b) => b.value - a.value)

  let { min, max } = extremes(atIndex)
  let meanAt = mean(atIndex.map((e) => e.value))
  let current = opts.currentTotal

  let rank: number | null = null
  let pctOfMean: number | null = null
  let projectedTotal: number | null = null
  if (current !== null) {
    rank = 1 + atIndex.filter((e) => e.value > current).length
    if (meanAt !== null && meanAt > 0) pctOfMean = Math.round((current / meanAt) * 100)
    let meanRemaining = mean(remaining)
    if (meanRemaining !== null) projectedTotal = current + meanRemaining
  }

  let totals = past.filter((s) => s.lastIndex >= 0).map((s) => ({ label: s.label, value: s.total }))
  let endExtremes = extremes(totals)

  let band: SeasonComparison['band'] = { min: [], max: [], mean: [] }
  for (let i = 0; i < length; i++) {
    let values: number[] = []
    for (let { filled } of filledPast) {
      let v = valueAt(filled, i)
      if (v !== null) values.push(v)
    }
    band.min.push(values.length ? Math.min(...values) : null)
    band.max.push(values.length ? Math.max(...values) : null)
    band.mean.push(mean(values))
  }

  return {
    index,
    dateLabel: data.dates[index] ?? '',
    current,
    comparedCount: atIndex.length,
    mean: meanAt,
    median: median(atIndex.map((e) => e.value)),
    min,
    max,
    rank,
    pctOfMean,
    seasons: atIndex,
    endOfSeason: { mean: mean(totals.map((t) => t.value)), min: endExtremes.min, max: endExtremes.max },
    projectedTotal,
    band,
  }
}

// The resort's in-progress season is not reliably anchored to Nov 1: on 26 Nov
// 2026 its 26-27 series already ran 36 points, i.e. it counts from the first day
// they logged. When the series runs past today, slide it back so its last point
// lands on today, or on yesterday when the live total has already moved past it.
// Completed seasons and series that end on or before today are left alone.
export function alignResortSeries(
  values: SeriesValues,
  todayIndex: number,
  liveTotal: number | null,
): SeriesValues {
  let out = new Array<number | null>(SEASON_DAYS).fill(null)
  let lastIndex = -1
  for (let i = values.length - 1; i >= 0; i--) {
    if (values[i] != null) {
      lastIndex = i
      break
    }
  }
  if (lastIndex < 0) return out

  let last = values[lastIndex] as number
  let endsAt = lastIndex
  if (lastIndex > todayIndex) endsAt = liveTotal != null && liveTotal > last ? todayIndex - 1 : todayIndex
  let shift = endsAt - lastIndex

  for (let i = 0; i <= lastIndex; i++) {
    let j = i + shift
    if (j >= 0 && j < SEASON_DAYS) out[j] = values[i] ?? null
  }
  return out
}

// This season's line: the resort's series fills in the days before we started
// recording, our own daily records win wherever we have them, and gaps are
// carried forward. Nothing past today is kept.
export function mergeCurrentSeason(resort: SeriesValues | undefined, own: SeriesValues, todayIndex: number): SeriesValues {
  let merged: SeriesValues = []
  for (let i = 0; i < SEASON_DAYS; i++) merged.push(own[i] ?? resort?.[i] ?? null)
  return fillForward(merged).map((v, i) => (i <= todayIndex ? v : null))
}
