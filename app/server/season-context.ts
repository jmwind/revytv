// Assembles everything the season-comparison UI needs for "now".
import {
  alignResortSeries,
  getCurrentSeasonSeries,
  getHistoricalSnowData,
  mergeCurrentSeason,
  summarizeSeason,
  type HistoricalData,
  type SeasonComparison,
  type SeriesValues,
} from './historical.ts'
import {
  LAST_SEASON_INDEX,
  clampSeasonIndex,
  dayOfSeasonIndex,
  resortLocalParts,
  seasonLabelForStartYear,
  seasonStartYear,
} from './season.ts'

export interface SeasonContext {
  data: HistoricalData
  label: string
  startYear: number
  index: number
  /** True between Nov 1 and Apr 20; false in the off-season, when the last completed season is shown. */
  inSeason: boolean
  current: SeriesValues
  comparison: SeasonComparison
}

export async function loadSeasonContext(now: Date, liveTotal: number | null): Promise<SeasonContext> {
  let data = await getHistoricalSnowData(now)
  let { month } = resortLocalParts(now)
  let startYear = seasonStartYear(now)
  let rawIndex = dayOfSeasonIndex(now)
  let inSeason = rawIndex >= 0 && rawIndex <= LAST_SEASON_INDEX
  let index = clampSeasonIndex(rawIndex)

  // July through September: the coming season has no data yet, so show the one that just ended.
  if (month >= 7 && month <= 9) {
    startYear -= 1
    index = LAST_SEASON_INDEX
    inSeason = false
  }

  let label = seasonLabelForStartYear(startYear)
  let resort = data.seasons.find((s) => s.label === label)
  let aligned = resort ? alignResortSeries(resort.values, index, liveTotal) : undefined
  let current = mergeCurrentSeason(aligned, await getCurrentSeasonSeries(startYear), index)

  // Anchor today on the live season total from the snow report when we have one.
  let anchored: number | null = null
  if (liveTotal != null && liveTotal > 0 && (inSeason || rawIndex < 0)) {
    anchored = liveTotal
    current[index] = liveTotal
    for (let i = index + 1; i < current.length; i++) current[i] = null
  }

  let currentTotal = anchored ?? current[index] ?? lastValue(current)
  let comparison = summarizeSeason(data, { currentLabel: label, index, currentTotal })

  return { data, label, startYear, index, inSeason, current, comparison }
}

function lastValue(values: SeriesValues): number | null {
  for (let i = values.length - 1; i >= 0; i--) {
    let v = values[i]
    if (v != null) return v
  }
  return null
}
