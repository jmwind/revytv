// Avalanche Canada's public forecast for the point on the map the resort sits on.
// Cached for an hour; the last good copy is served if a refresh fails.
import { storage as defaultStorage, type KeyValueStore } from './storage.ts'

export const AVALANCHE_POINT = { lat: 51.008479, lng: -118.171069 }
export const AVALANCHE_API_URL = `https://api.avalanche.ca/forecasts/en/products/point?lat=${AVALANCHE_POINT.lat}&long=${AVALANCHE_POINT.lng}`
export const AVALANCHE_MAP_URL = `https://avalanche.ca/map?lat=${AVALANCHE_POINT.lat}&lng=${AVALANCHE_POINT.lng}`
const CACHE_KEY = 'avalanche:forecast'
const MAX_AGE_MS = 60 * 60 * 1000
const USER_AGENT = 'Mozilla/5.0 (compatible; RevyTV/1.0)'

/** 1 Low … 5 Extreme; 0 when no rating is published. */
export type DangerLevel = 0 | 1 | 2 | 3 | 4 | 5

export interface DangerRating {
  level: DangerLevel
  label: string
}

export interface DangerDay {
  date: string
  label: string
  alp: DangerRating
  tln: DangerRating
  btl: DangerRating
}

export interface AvalancheProblem {
  type: string
  elevations: string[]
  aspects: string[]
}

export interface AvalancheSummary {
  key: string
  title: string
  paragraphs: string[]
}

export interface ParsedAvalancheForecast {
  url: string
  dateIssued: string
  validUntil: string
  highlights: string[]
  confidence: { level: string; label: string; statements: string[] }
  days: DangerDay[]
  problems: AvalancheProblem[]
  summaries: AvalancheSummary[]
  advice: string[]
}

export interface AvalancheForecast extends ParsedAvalancheForecast {
  fetchedAt: string
  fromCache: boolean
}

export interface AvalancheDeps {
  storage?: KeyValueStore
  fetch?: typeof fetch
}

const LEVELS: Record<string, DangerLevel> = { low: 1, moderate: 2, considerable: 3, high: 4, extreme: 5 }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function str(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;|&rsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&ndash;/g, '–')
    .replace(/&mdash;/g, '—')
    .replace(/&[a-z]+;/g, ' ')
}

// Paragraph text from the forecast's HTML: links and emphasis dropped, breaks kept as spaces.
export function htmlToParagraphs(html: string): string[] {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .split(/<\/p>|<\/li>|<\/h\d>/i)
    .map((chunk) => decodeEntities(chunk.replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim())
    .filter((text) => text.length > 0)
}

function rating(value: unknown): DangerRating {
  let r = isRecord(value) && isRecord(value.rating) ? value.rating : null
  let key = str(r?.value).toLowerCase()
  let display = str(r?.display).replace(/^\d\s*-\s*/, '')
  return { level: LEVELS[key] ?? 0, label: display || 'No rating' }
}

function displayList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.map((v) => (isRecord(v) ? str(v.display) || str(v.value) : str(v))).filter(Boolean)
}

export function parseAvalancheProduct(json: unknown): ParsedAvalancheForecast {
  if (!isRecord(json) || !isRecord(json.report)) throw new Error('Avalanche forecast: no report in response')
  let report = json.report
  let url = str(json.url)
  let dateIssued = str(report.dateIssued)
  let validUntil = str(report.validUntil)
  if (!dateIssued) throw new Error('Avalanche forecast: no issue date')

  let days: DangerDay[] = []
  for (let day of Array.isArray(report.dangerRatings) ? report.dangerRatings : []) {
    if (!isRecord(day) || !isRecord(day.ratings)) continue
    let date = isRecord(day.date) ? day.date : {}
    days.push({
      date: str(date.value),
      label: str(date.display),
      alp: rating(day.ratings.alp),
      tln: rating(day.ratings.tln),
      btl: rating(day.ratings.btl),
    })
  }
  if (days.length === 0) throw new Error('Avalanche forecast: no danger ratings')

  let confidence = isRecord(report.confidence) ? report.confidence : {}
  let confidenceRating = isRecord(confidence.rating) ? confidence.rating : {}

  let problems: AvalancheProblem[] = []
  for (let problem of Array.isArray(report.problems) ? report.problems : []) {
    if (!isRecord(problem)) continue
    let type = isRecord(problem.type) ? str(problem.type.display) : ''
    let data = isRecord(problem.data) ? problem.data : {}
    if (type) problems.push({ type, elevations: displayList(data.elevations), aspects: displayList(data.aspects) })
  }

  let summaries: AvalancheSummary[] = []
  for (let summary of Array.isArray(report.summaries) ? report.summaries : []) {
    if (!isRecord(summary) || !isRecord(summary.type)) continue
    let key = str(summary.type.value)
    let title = str(summary.type.display)
    let paragraphs = htmlToParagraphs(str(summary.content))
    if (key && paragraphs.length) summaries.push({ key, title, paragraphs })
  }

  return {
    url,
    dateIssued,
    validUntil,
    highlights: htmlToParagraphs(str(report.highlights)),
    confidence: {
      level: str(confidenceRating.value),
      label: str(confidenceRating.display) || 'Not stated',
      statements: Array.isArray(confidence.statements) ? confidence.statements.map(str).filter(Boolean) : [],
    },
    days,
    problems,
    summaries,
    advice: Array.isArray(report.terrainAndTravelAdvice) ? report.terrainAndTravelAdvice.map(str).filter(Boolean) : [],
  }
}

export function createAvalancheService(deps: AvalancheDeps = {}) {
  let storage = deps.storage ?? defaultStorage
  let fetchFn = deps.fetch ?? fetch

  async function fetchFresh(now: Date): Promise<AvalancheForecast> {
    let response = await fetchFn(AVALANCHE_API_URL, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    let parsed = parseAvalancheProduct(await response.json())
    return { ...parsed, fetchedAt: now.toISOString(), fromCache: false }
  }

  async function getAvalancheForecast(now: Date = new Date()): Promise<AvalancheForecast> {
    let cached = await storage.get<AvalancheForecast>(CACHE_KEY)
    let cachedAge = cached ? now.getTime() - new Date(cached.fetchedAt).getTime() : Infinity
    if (cached && cachedAge < MAX_AGE_MS) return { ...cached, fromCache: true }

    try {
      let fresh = await fetchFresh(now)
      await storage.set(CACHE_KEY, fresh)
      return fresh
    } catch (error) {
      if (cached) {
        console.error('Avalanche forecast refresh failed, serving stale cache:', error)
        return { ...cached, fromCache: true }
      }
      throw error
    }
  }

  return { getAvalancheForecast }
}

const defaultService = createAvalancheService()

export function getAvalancheForecast(now?: Date): Promise<AvalancheForecast> {
  return defaultService.getAvalancheForecast(now)
}
