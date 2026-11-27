// Fetch and parse the resort snow report, and record how forecasts change.
import { RESORT_TIMEZONE, assignForecastDates } from './forecast-dates.ts'
import { storage as defaultStorage, type ForecastRevision, type KeyValueStore, type StorageMode } from './storage.ts'

export type { ForecastRevision }

export const SNOW_REPORT_URL = 'https://www.revelstokemountainresort.com/mountain/conditions/snow-report/'
const CACHE_KEY = 'snow-report:cache'
const STATS_KEY = 'snow-report:stats'
const CACHE_TTL_SECONDS = 600
const MAX_HISTORY_ENTRIES = 30
const USER_AGENT = 'Mozilla/5.0 (compatible; RevyTV/1.0)'

export type FreezingLevel = number | 'valley bottom' | null

export interface Weather {
  alpineTemp?: number
  subpeakTemp?: number
  ripperTemp?: number
  condition?: string
  windSpeed?: number
  windDirection?: string
}

export interface SnowStats {
  newSnow: number
  lastHour: number
  twentyFourHour: number
  fortyEightHour: number
  sevenDay: number
  baseDepth: number
  seasonTotal: number
}

export interface ParsedForecastDay {
  day: string
  amount: number
  freezingLevel: FreezingLevel
  description: string | null
}

export interface ForecastDay extends ParsedForecastDay {
  actualDate?: string
  history: ForecastRevision[]
}

export interface ParsedSnowReport {
  weather: Weather
  snow: SnowStats
  forecast: ParsedForecastDay[]
  /** When Environment Canada issued the text forecast on the page, or null if not stated. */
  forecastIssuedAt: string | null
  /** Snow fields whose pattern did not match; a missing field reads as 0 cm. */
  missingFields: string[]
}

// Fields the page always carries. When two or more fail to parse the markup has
// changed, and a page of zeros must not be mistaken for a calm day.
const CORE_FIELDS = ['newSnow', 'twentyFourHour', 'baseDepth', 'seasonTotal'] as const

export class SnowReportLayoutError extends Error {
  constructor(public missingFields: string[]) {
    super(`Snow report page layout changed: could not read ${missingFields.join(', ')}`)
    this.name = 'SnowReportLayoutError'
  }
}

export interface SnowReport {
  weather: Weather
  snow: SnowStats
  forecast: ForecastDay[]
  forecastIssuedAt: string | null
  /** When the resort's snow and weather figures last differed from the previous fetch. */
  statsChangedAt: string
  fetchedAt: string
  source: string
  storageMode: StorageMode
  fromCache?: boolean
}

export interface ForecastRecord {
  date: string
  key: string
  dayName: string
  history: ForecastRevision[]
}

export interface SeasonTotalRecord {
  date: string
  seasonTotal: number
  recordedAt: string
}

export interface NewSnowRecord {
  date: string
  newSnow: number
  recordedAt: string
}

interface StatsRecord {
  snow: SnowStats
  weather: Weather
  changedAt: string
}

export interface SnowReportDeps {
  storage?: KeyValueStore
  fetch?: typeof fetch
  now?: () => Date
}

export function parseSnowReport(html: string): ParsedSnowReport {
  let text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ')
  let weather: Weather = {}

  let alpineTempMatch = text.match(/Alpine\s+temperature:\s+Low\s+(-?\d+)\s*°C/i)
  let conditionMatch = text.match(
    /\b(Mainly\s+cloudy|Cloudy|Clear|Sunny|Snow|Snowing|Overcast|Partly\s+cloudy|Flurries)\b/i,
  )
  let windMatch = text.match(/Ridge\s+wind\s+(\w+):\s+(\d+)\s+km\/h/i)

  if (alpineTempMatch?.[1] !== undefined) {
    weather.alpineTemp = parseInt(alpineTempMatch[1], 10)
    weather.subpeakTemp = weather.alpineTemp + 1
    weather.ripperTemp = weather.alpineTemp + 1
  }
  if (conditionMatch?.[1] !== undefined) {
    weather.condition = conditionMatch[1].toLowerCase()
  }
  if (windMatch?.[1] !== undefined && windMatch[2] !== undefined) {
    weather.windSpeed = parseInt(windMatch[2], 10)
    weather.windDirection = windMatch[1].charAt(0).toUpperCase() + windMatch[1].slice(1).toLowerCase()
  }

  let missingFields: string[] = []
  let cm = (field: keyof SnowStats, pattern: RegExp): number => {
    let match = text.match(pattern)
    if (match?.[1] === undefined) {
      missingFields.push(field)
      return 0
    }
    return parseInt(match[1], 10)
  }

  let snow: SnowStats = {
    newSnow: cm('newSnow', /NEW\s+SNOW[\s\S]{0,100}?(\d+)\s*CM/i),
    lastHour: cm('lastHour', /LAST\s+HOUR[\s\S]{0,100}?(\d+)\s*CM/i),
    twentyFourHour: cm('twentyFourHour', /24\s+HOURS[\s\S]{0,100}?(\d+)\s*CM/i),
    fortyEightHour: cm('fortyEightHour', /48\s+HOURS[\s\S]{0,100}?(\d+)\s*CM/i),
    sevenDay: cm('sevenDay', /7\s+DAYS[\s\S]{0,100}?(\d+)\s*CM/i),
    baseDepth: cm('baseDepth', /BASE\s+DEPTH[\s\S]{0,100}?(\d+)\s*CM/i),
    seasonTotal: cm('seasonTotal', /SEASON\s+TOTAL[\s\S]{0,100}?(\d+)\s*CM/i),
  }

  let forecast = extractForecast(html)
  if (forecast.length === 0) missingFields.push('forecast')

  let coreMissing = missingFields.filter((f) => (CORE_FIELDS as readonly string[]).includes(f))
  if (coreMissing.length >= 2) throw new SnowReportLayoutError(missingFields)
  if (missingFields.length > 0) console.error(`Snow report: could not read ${missingFields.join(', ')}`)

  return { weather, snow, forecast, forecastIssuedAt: parseIssuedAt(text), missingFields }
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december']

// "Issued by Environment Canada on Friday November 27, 2026 at 01:00 PCT." The zone
// abbreviation on the page is unreliable, so the time is read as resort local time.
export function parseIssuedAt(text: string): string | null {
  let match = text.match(/Issued by\s+Environment Canada\s+on\s+\w+,?\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})/i)
  if (!match) return null
  let month = MONTHS.indexOf((match[1] ?? '').toLowerCase())
  if (month < 0) return null
  let [day, year, hour, minute] = [match[2], match[3], match[4], match[5]].map((v) => parseInt(v ?? '', 10))
  if ([day, year, hour, minute].some((v) => !Number.isFinite(v))) return null
  return resortLocalToIso(year!, month + 1, day!, hour!, minute!)
}

function zoneOffsetMs(date: Date): number {
  let parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: RESORT_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  let pick = (type: string): number => Number(parts.find((p) => p.type === type)?.value ?? '0')
  let asUtc = Date.UTC(pick('year'), pick('month') - 1, pick('day'), pick('hour'), pick('minute'), pick('second'))
  return asUtc - date.getTime()
}

function resortLocalToIso(year: number, month: number, day: number, hour: number, minute: number): string {
  let guess = Date.UTC(year, month - 1, day, hour, minute)
  let utc = guess - zoneOffsetMs(new Date(guess))
  let settled = guess - zoneOffsetMs(new Date(utc))
  return new Date(settled).toISOString()
}

// Alpine forecast only, in document order; day names may repeat in 10-day forecasts.
export function extractForecast(html: string): ParsedForecastDay[] {
  let forecast: ParsedForecastDay[] = []
  let validDays = 'Today|Tonight|Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday'

  let alpineMatch = html.match(/id="alpine"[\s\S]*?>([\s\S]*?)(?=<[^>]*id="valley"|$)/i)
  let alpineHtml = alpineMatch?.[1] ?? html

  let sectionPattern = new RegExp(`<h[1-6][^>]*>\\s*(${validDays})\\s*</h[1-6]>([\\s\\S]*?)(?=<h[1-6]|$)`, 'gi')

  for (let match of alpineHtml.matchAll(sectionPattern)) {
    let rawDay = match[1] ?? ''
    let day = rawDay.charAt(0).toUpperCase() + rawDay.slice(1).toLowerCase()
    let sectionText = (match[2] ?? '').replace(/<[^>]*>/g, ' ')

    let snowMatch = sectionText.match(/Snow:\s*(\d+)\s*cm/i)
    let amount = snowMatch?.[1] !== undefined ? parseInt(snowMatch[1], 10) : 0

    let freezingLevel: FreezingLevel = null
    let freezingMatch = sectionText.match(/Freezing\s+level:\s*(\d+)\s*metres?/i)
    if (freezingMatch?.[1] !== undefined) freezingLevel = parseInt(freezingMatch[1], 10)
    else if (/Freezing\s+level\s+at\s+valley\s+bottom/i.test(sectionText)) freezingLevel = 'valley bottom'

    let descMatch = sectionText.match(/^\s*([A-Z][^.]*\.)/)
    let description = descMatch?.[1]?.trim() ?? null

    forecast.push({ day, amount, freezingLevel, description })
  }

  return forecast
}

export function createSnowReportService(deps: SnowReportDeps = {}) {
  let storage = deps.storage ?? defaultStorage
  let fetchFn = deps.fetch ?? fetch
  let now = deps.now ?? (() => new Date())

  async function getSnowReport(): Promise<SnowReport> {
    let cached = await storage.get<SnowReport>(CACHE_KEY)
    if (cached) return { ...cached, fromCache: true }

    let response = await fetchFn(SNOW_REPORT_URL, { headers: { 'User-Agent': USER_AGENT } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)

    let html = await response.text()
    let parsed = parseSnowReport(html)
    let fetchedAtDate = now()
    let fetchedAt = fetchedAtDate.toISOString()

    let [forecast, statsChangedAt] = await Promise.all([
      trackForecastHistory(parsed.forecast, fetchedAtDate),
      trackStatsChange(parsed.snow, parsed.weather, fetchedAt),
      parsed.snow.seasonTotal ? storeSeasonTotal(parsed.snow.seasonTotal, fetchedAt) : Promise.resolve(),
      storeNewSnow(parsed.snow.newSnow, fetchedAt),
    ])

    let report: SnowReport = {
      weather: parsed.weather,
      snow: parsed.snow,
      forecast,
      forecastIssuedAt: parsed.forecastIssuedAt,
      statsChangedAt,
      fetchedAt,
      source: SNOW_REPORT_URL,
      storageMode: storage.storageMode(),
    }

    await storage.set(CACHE_KEY, report, CACHE_TTL_SECONDS)
    return report
  }

  // The resort's figures move a few times a day at most; remember when they last did.
  async function trackStatsChange(snow: SnowStats, weather: Weather, fetchedAt: string): Promise<string> {
    let previous = await storage.get<StatsRecord>(STATS_KEY)
    if (
      previous &&
      JSON.stringify(previous.snow) === JSON.stringify(snow) &&
      JSON.stringify(previous.weather) === JSON.stringify(weather)
    ) {
      return previous.changedAt
    }
    await storage.set(STATS_KEY, { snow, weather, changedAt: fetchedAt } satisfies StatsRecord)
    return fetchedAt
  }

  // One season-total record per day, first write wins.
  async function storeSeasonTotal(seasonTotal: number, fetchedAt: string): Promise<void> {
    let today = fetchedAt.slice(0, 10)
    let key = `snowfall:${today}`
    if (await storage.get<SeasonTotalRecord>(key)) return
    await storage.set(key, { date: today, seasonTotal, recordedAt: fetchedAt } satisfies SeasonTotalRecord)
  }

  // Daily new-snow high-water mark.
  async function storeNewSnow(newSnow: number, fetchedAt: string): Promise<void> {
    let today = fetchedAt.slice(0, 10)
    let key = `newsnow:${today}`
    let existing = await storage.get<NewSnowRecord>(key)
    if (existing && existing.newSnow >= newSnow) return
    await storage.set(key, { date: today, newSnow, recordedAt: fetchedAt } satisfies NewSnowRecord)
  }

  async function trackForecastHistory(forecasts: ParsedForecastDay[], fetchedAtDate: Date): Promise<ForecastDay[]> {
    let fetchedAt = fetchedAtDate.toISOString()
    let dateKeys = assignForecastDates(
      forecasts.map((f) => f.day),
      fetchedAtDate,
    )

    let tracked = await Promise.all(forecasts.map((forecast, i) => trackOne(forecast, dateKeys[i] ?? null)))
    return tracked

    async function trackOne(forecast: ParsedForecastDay, dateInfo: (typeof dateKeys)[number] | null): Promise<ForecastDay> {
      if (!dateInfo) return { ...forecast, history: [] }

      let storageKey = `forecast:${dateInfo.key}`
      let record = await storage.getWithMock<ForecastRecord>(storageKey, forecast.amount, dateInfo.key)
      if (!record) {
        record = { date: dateInfo.date, key: dateInfo.key, dayName: forecast.day, history: [] }
      }

      let lastEntry = record.history[record.history.length - 1]
      let hasChanged =
        !lastEntry || lastEntry.amount !== forecast.amount || lastEntry.freezingLevel !== forecast.freezingLevel

      if (hasChanged) {
        record.history.push({ firstSeen: fetchedAt, amount: forecast.amount, freezingLevel: forecast.freezingLevel })
        if (record.history.length > MAX_HISTORY_ENTRIES) record.history = record.history.slice(-MAX_HISTORY_ENTRIES)
        await storage.set(storageKey, record)
      }

      let history = await getMergedHistoryForDate(dateInfo.date, dateInfo.key)
      return { ...forecast, actualDate: dateInfo.date, history }
    }
  }

  // Plain weekday history plus this period's key, never day mixed with night.
  async function getMergedHistoryForDate(dateStr: string, currentKey: string): Promise<ForecastRevision[]> {
    let keys = [`forecast:${dateStr}`]
    if (currentKey !== dateStr) keys.push(`forecast:${currentKey}`)

    let all: ForecastRevision[] = []
    for (let record of await Promise.all(keys.map((key) => storage.get<ForecastRecord>(key)))) {
      if (record?.history?.length) all.push(...record.history)
    }
    all.sort((a, b) => new Date(a.firstSeen).getTime() - new Date(b.firstSeen).getTime())
    return all
  }

  return { getSnowReport }
}

const defaultService = createSnowReportService()

export function getSnowReport(): Promise<SnowReport> {
  return defaultService.getSnowReport()
}
