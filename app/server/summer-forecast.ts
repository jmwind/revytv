// Daily temperature and sky forecast for summer mode, from Open-Meteo (no key needed).
const LATITUDE = 50.9583
const LONGITUDE = -118.1804
const RESORT_TIMEZONE = 'America/Vancouver'
const FORECAST_DAYS = 6
const USER_AGENT = 'Mozilla/5.0 (compatible; RevyTV/1.0)'

// Open-Meteo downscales temperature to an elevation, giving the base-vs-alpine delta.
export const BASE_ELEVATION = 512
export const SUMMIT_ELEVATION = 2225

export type SkyCondition = 'sunny' | 'partly cloudy' | 'cloudy' | 'fog' | 'rain' | 'snow' | 'storm'

export interface SummerForecastDay {
  date: string
  tempMax: number | null
  tempMin: number | null
  summitTempMax: number | null
  summitTempMin: number | null
  weatherCode: number
  condition: SkyCondition
}

export interface SummerForecast {
  forecast: SummerForecastDay[]
  baseElevation: number
  summitElevation: number
  fetchedAt: string
  source: 'open-meteo'
}

// WMO weather codes: https://open-meteo.com/en/docs
export function codeToCondition(code: number): SkyCondition {
  if (code === 0) return 'sunny'
  if (code === 1 || code === 2) return 'partly cloudy'
  if (code === 3) return 'cloudy'
  if (code === 45 || code === 48) return 'fog'
  if (code >= 51 && code <= 67) return 'rain'
  if (code >= 71 && code <= 77) return 'snow'
  if (code >= 80 && code <= 82) return 'rain'
  if (code >= 85 && code <= 86) return 'snow'
  if (code >= 95) return 'storm'
  return 'cloudy'
}

interface OpenMeteoDaily {
  time?: string[]
  weathercode?: Array<number | null>
  temperature_2m_max?: Array<number | null>
  temperature_2m_min?: Array<number | null>
}

async function fetchDaily(elevation: number, fetchFn: typeof fetch): Promise<OpenMeteoDaily> {
  let url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(LATITUDE))
  url.searchParams.set('longitude', String(LONGITUDE))
  url.searchParams.set('daily', 'weathercode,temperature_2m_max,temperature_2m_min')
  url.searchParams.set('timezone', RESORT_TIMEZONE)
  url.searchParams.set('forecast_days', String(FORECAST_DAYS))
  url.searchParams.set('elevation', String(elevation))

  let response = await fetchFn(url, { headers: { 'User-Agent': USER_AGENT } })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)

  let data = (await response.json()) as { daily?: OpenMeteoDaily }
  return data.daily ?? {}
}

export async function getSummerForecast(fetchFn: typeof fetch = fetch): Promise<SummerForecast> {
  let [base, summit] = await Promise.all([fetchDaily(BASE_ELEVATION, fetchFn), fetchDaily(SUMMIT_ELEVATION, fetchFn)])

  let round = (v: number | null | undefined): number | null => (v == null ? null : Math.round(v))

  let forecast = (base.time ?? []).map((date, i): SummerForecastDay => {
    let code = base.weathercode?.[i] ?? 0
    return {
      date,
      tempMax: round(base.temperature_2m_max?.[i]),
      tempMin: round(base.temperature_2m_min?.[i]),
      summitTempMax: round(summit.temperature_2m_max?.[i]),
      summitTempMin: round(summit.temperature_2m_min?.[i]),
      weatherCode: code,
      condition: codeToCondition(code),
    }
  })

  return {
    forecast,
    baseElevation: BASE_ELEVATION,
    summitElevation: SUMMIT_ELEVATION,
    fetchedAt: new Date().toISOString(),
    source: 'open-meteo',
  }
}
